import { useQuery } from '@tanstack/react-query';
import { getGlobalStats } from '../api';
import { Trophy, Medal, Target, Hash, CheckCircle } from 'lucide-react';
import './GlobalStats.css';

export default function GlobalStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['globalStats'],
    queryFn: getGlobalStats,
    refetchInterval: 10000
  });

  if (isLoading) return <div className="loading">Cargando estadísticas...</div>;

  return (
    <div className="global-stats-container glass-panel">
      <div className="stats-header">
        <Trophy size={32} className="icon-glow" />
        <h2>Ranking General de Jugadores</h2>
      </div>

      <div className="stats-table-wrapper">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Jugador</th>
              <th title="Jornadas Jugadas">JJ</th>
              <th title="Ganados">G</th>
              <th title="Perdidos">P</th>
              <th title="Efectividad (%)">% G</th>
              <th title="Promedio Puntos por Partido">Prom</th>
              <th title="Puntos a Favor">PF</th>
              <th title="Puntos en Contra">PC</th>
              <th>Puntos Total</th>
            </tr>
          </thead>
          <tbody>
            {stats?.map((player: any, idx: number) => {
              const totalMatches = (player.victories || 0) + (player.defeats || 0);
              const effectiveness = totalMatches > 0
                ? ((player.victories / totalMatches) * 100).toFixed(1)
                : '0.0';
              const pointsPerMatch = totalMatches > 0
                ? (player.total_points / totalMatches).toFixed(1)
                : '0.0';

              return (
                <tr key={player.player_id} className={idx < 3 ? 'top-rank' : ''}>
                  <td>
                    {idx === 0 && <Medal className="rank-icon gold" size={20} />}
                    {idx === 1 && <Medal className="rank-icon silver" size={20} />}
                    {idx === 2 && <Medal className="rank-icon bronze" size={20} />}
                    {idx > 2 && <span className="rank-num">{idx + 1}</span>}
                  </td>
                  <td className="player-name-cell">{player.name}</td>
                  <td>{player.tournaments_played || 0}</td>
                  <td className="victories-cell">{player.victories || 0}</td>
                  <td className="defeats-cell">{player.defeats || 0}</td>
                  <td className="effectiveness-cell">{effectiveness}%</td>
                  <td className="avg-cell">{pointsPerMatch}</td>
                  <td>{player.points_for || 0}</td>
                  <td>{player.points_against || 0}</td>
                  <td className="total-score-cell">{player.total_points || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="stats-legend">
        <div className="legend-item"><Hash size={14} /> JJ: Jornadas Jugadas</div>
        <div className="legend-item"><CheckCircle size={14} /> G/P: Ganados / Perdidos</div>
        <div className="legend-item"><Target size={14} /> % G: Efectividad (Victorias / Partidos)</div>
        <div className="legend-item"><Trophy size={14} /> Prom: Promedio de puntos por partido</div>
      </div>
    </div>
  );
}
