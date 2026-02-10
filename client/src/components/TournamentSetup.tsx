import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getPlayers, createTournament, getTournament, getTournamentStandings, updateTournamentPlayers } from '../api';
import { Calendar, Map } from 'lucide-react';
import './TournamentSetup.css';

interface TournamentSetupProps {
  onTournamentStarted: (id: number) => void;
  existingTournamentId?: number | null;
  onCancel?: () => void;
}

export default function TournamentSetup({
  onTournamentStarted,
  existingTournamentId,
  onCancel
}: TournamentSetupProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [courts, setCourts] = useState(2);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(3);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  const { data: players } = useQuery({ queryKey: ['players'], queryFn: getPlayers });

  // Load existing tournament if editing
  const { data: tournamentData } = useQuery({
    queryKey: ['tournament', existingTournamentId],
    queryFn: () => getTournament(existingTournamentId!),
    enabled: !!existingTournamentId,
  });

  const { data: standingsData } = useQuery({
    queryKey: ['standings', existingTournamentId],
    queryFn: () => getTournamentStandings(existingTournamentId!),
    enabled: !!existingTournamentId,
  });

  useEffect(() => {
    if (tournamentData) {
      setDate(tournamentData.date.split('T')[0]);
      setLocation(tournamentData.location || '');
      setCourts(tournamentData.courts_available);
      setMatchesPerPlayer(tournamentData.matches_per_player || 3);
    }
  }, [tournamentData]);

  useEffect(() => {
    if (standingsData) {
      setSelectedPlayers(standingsData.map((p: any) => p.player_id));
    }
  }, [standingsData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => existingTournamentId
      ? updateTournamentPlayers(existingTournamentId, data)
      : createTournament(data),
    onSuccess: (data: any) => {
      onTournamentStarted(existingTournamentId || data.id);
    },
    onError: (err: any) => {
      console.error('Mutation Error:', err);
      const serverError = err.response?.data?.error;
      alert(serverError ? `Error: ${serverError}` : 'Error procesando torneo');
    }
  });

  const togglePlayer = (id: number) => {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (players) {
      // If all selected, deselect all. Else select all.
      if (selectedPlayers.length === players.length) {
        setSelectedPlayers([]);
      } else {
        setSelectedPlayers(players.map((p: any) => p.id));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      alert('Por favor ingrese el lugar de la jornada.');
      return;
    }
    createMutation.mutate({
      date,
      location,
      courtsAvailable: courts,
      matchesPerPlayer,
      playerIds: selectedPlayers
    });
  };

  return (
    <div className="setup-container glass-panel">
      <div className="setup-header">
        <h2><Calendar className="icon-inline" /> {existingTournamentId ? 'Editar Jornada' : 'Nueva Jornada'}</h2>
        {onCancel && (
          <button className="text-btn" onClick={onCancel}>Cancelar</button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group-row">
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Lugar</label>
            <div className="input-with-icon">
              <Map size={18} />
              <input
                type="text"
                placeholder="Ej. Puerto Azul"
                className="input-field"
                value={location}
                required
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="form-group-row">
          <div className="form-group">
            <label>Canchas</label>
            <input
              type="number"
              className="input-field"
              value={courts}
              onChange={e => setCourts(Number(e.target.value))}
              min={1} max={10}
            />
          </div>

          {!existingTournamentId && (
            <div className="form-group">
              <label>Partidos por jugador</label>
              <input
                type="number"
                className="input-field"
                value={matchesPerPlayer}
                onChange={e => setMatchesPerPlayer(Number(e.target.value))}
                min={1} max={15}
              />
            </div>
          )}
        </div>

        <div className="players-selection">
          <div className="selection-header">
            <label>Seleccionar Asistentes ({selectedPlayers.length})</label>
            <button type="button" className="text-btn" onClick={handleSelectAll}>
              {players && selectedPlayers.length === players.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div className="checklist-grid">
            {players?.map((p: any) => (
              <label key={p.id} className={`checklist-item ${selectedPlayers.includes(p.id) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(p.id)}
                  onChange={() => togglePlayer(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary full-width"
          disabled={selectedPlayers.length < 8 || createMutation.isPending}
        >
          {createMutation.isPending ? 'Procesando...' : (existingTournamentId ? 'Actualizar Jugadores' : 'Comenzar Torneo')}
        </button>
        {selectedPlayers.length < 8 && <p className="warning-text">Mínimo 8 jugadores requeridos.</p>}
        <p className="info-rule-text">Se podrá agregar o quitar jugadores siempre y cuando no se haya completado la primera ronda de partidos. Si ya todos los jugadores presentes jugaron su primer juego no se podrá incluir ningún otro jugador.</p>
      </form>
    </div>
  );
}
