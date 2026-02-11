import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Activity, Edit2, Check, RefreshCcw, MapPin } from 'lucide-react';
import './TournamentView.css';
import { getTournamentMatches, getTournamentStandings, submitMatchScore, shuffleTournament, getTournament, simulateTournament, generateNextRound } from '../api';

interface TournamentViewProps {
  tournamentId: number;
  onEdit: () => void;
}

export default function TournamentView({ tournamentId, onEdit }: TournamentViewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'matches' | 'ranking'>('matches');
  const [scores, setScores] = useState<{ [key: string]: string }>({}); // matchId_team: score

  const { data: tournamentData } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournament(tournamentId)
  });

  const { data: matchData, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches', tournamentId],
    queryFn: () => getTournamentMatches(tournamentId),
    refetchInterval: 5000
  });

  const { data: standings } = useQuery({
    queryKey: ['standings', tournamentId],
    queryFn: () => getTournamentStandings(tournamentId),
    refetchInterval: 5000
  });

  const scoreMutation = useMutation({
    mutationFn: (data: { id: number, t1: number, t2: number }) => submitMatchScore(data.id, data.t1, data.t2),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['standings', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });

      // Clear local state for this match so it follows DB
      setScores(prev => {
        const next = { ...prev };
        delete next[`${variables.id}_1`];
        delete next[`${variables.id}_2`];
        return next;
      });
    }
  });

  const shuffleMutation = useMutation({
    mutationFn: () => shuffleTournament(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      alert('Partidos revueltos con éxito');
    },
    onError: (err: any) => alert(err.response?.data?.error || 'Error al revolver partidos')
  });

  const simulateMutation = useMutation({
    mutationFn: () => simulateTournament(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['standings', tournamentId] });
      alert('Resultados simulados con éxito');
    },
    onError: (err: any) => alert(err.response?.data?.error || 'Error al simular resultados')
  });

  const nextRoundMutation = useMutation({
    mutationFn: () => generateNextRound(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      alert('Siguiente ronda generada con éxito');
    },
    onError: (err: any) => alert(err.response?.data?.error || 'Error al generar ronda')
  });


  const handleScoreChange = (matchId: number, team: 1 | 2, val: string) => {
    setScores(prev => ({ ...prev, [`${matchId}_${team}`]: val }));
  };

  const hasAnyScores = matchData?.players?.some((p: any) => p.score_obtained > 0);

  const handleSaveScore = (matchId: number) => {
    // Get latest players data from matchData to find current DB scores
    const players = getPlayersForMatch(matchId);
    const dbS1 = players.find((p: any) => p.opponent_team_id === 1)?.score_obtained || 0;
    const dbS2 = players.find((p: any) => p.opponent_team_id === 2)?.score_obtained || 0;

    const t1 = scores[`${matchId}_1`] !== undefined ? scores[`${matchId}_1`] : dbS1.toString();
    const t2 = scores[`${matchId}_2`] !== undefined ? scores[`${matchId}_2`] : dbS2.toString();

    scoreMutation.mutate({ id: matchId, t1: parseInt(t1 || '0'), t2: parseInt(t2 || '0') });
  };

  // Helper to group matches by round
  const matchesByRound = matchData?.matches?.reduce((acc: any, m: any) => {
    if (!acc[m.round_number]) acc[m.round_number] = [];
    acc[m.round_number].push(m);
    return acc;
  }, {}) || {};

  const rounds = Object.keys(matchesByRound).sort((a, b) => Number(b) - Number(a)); // Descending (newest first)

  const getPlayersForMatch = (matchId: number) => {
    return matchData?.players?.filter((p: any) => p.match_id === matchId) || [];
  };

  const handleBackWithCheck = () => {
    onEdit();
  };

  return (
    <div className="tournament-view">
      <div className="view-header">
        <div className="header-title-row">
          <div className="header-text">
            <h2 className="glow-text">Torneo en Curso #{tournamentId}</h2>
            <div className="header-subtitle">
              {tournamentData?.location && <span className="info-item"><MapPin size={14} /> {tournamentData.location}</span>}
              <span className="info-item">Jugadores: {standings?.length || 0}</span>
              <span className="info-item">Partidos/Jugador: {tournamentData?.matches_per_player || 3}</span>
            </div>
            <div className="header-subtitle stats-row">
              <span className="info-item highlight">Partidos Totales: {Math.ceil(((standings?.length || 0) * (tournamentData?.matches_per_player || 3)) / 4)}</span>
              <span className="info-item highlight">Partidos Terminados: {matchData?.matches?.filter((m: any) => {
                const p = matchData?.players?.filter((pp: any) => pp.match_id === m.id) || [];
                return p.some((pp: any) => pp.score_obtained > 0);
              }).length || 0}</span>
            </div>
            {!hasAnyScores && !matchesLoading && matchData?.matches?.length > 0 && (
              <div className="header-actions">
                <button
                  className="shuffle-btn"
                  onClick={() => {
                    if (confirm('¿Revolver todos los partidos aleatoriamente?')) shuffleMutation.mutate();
                  }}
                  disabled={shuffleMutation.isPending}
                >
                  <RefreshCcw size={14} className={shuffleMutation.isPending ? 'spin' : ''} /> Revolver Partidos
                </button>
                <button
                  className="simulate-btn"
                  onClick={() => {
                    if (confirm('¿Simular resultados aleatorios para todos los partidos?')) simulateMutation.mutate();
                  }}
                  disabled={simulateMutation.isPending}
                  style={{ marginLeft: '10px' }}
                >
                  <Trophy size={14} className={simulateMutation.isPending ? 'spin' : ''} /> Simular Resultados
                </button>
              </div>
            )}
          </div>
          <button className="edit-view-btn" onClick={handleBackWithCheck} title="Editar Jugadores / Configuración">
            <Edit2 size={20} />
          </button>
        </div>
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Activity size={18} /> Partidos
          </button>
          <button
            className={`tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            <Trophy size={18} /> Tabla de Posiciones
          </button>
        </div>
      </div>

      <div className="view-content">
        {activeTab === 'matches' && (
          <div className="matches-section">
            <div className="actions-bar" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => nextRoundMutation.mutate()}
                disabled={nextRoundMutation.isPending}
                style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
              >
                {nextRoundMutation.isPending ? 'Generando...' : 'Generar Siguiente Ronda'}
              </button>
            </div>

            {matchesLoading ? <div className="loading">Cargando partidos...</div> : (
              <div className="rounds-list">
                {rounds.length === 0 && <p className="empty-state">No hay partidos planificados.</p>}

                {rounds.map(roundNum => (
                  <div key={roundNum} className="round-block glass-panel">
                    <h3>Ronda {roundNum}</h3>
                    <div className="matches-grid">
                      {matchesByRound[roundNum].map((match: any) => {
                        const players = getPlayersForMatch(match.id);
                        const team1 = players.filter((p: any) => p.opponent_team_id === 1);
                        const team2 = players.filter((p: any) => p.opponent_team_id === 2);

                        // Check if scores already exist in DB data (for default value if not editing)
                        const dbScore1 = team1[0]?.score_obtained || 0;
                        const dbScore2 = team2[0]?.score_obtained || 0;

                        return (
                          <div key={match.id} className="match-card">
                            <div className="court-label">Cancha {match.court_number}</div>

                            <div className="match-main">
                              <div className="team-row">
                                <div className="team-info">
                                  {team1.map((p: any) => <div key={p.player_id} className="player-name">{p.name}</div>)}
                                </div>
                                <input
                                  type="number"
                                  className="score-box"
                                  placeholder="0"
                                  value={scores[`${match.id}_1`] !== undefined ? scores[`${match.id}_1`] : dbScore1}
                                  onChange={(e) => handleScoreChange(match.id, 1, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveScore(match.id)}
                                />
                              </div>

                              <div className="match-status-indicator">
                                {Number(scores[`${match.id}_1`] !== undefined ? scores[`${match.id}_1`] : dbScore1) === dbScore1 &&
                                  Number(scores[`${match.id}_2`] !== undefined ? scores[`${match.id}_2`] : dbScore2) === dbScore2 &&
                                  (dbScore1 > 0 || dbScore2 > 0) ? (
                                  <div className="save-success-icon persistent">
                                    <Check size={20} />
                                  </div>
                                ) : (
                                  <div className="vs-divider">VS</div>
                                )}
                              </div>

                              <div className="team-row">
                                <div className="team-info">
                                  {team2.map((p: any) => <div key={p.player_id} className="player-name">{p.name}</div>)}
                                </div>
                                <input
                                  type="number"
                                  className="score-box"
                                  placeholder="0"
                                  value={scores[`${match.id}_2`] !== undefined ? scores[`${match.id}_2`] : dbScore2}
                                  onChange={(e) => handleScoreChange(match.id, 2, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveScore(match.id)}
                                />
                              </div>
                            </div>

                            <div className="match-footer">
                              <button className="save-match-btn" onClick={() => handleSaveScore(match.id)}>
                                Guardar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ... ranking tab ... */}
        {activeTab === 'ranking' && (
          <div className="ranking-section glass-panel">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>PJ</th>
                  <th>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {standings?.map((p: any, idx: number) => (
                  <tr key={p.player_id}>
                    <td>{idx + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.games_played}</td>
                    <td className="points-cell">{p.current_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

