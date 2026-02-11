import { Router } from 'express';
import pool from '../config/database';
import { generateTournamentPlan, generateRound } from '../services/matchmaker';

const router = Router();

// Create Tournament
router.post('/', async (req, res) => {
  const { date, location, courtsAvailable, playerIds, matchesPerPlayer } = req.body;

  if (!date || !courtsAvailable || !playerIds || playerIds.length < 8) {
    return res.status(400).json({ error: 'Invalid data. Need date, courts, and at least 8 players.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create Tournament
    const [tResult] = await connection.query(
      'INSERT INTO tournaments (date, location, courts_available, matches_per_player, status) VALUES (?, ?, ?, ?, ?)',
      [date, location || null, courtsAvailable, matchesPerPlayer || 3, 'in_progress']
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
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to create tournament' });
  } finally {
    connection.release();
  }
});

// List Tournaments
router.get('/', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Intentando eliminar torneo con ID: ${id}`);
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
    console.log(`Torneo ${id} eliminado con éxito de la DB`);
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
router.put('/:id/players', async (req, res) => {
  const { id } = req.params;
  const { date, location, courtsAvailable, playerIds } = req.body;

  if (!playerIds || playerIds.length < 8) {
    return res.status(400).json({ error: 'Mínimo 8 jugadores requeridos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update basic tournament info
    await connection.query(
      'UPDATE tournaments SET date = ?, location = ?, courts_available = ? WHERE id = ?',
      [date, location || null, courtsAvailable, id]
    );

    // 2. Replace players
    await connection.query('DELETE FROM tournament_players WHERE tournament_id = ?', [id]);
    const playerValues = playerIds.map((pid: number) => [id, pid, 0]);
    await connection.query(
      'INSERT INTO tournament_players (tournament_id, player_id, current_score) VALUES ?',
      [playerValues]
    );

    await connection.commit();
    res.json({ message: 'Torneo actualizado correctamente' });
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
router.post('/:id/shuffle', async (req, res) => {
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
    await generateTournamentPlan(parseInt(id), matchesPerPlayer);

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
router.post('/:id/simulate', async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    // 1. First, make sure all rounds are generated
    const [tRows] = await connection.query('SELECT matches_per_player FROM tournaments WHERE id = ?', [id]);
    if ((tRows as any[]).length === 0) throw new Error('Tournament not found');
    const matchesPerPlayer = (tRows as any)[0].matches_per_player;

    // Generate all remaining matches
    await generateTournamentPlan(parseInt(id), matchesPerPlayer);

    await connection.beginTransaction();

    // 2. Get all matches (including newly generated)
    const [matches] = await connection.query('SELECT id FROM matches WHERE tournament_id = ?', [id]);

    for (const match of (matches as any[])) {
      const [scores] = await connection.query('SELECT score_obtained FROM match_players WHERE match_id = ? AND score_obtained > 0', [match.id]);
      if ((scores as any[]).length === 0) {
        const s1 = Math.floor(Math.random() * 17);
        const s2 = 16 - s1;
        await connection.query('UPDATE match_players SET score_obtained = ? WHERE match_id = ? AND opponent_team_id = 1', [s1, match.id]);
        await connection.query('UPDATE match_players SET score_obtained = ? WHERE match_id = ? AND opponent_team_id = 2', [s2, match.id]);
      }
    }

    // 3. Recalculate all standings
    const [players] = await connection.query('SELECT player_id FROM tournament_players WHERE tournament_id = ?', [id]);
    for (const p of (players as any[])) {
      const [sumRow] = (await connection.query(`
            SELECT SUM(score_obtained) as total 
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
router.post('/:id/next-round', async (req, res) => {
  const { id } = req.params;
  try {
    const matches = await generateRound(parseInt(id));
    res.json({ message: 'Siguiente ronda generada', matches });
  } catch (error: any) {
    console.error('Next Round Error:', error);
    res.status(500).json({ error: 'Error al generar ronda: ' + error.message });
  }
});

export default router;
