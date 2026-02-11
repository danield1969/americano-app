import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTournaments, deleteTournament } from '../api';
import { Calendar, ChevronRight, CheckCircle, PlayCircle, Trash2 } from 'lucide-react';
import './TournamentHistory.css';

interface TournamentHistoryProps {
  onSelectTournament: (id: number) => void;
  onTournamentDeleted?: (id: number) => void;
}

export default function TournamentHistory({ onSelectTournament, onTournamentDeleted }: TournamentHistoryProps) {
  const queryClient = useQueryClient();
  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: getTournaments
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTournament(id),
    onSuccess: (_, deletedId) => {
      console.log('Jornada eliminada con éxito:', deletedId);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['globalStats'] });
      if (onTournamentDeleted) onTournamentDeleted(deletedId);
    },
    onError: (err: any) => alert('Error al borrar jornada: ' + (err.response?.data?.error || err.message))
  });

  const handleDelete = (e: React.MouseEvent, id: number, date: string) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Botón borrar presionado para ID:', id);
    const formattedDate = new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    if (window.confirm(`¿Estás seguro de que deseas eliminar la jornada del ${formattedDate}? Esta acción borrará todos los partidos y puntos asociados de forma permanente.`)) {
      console.log('Confirmación aceptada. Llamando a mutation...');
      deleteMutation.mutate(id);
    } else {
      console.log('Eliminación cancelada por el usuario');
    }
  };

  if (isLoading) return <div className="loading">Cargando historial...</div>;

  return (
    <div className="history-container glass-panel">
      <div className="history-header">
        <Calendar size={24} className="icon-inline" />
        <h2>Historial de Jornadas</h2>
      </div>

      <div className="tournament-list">
        {tournaments?.map((t: any) => (
          <div
            key={t.id}
            className="tournament-card glass-panel"
            onClick={() => onSelectTournament(t.id)}
          >
            <div className="t-info">
              <span className="t-location">{t.location || `Torneo #${t.id}`}</span>
              <span className="t-date">
                {new Date(t.date).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <div className="t-meta">
                <span className="t-courts">{t.courts_available} canchas</span>
                <span className="t-matches">
                  {t.completed_matches || 0} / {Math.ceil(((t.player_count || 0) * (t.matches_per_player || 3)) / 4)} partidos
                </span>
              </div>
            </div>

            <div className="t-status">
              {(t.completed_matches || 0) >= Math.ceil(((t.player_count || 0) * (t.matches_per_player || 3)) / 4) ? (
                <span className="status-badge completed">
                  <CheckCircle size={14} /> Finalizado
                </span>
              ) : (
                <span className="status-badge progress">
                  <PlayCircle size={14} /> En curso
                </span>
              )}

              <button
                className="delete-history-btn"
                onClick={(e) => handleDelete(e, t.id, t.date)}
                disabled={deleteMutation.isPending}
                title="Eliminar Jornada"
              >
                <Trash2 size={18} />
              </button>

              <ChevronRight size={20} className="chevron" />
            </div>
          </div>
        ))}

        {(!tournaments || tournaments.length === 0) && (
          <div className="empty-history">No se han registrado jornadas todavía.</div>
        )}
      </div>
    </div>
  );
}

