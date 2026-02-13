import { Router } from 'express';
import pool from '../config/database';
import { shuffleSingleMatch } from '../services/matchmaker';

const router = Router();

// Shuffle Match
router.post('/:id/shuffle', async (req, res) => {
  const { id } = req.params;
  try {
    await shuffleSingleMatch(parseInt(id));
    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Error al revolver el partido' });
  }
});

// Submit Score
router.post('/:id/score', async (req, res) => {
  const { id } = req.params;
  const { team1Score, team2Score } = req.body;

  if (team1Score === undefined || team2Score === undefined) {
    return res.status(400).json({ error: 'Scores required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get Match Players
    const [players] = await connection.query('SELECT player_id, opponent_team_id FROM match_players WHERE match_id = ?', [id]);

    // 2. Update match_players score
    const t1Score = parseInt(team1Score);
    const t2Score = parseInt(team2Score);

    // Update Scores 
    // Team 1 gets t1Score
    await connection.query('UPDATE match_players SET score_obtained = ? WHERE match_id = ? AND opponent_team_id = 1', [t1Score, id]);
    // Team 2 gets t2Score
    await connection.query('UPDATE match_players SET score_obtained = ? WHERE match_id = ? AND opponent_team_id = 2', [t2Score, id]);

    // 3. Update Tournament Leaderboard (Accumulator)
    // Get tournament_id once before the loop
    const [mRow] = (await connection.query('SELECT tournament_id FROM matches WHERE id = ?', [id])) as any;
    if (mRow.length === 0) throw new Error('Match not found');
    const tournamentId = mRow[0].tournament_id;

    // For each player in this match, recalculate their total score in this tournament
    for (const p of (players as any[])) {
      const [sumRow] = (await connection.query(`
            SELECT SUM(score_obtained) as total 
            FROM match_players mp 
            JOIN matches m ON mp.match_id = m.id 
            WHERE mp.player_id = ? AND m.tournament_id = ? AND mp.is_filler = 0
        `, [p.player_id, tournamentId])) as any;

      const newTotal = sumRow[0].total || 0;

      await connection.query('UPDATE tournament_players SET current_score = ? WHERE player_id = ? AND tournament_id = ?', [newTotal, p.player_id, tournamentId]);
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    connection.release();
  }
});

// Update Individual Match Player
router.put('/:id/players', async (req, res) => {
  const { id } = req.params;
  const { oldPlayerId, newPlayerId } = req.body;

  if (!oldPlayerId || !newPlayerId) {
    return res.status(400).json({ error: 'oldPlayerId and newPlayerId are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if new player is already in the match
    const [existing] = (await connection.query(
      'SELECT player_id FROM match_players WHERE match_id = ? AND player_id = ?',
      [id, newPlayerId]
    )) as any;

    if (existing.length > 0) {
      throw new Error('El jugador ya está en este partido');
    }

    // 1. Get tournament info to check matches_per_player
    const [mRow] = (await connection.query('SELECT tournament_id FROM matches WHERE id = ?', [id])) as any;
    const tournamentId = mRow[0].tournament_id;
    const [tRow] = (await connection.query('SELECT matches_per_player FROM tournaments WHERE id = ?', [tournamentId])) as any;
    const matchesPerPlayer = tRow[0].matches_per_player;

    // 2. Count matches already played by the NEW player in this tournament (excluding this match if it were already there, but we checked it isn't)
    const [countRow] = (await connection.query(`
      SELECT COUNT(*) as count 
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.id
      WHERE mp.player_id = ? AND m.tournament_id = ?
    `, [newPlayerId, tournamentId])) as any;
    const gamesPlayed = countRow[0].count;
    const isFiller = gamesPlayed >= matchesPerPlayer;

    // 3. Update the player itself and its filler status
    await connection.query(
      'UPDATE match_players SET player_id = ?, is_filler = ? WHERE match_id = ? AND player_id = ?',
      [newPlayerId, isFiller ? 1 : 0, id, oldPlayerId]
    );

    // 4. Update the partner reference in the other row (the one that had oldPlayerId as partner)
    await connection.query(
      'UPDATE match_players SET partner_id = ? WHERE match_id = ? AND partner_id = ?',
      [newPlayerId, id, oldPlayerId]
    );

    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message || 'Error updating player' });
  } finally {
    connection.release();
  }
});

// Delete Match
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get match info (tournament and players) before deleting
    const [mRow] = (await connection.query('SELECT tournament_id FROM matches WHERE id = ?', [id])) as any;
    if (mRow.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Match not found' });
    }
    const tournamentId = mRow[0].tournament_id;

    const [players] = await connection.query('SELECT player_id FROM match_players WHERE match_id = ?', [id]);

    // 2. Delete match players first (if no cascade) and then the match
    await connection.query('DELETE FROM match_players WHERE match_id = ?', [id]);
    await connection.query('DELETE FROM matches WHERE id = ?', [id]);

    // 3. Recalculate standings for the affected players
    for (const p of (players as any[])) {
      const [sumRow] = (await connection.query(`
            SELECT SUM(mp.score_obtained) as total 
            FROM match_players mp 
            JOIN matches m ON mp.match_id = m.id 
            WHERE mp.player_id = ? AND m.tournament_id = ? AND mp.is_filler = 0
        `, [p.player_id, tournamentId])) as any;

      const newTotal = sumRow[0].total || 0;
      await connection.query(
        'UPDATE tournament_players SET current_score = ? WHERE player_id = ? AND tournament_id = ?',
        [newTotal, p.player_id, tournamentId]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    connection.release();
  }
});

export default router;
