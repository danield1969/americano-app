import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import playersRoutes from './routes/players';
import tournamentRoutes from './routes/tournaments';
import matchesRoutes from './routes/matches';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/players', playersRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchesRoutes);


// Access frontend build from the 'public' folder
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// API routes are already defined above.
// Serve index.html for any other route (SPA support)
// Serve index.html for any other route (SPA support)
app.get(/(.*)/, (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
