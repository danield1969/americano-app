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
    const winningScore = parseInt(team1Score); // Actually specific per team
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

export default router;
