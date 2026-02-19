import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '/api' : 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getPlayers = async () => {
  const response = await api.get('/players');
  return response.data;
};

export const createPlayer = async (name: string) => {
  const response = await api.post('/players', { name });
  return response.data;
};

export const updatePlayer = async (id: number, data: { name?: string, active?: boolean }) => {
  const response = await api.put(`/players/${id}`, data);
  return response.data;
};

export const togglePlayerStatus = async (id: number, active: boolean) => {
  return updatePlayer(id, { active });
};

export const createTournament = async (data: { date: string, location?: string, courtsAvailable: number, playerIds: number[], matchesPerPlayer: number }) => {
  const response = await api.post('/tournaments', data);
  return response.data;
};

export const getTournament = async (id: number) => {
  const response = await api.get(`/tournaments/${id}`);
  return response.data;
};

export const getTournaments = async () => {
  const response = await api.get('/tournaments');
  return response.data;
};

export const updateTournamentPlayers = async (id: number, data: { date: string, location?: string, courtsAvailable: number, playerIds: number[] }) => {
  const response = await api.put(`/tournaments/${id}/players`, data);
  return response.data;
};

export const deleteTournament = async (id: number) => {
  const response = await api.delete(`/tournaments/${id}`);
  return response.data;
};

export const getTournamentMatches = async (id: number) => {
  const response = await api.get(`/tournaments/${id}/matches`);
  return response.data;
};

export const getTournamentStandings = async (id: number) => {
  const response = await api.get(`/tournaments/${id}/standings`);
  return response.data;
};

export const generateNextRound = async (id: number) => {
  const response = await api.post(`/tournaments/${id}/next-round`);
  return response.data;
};

export const generateNextMatch = async (id: number, force: boolean = false, courtProgress?: Record<number, number>) => {
  const response = await api.post(`/tournaments/${id}/next-match`, { force, courtProgress });
  return response.data;
};

export const shuffleTournament = async (id: number) => {
  const response = await api.post(`/tournaments/${id}/shuffle`);
  return response.data;
};

export const shuffleMatch = async (id: number) => {
  const response = await api.post(`/matches/${id}/shuffle`);
  return response.data;
};

export const simulateTournament = async (id: number) => {
  const response = await api.post(`/tournaments/${id}/simulate`);
  return response.data;
};

export const submitMatchScore = async (matchId: number, team1Score: number, team2Score: number) => {
  const response = await api.post(`/matches/${matchId}/score`, { team1Score, team2Score });
  return response.data;
};

export const updateMatchPlayer = async (matchId: number, oldPlayerId: number, newPlayerId: number) => {
  const response = await api.put(`/matches/${matchId}/players`, { oldPlayerId, newPlayerId });
  return response.data;
};

export const deleteMatch = async (id: number) => {
  const response = await api.delete(`/matches/${id}`);
  return response.data;
};

export const updateTournamentStatus = async (id: number, status: 'planned' | 'in_progress' | 'completed') => {
  const response = await api.patch(`/tournaments/${id}/status`, { status });
  return response.data;
};

export const getGlobalStats = async () => {
  const response = await api.get('/players/stats/global');
  return response.data;
};

export default api;
