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
    const [historyRows] = await connection.query(`
      SELECT mp.match_id, mp.player_id, mp.partner_id, mp.opponent_team_id
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.id
      WHERE m.tournament_id = ?
    `, [tournamentId]);

    // Grouping by match to find opponents
    const matchesHistory = new Map<number, any[]>();
    (historyRows as any[]).forEach(row => {
      if (!matchesHistory.has(row.match_id)) matchesHistory.set(row.match_id, []);
      matchesHistory.get(row.match_id)!.push(row);

      const p = players.find(x => x.id === row.player_id);
      if (p && row.partner_id) p.partners.add(row.partner_id);
    });

    // Populate Opponents Sets
    matchesHistory.forEach((playersInMatch) => {
      playersInMatch.forEach(p1Row => {
        const p1 = players.find(x => x.id === p1Row.player_id);
        if (!p1) return;
        playersInMatch.forEach(p2Row => {
          if (p1Row.opponent_team_id !== p2Row.opponent_team_id) {
            p1.opponents.add(p2Row.player_id);
          }
        });
      });
    });

    // Find next round number to know the context
    const [rRows] = await connection.query('SELECT MAX(round_number) as max_r FROM matches WHERE tournament_id = ?', [tournamentId]);
    const nextRound = ((rRows as any)[0].max_r || 0) + 1;

    // 4. Select Players for this Round (Fairness Rotation)
    players.sort((a, b) => {
      if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
      if (a.lastRound !== b.lastRound) return a.lastRound - b.lastRound;
      return Math.random() - 0.5;
    });

    const playersNeedingGames = players.filter(p => p.gamesPlayed < matchesPerPlayer).length;
    const neededMatches = Math.ceil(playersNeedingGames / 4);
    const actualMatchesToGenerate = Math.max(1, Math.min(courtsAvailable, neededMatches));

    const maxPlayers = actualMatchesToGenerate * 4;
    const selectedPlayers = players.slice(0, maxPlayers);

    if (selectedPlayers.length < 4) {
      throw new Error("No hay suficientes jugadores para formar un partido");
    }

    // 5. Generate Pairings (Greedy/Randomized Search)
    let bestMatches = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 200; attempt++) { // Increased attempts for better optimization
      const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5);
      const currentMatches = [];
      let currentScore = 0;

      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 >= shuffled.length) break;

        const p1 = shuffled[i];
        const p2 = shuffled[i + 1];
        const p3 = shuffled[i + 2];
        const p4 = shuffled[i + 3];

        if (!p1 || !p2 || !p3 || !p4) break;

        // Penalize repeating partners (High penalty)
        if (p1.partners.has(p2.id)) currentScore += 1000;
        if (p3.partners.has(p4.id)) currentScore += 1000;

        // Penalize repeating opponents (Moderate penalty)
        // Each pair of opponents (p1 vs p3, p1 vs p4, p2 vs p3, p2 vs p4)
        if (p1.opponents.has(p3.id)) currentScore += 100;
        if (p1.opponents.has(p4.id)) currentScore += 100;
        if (p2.opponents.has(p3.id)) currentScore += 100;
        if (p2.opponents.has(p4.id)) currentScore += 100;

        currentMatches.push({
          court: Math.floor(i / 4) + 1,
          team1: [p1, p2],
          team2: [p3, p4]
        });
      }

      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestMatches = currentMatches;
        if (currentScore === 0) break;
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
export const shuffleSingleMatch = async (matchId: number) => {
  const connection = await pool.getConnection();
  try {
    // 0. Check for scores
    const [scoreRows] = await connection.query('SELECT score_obtained FROM match_players WHERE match_id = ? AND score_obtained > 0', [matchId]);
    if ((scoreRows as any[]).length > 0) {
      throw new Error("No se puede revolver un partido que ya tiene resultados.");
    }

    // 1. Get current players and match context
    const [mRows] = await connection.query('SELECT tournament_id, round_number FROM matches WHERE id = ?', [matchId]);
    if ((mRows as any[]).length === 0) throw new Error("Partido no encontrado");
    const { tournament_id: tournamentId, round_number: roundNumber } = (mRows as any)[0];

    const [tRows] = await connection.query('SELECT matches_per_player FROM tournaments WHERE id = ?', [tournamentId]);
    const matchesPerPlayer = (tRows as any)[0].matches_per_player;

    const [mpRows] = await connection.query('SELECT player_id FROM match_players WHERE match_id = ?', [matchId]);
    const currentInMatch = (mpRows as any[]).map(row => row.player_id);

    // 2. Find "Resting" players for this specific round
    // These are players in the tournament who are NOT playing in ANY match of this round
    const [restingRows] = await connection.query(`
      SELECT tp.player_id 
      FROM tournament_players tp
      WHERE tp.tournament_id = ? 
      AND tp.player_id NOT IN (
        SELECT mp.player_id FROM match_players mp 
        JOIN matches m ON mp.match_id = m.id
        WHERE m.tournament_id = ? AND m.round_number = ?
      )
    `, [tournamentId, tournamentId, roundNumber]);

    const restingPlayers = (restingRows as any[]).map(row => row.player_id);

    // 3. Pool of available players: Current 4 + Anyone resting
    const poolIds = [...currentInMatch, ...restingPlayers];

    // We need at least 4. We should have exactly 4 if nobody is resting, or more if people are resting.
    if (poolIds.length < 4) throw new Error("No hay suficientes jugadores disponibles.");

    // 4. Randomized Selection from the pool (to "change" the 4 players)
    // We shuffle the pool and take 4.
    const shuffledPool = poolIds.sort(() => Math.random() - 0.5);
    const selectedIds = shuffledPool.slice(0, 4);

    // 5. Get freshness and history for selected players to optimize teams
    const [statsRows] = await connection.query(`
      SELECT tp.player_id, 
             (SELECT COUNT(*) FROM match_players mp 
              JOIN matches m ON mp.match_id = m.id 
              WHERE mp.player_id = tp.player_id AND m.tournament_id = ?) as games_played
      FROM tournament_players tp
      WHERE tp.player_id IN (?) AND tp.tournament_id = ?
    `, [tournamentId, selectedIds, tournamentId]);

    const stats = (statsRows as any[]).map(row => ({
      id: row.player_id,
      gamesPlayed: row.games_played,
      partners: new Set<number>(),
      opponents: new Set<number>()
    }));

    const [historyRows] = await connection.query(`
      SELECT mp.match_id, mp.player_id, mp.partner_id, mp.opponent_team_id
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.id
      WHERE m.tournament_id = ? AND mp.player_id IN (?)
    `, [tournamentId, selectedIds]);

    const mHistory = new Map<number, any[]>();
    (historyRows as any[]).forEach(row => {
      if (!mHistory.has(row.match_id)) mHistory.set(row.match_id, []);
      mHistory.get(row.match_id)!.push(row);

      const p = stats.find(x => x.id === row.player_id);
      if (p && row.partner_id) p.partners.add(row.partner_id);
    });

    mHistory.forEach((playersInMatch) => {
      playersInMatch.forEach(p1Row => {
        const p1 = stats.find(x => x.id === p1Row.player_id);
        if (!p1) return;
        playersInMatch.forEach(p2Row => {
          if (p1Row.opponent_team_id !== p2Row.opponent_team_id) {
            p1.opponents.add(p2Row.player_id);
          }
        });
      });
    });

    // 6. Trial combinations for the 4 players
    const combinations = [
      { t1: [stats[0], stats[1]], t2: [stats[2], stats[3]] },
      { t1: [stats[0], stats[2]], t2: [stats[1], stats[3]] },
      { t1: [stats[0], stats[3]], t2: [stats[1], stats[2]] }
    ];

    let bestCombo = combinations[0];
    let minPenalty = Infinity;

    for (const combo of combinations) {
      if (!combo.t1[0] || !combo.t1[1] || !combo.t2[0] || !combo.t2[1]) continue;

      let penalty = 0;
      if (combo.t1[0].partners.has(combo.t1[1].id)) penalty += 1000;
      if (combo.t2[0].partners.has(combo.t2[1].id)) penalty += 1000;

      // Opponent penalties
      if (combo.t1[0].opponents.has(combo.t2[0].id)) penalty += 100;
      if (combo.t1[0].opponents.has(combo.t2[1].id)) penalty += 100;
      if (combo.t1[1].opponents.has(combo.t2[0].id)) penalty += 100;
      if (combo.t1[1].opponents.has(combo.t2[1].id)) penalty += 100;

      if (penalty < minPenalty || (penalty === minPenalty && Math.random() > 0.5)) {
        minPenalty = penalty;
        bestCombo = combo;
      }
    }

    // 7. Atomic Swap in DB
    await connection.beginTransaction();
    await connection.query('DELETE FROM match_players WHERE match_id = ?', [matchId]);

    const insertP = async (p: any, partnerId: number, otId: number) => {
      const isFiller = p.gamesPlayed >= matchesPerPlayer;
      await connection.query(
        'INSERT INTO match_players (match_id, player_id, partner_id, opponent_team_id, is_filler) VALUES (?, ?, ?, ?, ?)',
        [matchId, p.id, partnerId, otId, isFiller]
      );
    };

    await insertP(bestCombo.t1[0], bestCombo.t1[1].id, 1);
    await insertP(bestCombo.t1[1], bestCombo.t1[0].id, 1);
    await insertP(bestCombo.t2[0], bestCombo.t2[1].id, 2);
    await insertP(bestCombo.t2[1], bestCombo.t2[0].id, 2);

    await connection.commit();
    return true;
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};
