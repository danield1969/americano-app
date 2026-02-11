import pool from '../config/database';

interface PlayerStats {
  id: number;
  gamesPlayed: number;
  // History
  partners: Set<number>;
  opponents: Set<number>;
}

export const generateRound = async (tournamentId: number) => {
  const connection = await pool.getConnection();
  try {
    // 1. Get Tournament Info
    const [tRows] = await connection.query('SELECT courts_available, matches_per_player FROM tournaments WHERE id = ?', [tournamentId]);
    const { courts_available: courtsAvailable, matches_per_player: matchesPerPlayer } = (tRows as any)[0];

    // 2. Get All Players in Tournament and their stats
    const [tpRows] = await connection.query(`
      SELECT tp.player_id, 
             (SELECT COUNT(*) FROM match_players mp 
              JOIN matches m ON mp.match_id = m.id 
              WHERE mp.player_id = tp.player_id AND m.tournament_id = ?) as games_played,
             (SELECT MAX(m.round_number) FROM match_players mp 
              JOIN matches m ON mp.match_id = m.id 
              WHERE mp.player_id = tp.player_id AND m.tournament_id = ?) as last_round
      FROM tournament_players tp
      WHERE tp.tournament_id = ?
    `, [tournamentId, tournamentId, tournamentId]);

    const players = (tpRows as any[]).map(row => ({
      id: row.player_id,
      gamesPlayed: row.games_played,
      lastRound: row.last_round || 0, // 0 means haven't played yet
      partners: new Set<number>(),
      opponents: new Set<number>()
    }));

    // 3. Load Interaction History (Partners & Opponents during this tournament)
    // This query is vital: Find who played with whom
    const [historyRows] = await connection.query(`
      SELECT mp.player_id, mp.partner_id
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.id
      WHERE m.tournament_id = ?
    `, [tournamentId]);

    // Populate Sets
    (historyRows as any[]).forEach(row => {
      const p = players.find(x => x.id === row.player_id);
      if (p && row.partner_id) p.partners.add(row.partner_id);
    });

    // Find next round number to know the context
    const [rRows] = await connection.query('SELECT MAX(round_number) as max_r FROM matches WHERE tournament_id = ?', [tournamentId]);
    const nextRound = ((rRows as any)[0].max_r || 0) + 1;

    // 4. Select Players for this Round (Fairness Rotation)
    // Criteria:
    // 1. Fewer games played
    // 2. Longer time since last match (lastRound)
    // 3. Randomize ties
    players.sort((a, b) => {
      // Priority 1: Fewer games
      if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;

      // Priority 2: Waited longer (smaller lastRound value)
      if (a.lastRound !== b.lastRound) return a.lastRound - b.lastRound;

      // Priority 3: Random
      return Math.random() - 0.5;
    });

    // Smart Court Selection: Only use as many courts as needed for players who still need games
    const playersNeedingGames = players.filter(p => p.gamesPlayed < matchesPerPlayer).length;
    const neededMatches = Math.ceil(playersNeedingGames / 4);
    const actualMatchesToGenerate = Math.max(1, Math.min(courtsAvailable, neededMatches));

    const maxPlayers = actualMatchesToGenerate * 4;
    const selectedPlayers = players.slice(0, maxPlayers);

    if (selectedPlayers.length < 4) {
      throw new Error("No hay suficientes jugadores para formar un partido");
    }

    // 5. Generate Pairings (Greedy/Randomized Search)
    // Goal: Minimize Pair Repetitions.
    // Since N <= 16 (4 courts), we can try random shuffles and score them.

    let bestMatches = null;
    let bestScore = Infinity; // Lower is better

    for (let attempt = 0; attempt < 100; attempt++) {
      const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5);
      const currentMatches = [];
      let currentScore = 0;

      // Group into chunks of 4
      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 >= shuffled.length) break; // Should not happen if logic is correct

        const p1 = shuffled[i];
        const p2 = shuffled[i + 1];
        const p3 = shuffled[i + 2];
        const p4 = shuffled[i + 3];

        if (!p1 || !p2 || !p3 || !p4) break;

        // Score this match configuration
        // Penalize if p1 & p2 have been partners
        if (p1.partners.has(p2.id)) currentScore += 1000;
        if (p3.partners.has(p4.id)) currentScore += 1000;

        currentMatches.push({
          court: Math.floor(i / 4) + 1,
          team1: [p1, p2],
          team2: [p3, p4]
        });
      }

      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestMatches = currentMatches;
        if (currentScore === 0) break; // Perfect match found
      }
    }

    // 6. Save Round to DB
    if (!bestMatches || bestMatches.length === 0) throw new Error("Could not generate matches");

    await connection.beginTransaction();

    const savedMatches = [];

    for (const m of bestMatches) {
      const p1 = m.team1[0]; const p2 = m.team1[1];
      const p3 = m.team2[0]; const p4 = m.team2[1];

      if (!p1 || !p2 || !p3 || !p4) continue;

      const [mRes] = await connection.query(
        'INSERT INTO matches (tournament_id, round_number, court_number) VALUES (?, ?, ?)',
        [tournamentId, nextRound, m.court]
      );
      const matchId = (mRes as any).insertId;

      // Insert Players with filler check
      const insertPlayer = async (p: any, partnerId: number, otid: number) => {
        const isFiller = p.gamesPlayed >= matchesPerPlayer;
        await connection.query(
          'INSERT INTO match_players (match_id, player_id, partner_id, opponent_team_id, is_filler) VALUES (?, ?, ?, ?, ?)',
          [matchId, p.id, partnerId, otid, isFiller]
        );
      };

      await insertPlayer(p1, p2.id, 1);
      await insertPlayer(p2, p1.id, 1);
      await insertPlayer(p3, p4.id, 2);
      await insertPlayer(p4, p3.id, 2);

      savedMatches.push({
        id: matchId,
        court: m.court,
        team1: [p1, p2],
        team2: [p3, p4]
      });
    }

    await connection.commit();
    return savedMatches;

  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) connection.release();
  }
};

export const generateTournamentPlan = async (tournamentId: number, matchesPerPlayer: number) => {
  const connection = await pool.getConnection();
  try {
    // 1. Get Tournament Info
    const [tRows] = await connection.query('SELECT courts_available FROM tournaments WHERE id = ?', [tournamentId]);
    const tournament = (tRows as any)[0];
    if (!tournament) throw new Error("Tournament not found");

    // 2. Generation Loop
    // We will keep generating rounds until the average matches per player meets the target.

    let finished = false;
    let safeguard = 0;
    while (!finished && safeguard < 30) {
      safeguard++;

      // Check current progress
      const [progress] = await connection.query(`
        SELECT MIN( (SELECT COUNT(*) FROM match_players mp JOIN matches m ON mp.match_id = m.id WHERE mp.player_id = tp.player_id AND m.tournament_id = ?) ) as min_games
        FROM tournament_players tp
        WHERE tp.tournament_id = ?
      `, [tournamentId, tournamentId]);

      const minGames = (progress as any)[0].min_games || 0;

      if (minGames >= matchesPerPlayer) {
        finished = true;
        break;
      }

      // Generate one more round
      await generateRound(tournamentId);
    }

    return { success: true };
  } catch (err) {
    throw err;
  } finally {
    connection.release();
  }
};
