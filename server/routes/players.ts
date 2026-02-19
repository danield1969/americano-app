import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken } from '../middleware/auth';


const router = Router();

// Get all players
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM players ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Add player
router.post('/', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const [result] = await pool.query('INSERT INTO players (name) VALUES (?)', [name]);
    const insertId = (result as any).insertId;
    res.status(201).json({ id: insertId, name, active: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update player
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body;
  try {
    if (name !== undefined && active !== undefined) {
      await pool.query('UPDATE players SET name = ?, active = ? WHERE id = ?', [name, active, id]);
    } else if (name !== undefined) {
      await pool.query('UPDATE players SET name = ? WHERE id = ?', [name, id]);
    } else if (active !== undefined) {
      await pool.query('UPDATE players SET active = ? WHERE id = ?', [active, id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Global Stats
router.get('/stats/global', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id as player_id,
        p.name,
        (
          SELECT COUNT(DISTINCT m.tournament_id)
          FROM match_players mp
          JOIN matches m ON mp.match_id = m.id
          WHERE mp.player_id = p.id
          AND EXISTS (
            SELECT 1 FROM match_players mp2 
            WHERE mp2.match_id = m.id AND mp2.score_obtained > 0
          )
        ) as tournaments_played,
        (
          SELECT COALESCE(SUM(tp2.current_score), 0)
          FROM tournament_players tp2
          WHERE tp2.player_id = p.id
        ) as total_points,
        (
          SELECT COUNT(*) 
          FROM match_players mp
          JOIN match_players opp ON mp.match_id = opp.match_id AND mp.opponent_team_id != opp.opponent_team_id
          WHERE mp.player_id = p.id 
          AND mp.is_filler = 0
          AND mp.score_obtained > opp.score_obtained
          AND opp.player_id = (SELECT MIN(player_id) FROM match_players WHERE match_id = mp.match_id AND opponent_team_id != mp.opponent_team_id)
        ) as victories,
        (
          SELECT COUNT(*) 
          FROM match_players mp
          JOIN match_players opp ON mp.match_id = opp.match_id AND mp.opponent_team_id != opp.opponent_team_id
          WHERE mp.player_id = p.id 
          AND mp.is_filler = 0
          AND mp.score_obtained = opp.score_obtained
          AND (SELECT SUM(score_obtained) FROM match_players WHERE match_id = mp.match_id) > 0
          AND opp.player_id = (SELECT MIN(player_id) FROM match_players WHERE match_id = mp.match_id AND opponent_team_id != mp.opponent_team_id)
        ) as draws,
        (
          SELECT COUNT(*) 
          FROM match_players mp
          JOIN match_players opp ON mp.match_id = opp.match_id AND mp.opponent_team_id != opp.opponent_team_id
          WHERE mp.player_id = p.id 
          AND mp.is_filler = 0
          AND mp.score_obtained < opp.score_obtained
          AND opp.player_id = (SELECT MIN(player_id) FROM match_players WHERE match_id = mp.match_id AND opponent_team_id != mp.opponent_team_id)
        ) as defeats,
        (
          SELECT COALESCE(SUM(mp.points_won), 0)
          FROM match_players mp
          WHERE mp.player_id = p.id
          AND mp.is_filler = 0
        ) as points_for,
        (
          SELECT COALESCE(SUM(opp.points_won), 0)
          FROM match_players mp
          JOIN match_players opp ON mp.match_id = opp.match_id AND mp.opponent_team_id != opp.opponent_team_id
          WHERE mp.player_id = p.id
          AND mp.is_filler = 0
          AND opp.player_id = (SELECT MIN(player_id) FROM match_players WHERE match_id = mp.match_id AND opponent_team_id != mp.opponent_team_id)
        ) as points_against
      FROM players p
      GROUP BY p.id, p.name
      ORDER BY total_points DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
