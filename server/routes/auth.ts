import { Router } from 'express';
import jwt from 'jsonwebtoken';
// Environment variables are loaded in index.ts

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_fallback_123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

router.post('/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }

  res.status(401).json({ error: 'Contraseña incorrecta' });
});

export default router;
