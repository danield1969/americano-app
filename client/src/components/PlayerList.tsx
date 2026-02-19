import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlayers, createPlayer, togglePlayerStatus, updatePlayer } from '../api';
import { Plus, User, UserX, Check, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './PlayerList.css';

interface Player {
  id: number;
  name: string;
  active: boolean;
}

export default function PlayerList() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const { isAdmin } = useAuth();

  const { data: players, isLoading } = useQuery({ queryKey: ['players'], queryFn: getPlayers });

  const addMutation = useMutation({
    mutationFn: createPlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setNewName('');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, active }: { id: number; name?: string; active?: boolean }) => updatePlayer(id, { name, active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setEditingId(null);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => togglePlayerStatus(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      addMutation.mutate(newName);
    }
  };

  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setEditName(player.name);
  };

  const handleUpdate = (id: number) => {
    if (editName.trim()) {
      updateMutation.mutate({ id, name: editName.trim() });
    }
  };

  if (isLoading) return <div className="loading">Cargando jugadores...</div>;

  return (
    <div className="player-list-container glass-panel">
      <div className="list-header">
        <h2>Plantilla de Jugadores</h2>
        <span className="badge">{players?.length || 0} Total</span>
      </div>

      {isAdmin && (
        <form onSubmit={handleSubmit} className="add-player-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del nuevo jugador..."
            className="input-field"
          />
          <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
            <Plus size={18} /> Agregar
          </button>
        </form>
      )}

      <div className="players-grid">
        {players?.map((player: Player) => (
          <div key={player.id} className={`player-card ${!player.active ? 'inactive' : ''}`}>
            {isAdmin && editingId !== player.id ? (
              <button
                className="action-btn edit-icon-left"
                onClick={() => startEditing(player)}
                title="Editar nombre"
              >
                <Edit2 size={16} />
              </button>
            ) : (
              <div className="edit-placeholder" />
            )}

            <div className="avatar">
              <User size={20} />
            </div>

            {editingId === player.id ? (
              <div className="edit-container">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field edit-input"
                  autoFocus
                />
                <button className="icon-btn save" onClick={() => handleUpdate(player.id)}>
                  <Save size={16} />
                </button>
                <button className="icon-btn cancel" onClick={() => setEditingId(null)}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <span className="player-name">{player.name}</span>
                {isAdmin && (
                  <div className="player-actions">
                    <button
                      className="action-btn"
                      onClick={() => toggleMutation.mutate({ id: player.id, active: !player.active })}
                      title={player.active ? "Desactivar" : "Activar"}
                    >
                      {player.active ? <Check size={16} className="text-success" /> : <UserX size={16} />}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
