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

      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['globalStats'] });
      if (onTournamentDeleted) onTournamentDeleted(deletedId);
    },
    onError: (err: any) => alert('Error al borrar jornada: ' + (err.response?.data?.error || err.message))
  });

  const handleDelete = (e: React.MouseEvent, id: number, date: string) => {
    e.stopPropagation();
    e.preventDefault();

    const dateParts = date.split('T')[0].split('-');
    const localDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
    const formattedDate = localDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    if (window.confirm(`¿Estás seguro de que deseas eliminar la jornada del ${formattedDate}? Esta acción borrará todos los partidos y puntos asociados de forma permanente.`)) {
      deleteMutation.mutate(id);
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
                {(() => {
                  const dateParts = t.date.split('T')[0].split('-');
                  const localDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                  return localDate.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                })()}
              </span>
              <div className="t-meta">
                <span className="t-courts">{t.courts_available} canchas</span>
                <span className="t-matches">
                  {t.completed_matches || 0} / {Math.ceil(((t.player_count || 0) * (t.matches_per_player || 3)) / 4)} partidos
                </span>
                <span className="t-modality">{t.modality || '16 puntos'}</span>
              </div>
            </div>

            <div className="t-status">
              {t.status === 'completed' ? (
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

