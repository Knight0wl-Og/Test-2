import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

// GET /api/watchlists — list all groups with their symbols
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT g.id, g.name, g.color, g.position,
              COALESCE(json_agg(s.symbol ORDER BY s.position ASC, s.added_at ASC) FILTER (WHERE s.symbol IS NOT NULL), '[]') AS symbols
       FROM watchlist_groups g
       LEFT JOIN watchlist_symbols s ON s.group_id = g.id
       GROUP BY g.id
       ORDER BY g.position ASC, g.created_at ASC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/watchlists — create group
router.post('/', async (req: Request, res: Response) => {
  const { name, color = '#3b82f6' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    const result = await db.query(
      `INSERT INTO watchlist_groups (name, color, position)
       VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM watchlist_groups))
       RETURNING *`,
      [name, color]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/watchlists/:id — update group
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, color, position } = req.body;

  try {
    const result = await db.query(
      `UPDATE watchlist_groups
       SET name = COALESCE($1, name),
           color = COALESCE($2, color),
           position = COALESCE($3, position),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, color, position, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/watchlists/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.query(`DELETE FROM watchlist_groups WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Group not found' });
    res.json({ deleted: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/watchlists/:id/symbols — add symbol
router.post('/:id/symbols', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    await db.query(
      `INSERT INTO watchlist_symbols (group_id, symbol, position)
       VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM watchlist_symbols WHERE group_id = $1))
       ON CONFLICT (group_id, symbol) DO NOTHING`,
      [id, symbol.toUpperCase()]
    );
    res.status(201).json({ groupId: id, symbol: symbol.toUpperCase() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/watchlists/:id/symbols/:symbol
router.delete('/:id/symbols/:symbol', async (req: Request, res: Response) => {
  const { id, symbol } = req.params;
  try {
    await db.query(
      `DELETE FROM watchlist_symbols WHERE group_id = $1 AND symbol = $2`,
      [id, symbol.toUpperCase()]
    );
    res.json({ deleted: symbol.toUpperCase() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
