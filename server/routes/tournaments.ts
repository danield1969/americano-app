import { Router } from 'express';
import pool from '../config/database';
import { generateTournamentPlan, generateRound, generateNextMatch } from '../services/matchmaker';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Create Tournament
router.post('/', authenticateToken, async (req, res) => {
  const { date, location, courtsAvailable, playerIds, matchesPerPlayer, modality } = req.body;

  if (!date || !courtsAvailable || !playerIds || playerIds.length < 8) {
    return res.status(400).json({ error: 'Invalid data. Need date, courts, and at least 8 players.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create Tournament
    const [tResult] = await connection.query(
      'INSERT INTO tournaments (date, location, courts_available, matches_per_player, modality, status) VALUES (?, ?, ?, ?, ?, ?)',
      [date, location || null, courtsAvailable, matchesPerPlayer || 3, modality || '16 puntos', 'in_progress']
    );
    const tournamentId = (tResult as any).insertId;

    // 2. Add Players to Tournament
    const playerValues = playerIds.map((pid: number) => [tournamentId, pid, 0]);
    await connection.query(
      'INSERT INTO tournament_players (tournament_id, player_id, current_score) VALUES ?',
      [playerValues]
    );

    await connection.commit();

    // 3. Generate only the first round automatically
    await generateRound(tournamentId);

    res.status(201).json({ id: tournamentId, message: 'Tournament started and all matches generated' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Tournament Creation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create tournament' });
  } finally {
    connection.release();
  }
});

// List Tournaments
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM matches m WHERE m.tournament_id = t.id) as generated_matches,
        (SELECT COUNT(DISTINCT m.id) FROM matches m 
         JOIN match_players mp ON m.id = mp.match_id 
         WHERE m.tournament_id = t.id AND mp.score_obtained > 0) as completed_matches,
        (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) as player_count
      FROM tournaments t 
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete Tournament
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Delete match_players
    await connection.query(`
      DELETE FROM match_players 
      WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?)
    `, [id]);

    // 2. Delete matches
    await connection.query('DELETE FROM matches WHERE tournament_id = ?', [id]);

    // 3. Delete tournament_players
    await connection.query('DELETE FROM tournament_players WHERE tournament_id = ?', [id]);

    // 4. Delete tournament
    await connection.query('DELETE FROM tournaments WHERE id = ?', [id]);

    await connection.commit();
    res.json({ message: 'Torneo eliminado correctamente' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Delete Error:', error);
    res.status(500).json({ error: 'Error al eliminar torneo: ' + error.message });
  } finally {
    connection.release();
  }
});

// Update Tournament (Players and Basic Info)
router.put('/:id/players', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { date, location, courtsAvailable, playerIds, modality } = req.body;

  if (!playerIds || playerIds.length < 8) {
    return res.status(400).json({ error: 'Mínimo 8 jugadores requeridos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update basic tournament info
    await connection.query(
      'UPDATE tournaments SET date = ?, location = ?, courts_available = ?, modality = ? WHERE id = ?',
      [date, location || null, courtsAvailable, modality || '16 puntos', id]
    );

    // 2. Sync players (Add new, remove old, keep existing)
    // Get current players
    const [currentRows] = await connection.query('SELECT player_id FROM tournament_players WHERE tournament_id = ?', [id]);
    const currentPlayerIds = (currentRows as any[]).map(r => r.player_id);

    const playersToRemove = currentPlayerIds.filter(pid => !playerIds.includes(pid));
    const playersToAdd = playerIds.filter((pid: number) => !currentPlayerIds.includes(pid));

    if (playersToRemove.length > 0) {
      await connection.query('DELETE FROM tournament_players WHERE tournament_id = ? AND player_id IN (?)', [id, playersToRemove]);
    }

    if (playersToAdd.length > 0) {
      const playerValues = playersToAdd.map((pid: number) => [id, pid, 0]);
      await connection.query(
        'INSERT INTO tournament_players (tournament_id, player_id, current_score) VALUES ?',
        [playerValues]
      );
    }

    // 3. Recalculate all standings
    const [allPlayers] = await connection.query('SELECT player_id FROM tournament_players WHERE tournament_id = ?', [id]);
    for (const p of (allPlayers as any[])) {
      const [sumRow] = (await connection.query(`
            SELECT SUM(mp.points_won) as total 
            FROM match_players mp 
            JOIN matches m ON mp.match_id = m.id 
            WHERE mp.player_id = ? AND m.tournament_id = ? AND mp.is_filler = 0
        `, [p.player_id, id])) as any;

      const newTotal = sumRow[0].total || 0;
      await connection.query('UPDATE tournament_players SET current_score = ? WHERE player_id = ? AND tournament_id = ?', [newTotal, p.player_id, id]);
    }

    await connection.commit();
    res.json({ message: 'Torneo actualizado correctamente y puntajes recalculados' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Update Error:', error);
    res.status(500).json({ error: 'Error al actualizar: ' + error.message });
  } finally {
    connection.release();
  }
});


// Get Tournament
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM tournaments WHERE id = ?', [id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Not found' });
    res.json((rows as any)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Matches for Tournament
router.get('/:id/matches', async (req, res) => {
  const { id } = req.params;
  try {
    const [matches] = await pool.query('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round_number DESC, court_number ASC', [id]);

    const matchIds = (matches as any[]).map(m => m.id);
    if (matchIds.length === 0) return res.json({ matches: [], players: [] });

    const [players] = await pool.query(`
        SELECT mp.*, p.name 
        FROM match_players mp 
        JOIN players p ON mp.player_id = p.id 
        WHERE mp.match_id IN (?)
      `, [matchIds]);

    res.json({ matches, players });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Standings
router.get('/:id/standings', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
            SELECT tp.player_id, p.name, tp.current_score,
            (SELECT COUNT(*) FROM match_players mp 
             JOIN matches m ON mp.match_id = m.id 
             WHERE mp.player_id = tp.player_id 
             AND m.tournament_id = ? 
             AND mp.is_filler = 0
             AND EXISTS (
               SELECT 1 FROM match_players mp2 
               WHERE mp2.match_id = m.id AND mp2.score_obtained > 0
             )) as games_played
            FROM tournament_players tp
            JOIN players p ON tp.player_id = p.id
            WHERE tp.tournament_id = ?
            ORDER BY tp.current_score DESC
        `, [id, id, id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Shuffle Tournament (Regenerate ONLY unplayed matches)
router.post('/:id/shuffle', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get tournament info
    const [tRows] = await connection.query('SELECT matches_per_player FROM tournaments WHERE id = ?', [id]);
    if ((tRows as any[]).length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Torneo no encontrado' });
    }
    const matchesPerPlayer = (tRows as any)[0].matches_per_player;

    // 2. Find matches WITHOUT any scores recorded
    const [unplayedMatches] = await connection.query(`
      SELECT id FROM matches 
      WHERE tournament_id = ? 
      AND id NOT IN (
        SELECT match_id FROM match_players WHERE score_obtained > 0
      )
    `, [id]);

    const unplayedIds = (unplayedMatches as any[]).map(m => m.id);

    if (unplayedIds.length > 0) {
      // 3. Delete unplayed matches and their player entries
      await connection.query('DELETE FROM match_players WHERE match_id IN (?)', [unplayedIds]);
      await connection.query('DELETE FROM matches WHERE id IN (?)', [unplayedIds]);
    }

    await connection.commit();

    // 4. Regenerate plan for the missing games
    // This will generate as many rounds as needed to reach matchesPerPlayer
    // But since the user wants round-by-round generation, we should probably
    // only regenerate the "next round" or the "plan" depending on preference.
    // The user said "revolver las partidas generadas y que no tengan ningún score anotado".
    // If they were already generated, we recreate them.
    await generateTournamentPlan(parseInt(id as string), matchesPerPlayer);

    res.json({ message: 'Partidos unplayed revueltos correctamente' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Shuffle Error:', error);
    res.status(500).json({ error: 'Error al revolver partidos: ' + error.message });
  } finally {
    connection.release();
  }
});


// Simulate Tournament (Generate all matches and fill with scores)
router.post('/:id/simulate', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    // 1. First, make sure all rounds are generated
    const [tRows] = await connection.query('SELECT matches_per_player, modality FROM tournaments WHERE id = ?', [id]);
    if ((tRows as any[]).length === 0) throw new Error('Tournament not found');
    const { matches_per_player: matchesPerPlayer, modality } = (tRows as any)[0];

    // Generate all remaining matches
    await generateTournamentPlan(parseInt(id as string), matchesPerPlayer);

    await connection.beginTransaction();

    // 2. Get all matches (including newly generated)
    const [matches] = await connection.query('SELECT id FROM matches WHERE tournament_id = ?', [id]);

    for (const match of (matches as any[])) {
      const [scores] = await connection.query('SELECT score_obtained FROM match_players WHERE match_id = ? AND score_obtained > 0', [match.id]);
      if ((scores as any[]).length === 0) {
        let s1, s2;
        if (modality === '4 games') {
          const winnerScore = 4;
          const loserScore = Math.floor(Math.random() * 5); // 0 to 4
          if (Math.random() > 0.5) {
            s1 = winnerScore;
            s2 = loserScore;
          } else {
            s1 = loserScore;
            s2 = winnerScore;
          }
        } else {
          s1 = Math.floor(Math.random() * 17); // 0 to 16
          s2 = 16 - s1;
        }

        let s1p = s1;
        let s2p = s2;
        if (modality === '4 games') {
          if (s1 === 4 && s2 === 0) { s1p = 16; s2p = 0; }
          else if (s1 === 0 && s2 === 4) { s1p = 0; s2p = 16; }
          else if (s1 === 4 && s2 === 1) { s1p = 13; s2p = 3; }
          else if (s1 === 1 && s2 === 4) { s1p = 3; s2p = 13; }
          else if (s1 === 4 && s2 === 2) { s1p = 10; s2p = 6; }
          else if (s1 === 2 && s2 === 4) { s1p = 6; s2p = 10; }
          else if (s1 === 4 && s2 === 3) { s1p = 9; s2p = 7; }
          else if (s1 === 3 && s2 === 4) { s1p = 7; s2p = 9; }
          else if (s1 === 4 && s2 === 4) { s1p = 8; s2p = 8; }
        }

        await connection.query('UPDATE match_players SET score_obtained = ?, points_won = ? WHERE match_id = ? AND opponent_team_id = 1', [s1, s1p, match.id]);
        await connection.query('UPDATE match_players SET score_obtained = ?, points_won = ? WHERE match_id = ? AND opponent_team_id = 2', [s2, s2p, match.id]);
      }
    }

    // 3. Recalculate all standings
    const [players] = await connection.query('SELECT player_id FROM tournament_players WHERE tournament_id = ?', [id]);
    for (const p of (players as any[])) {
      const [sumRow] = (await connection.query(`
            SELECT SUM(mp.points_won) as total 
            FROM match_players mp 
            JOIN matches m ON mp.match_id = m.id 
            WHERE mp.player_id = ? AND m.tournament_id = ? AND mp.is_filler = 0
        `, [p.player_id, id])) as any;

      const newTotal = sumRow[0].total || 0;
      await connection.query('UPDATE tournament_players SET current_score = ? WHERE player_id = ? AND tournament_id = ?', [newTotal, p.player_id, id]);
    }

    await connection.commit();
    res.json({ message: 'Todos los partidos generados y simulados con éxito' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Simulate Error:', error);
    res.status(500).json({ error: 'Error al simular: ' + error.message });
  } finally {
    connection.release();
  }
});

// Generate Next Round
router.post('/:id/next-round', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const matches = await generateRound(parseInt(id as string));
    res.json({ message: 'Siguiente ronda generada', matches });
  } catch (error: any) {
    console.error('Next Round Error:', error);
    res.status(500).json({ error: 'Error al generar ronda: ' + error.message });
  }
});

// Generate Next Match (INDIVIDUAL)
router.post('/:id/next-match', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { force, courtProgress } = req.body;
  try {
    const result = await generateNextMatch(parseInt(id as string), force, courtProgress);
    if ((result as any).error === 'BUSY_COURTS') {
      return res.status(409).json({ error: 'BUSY_COURTS', message: 'Todas las canchas están ocupadas.' });
    }
    res.json({ message: 'Partido generado', ...result });
  } catch (error: any) {
    console.error('Next Match Error:', error);
    res.status(500).json({ error: 'Error al generar partido: ' + error.message });
  }
});

// Update Tournament Status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['planned', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    await pool.query('UPDATE tournaments SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Estado del torneo actualizado' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar estado: ' + error.message });
  }
});

export default router;
