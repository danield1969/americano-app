import { Users, Calendar, History, BarChart2, Zap } from 'lucide-react';
import './Home.css';

interface HomeProps {
  onNavigate: (view: 'players' | 'tournament' | 'history' | 'global') => void;
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="home-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title animate-slide-up">
            Eleva tu juego al <span className="text-gradient">siguiente nivel</span>
          </h1>
          <p className="hero-subtitle animate-slide-up-delay">
            La plataforma definitiva para gestionar torneos de tenis estilo Americano.
            <br />Organiza, puntúa y escala en el ranking global con elegancia y precisión.
          </p>
        </div>
      </section>

      <div className="main-actions-grid animate-fade-in-up">
        <button className="home-card glass-panel orange-glow" onClick={() => onNavigate('players')}>
          <div className="card-icon">
            <Users size={32} />
          </div>
          <div className="card-body">
            <h3>Gestión de Jugadores</h3>
            <p>Añade, edita y gestiona el roster de tenistas activos de tu club.</p>
          </div>
          <div className="card-footer">
            <span>Configurar comunidad</span>
            <Zap size={14} className="icon-tiny" />
          </div>
        </button>

        <button className="home-card glass-panel blue-glow" onClick={() => onNavigate('tournament')}>
          <div className="card-icon">
            <Calendar size={32} />
          </div>
          <div className="card-body">
            <h3>Nueva Jornada</h3>
            <p>Inicia un torneo hoy. Generación automática de partidos y canchas.</p>
          </div>
          <div className="card-footer">
            <span>Empezar ahora</span>
            <Zap size={14} className="icon-tiny" />
          </div>
        </button>

        <button className="home-card glass-panel purple-glow" onClick={() => onNavigate('history')}>
          <div className="card-icon">
            <History size={32} />
          </div>
          <div className="card-body">
            <h3>Historial</h3>
            <p>Revive jornadas pasadas, consulta resultados y borra registros.</p>
          </div>
          <div className="card-footer">
            <span>Ver registros</span>
            <Zap size={14} className="icon-tiny" />
          </div>
        </button>

        <button className="home-card glass-panel green-glow" onClick={() => onNavigate('global')}>
          <div className="card-icon">
            <BarChart2 size={32} />
          </div>
          <div className="card-body">
            <h3>Ranking Global</h3>
            <p>El salón de la fama. Consulta quién lidera las estadísticas totales.</p>
          </div>
          <div className="card-footer">
            <span>Ver el podio</span>
            <Zap size={14} className="icon-tiny" />
          </div>
        </button>
      </div>

      <footer className="home-footer animate-fade-in">
      </footer>
    </div>
  );
}
