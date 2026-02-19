import React, { useState } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { loginAdmin } from '../api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await loginAdmin(password);
      login(data.token);
      onClose();
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="modal-content glass-panel animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Lock className="text-gradient" size={24} style={{ marginRight: '10px' }} />
            <h2>Acceso Administrador</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p style={{ color: '#7f8895' }}>
            Introduce la contraseña para habilitar las funciones de edición.
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoFocus
            className="glass-input"
            required
          />

          {error && (
            <div className="error-message animate-shake" style={{ marginTop: '15px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="submit"
              className="action-btn primary-btn"
              disabled={isLoading}
              style={{ padding: '0.8rem 3rem', width: 'auto', minWidth: '160px' }}
            >
              {isLoading ? 'Verificando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
