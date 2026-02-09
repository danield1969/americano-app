import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Trophy, Users, Calendar, History, BarChart2, Menu as MenuIcon, X, Home as HomeIcon } from 'lucide-react'
import Home from './components/Home'
import PlayerList from './components/PlayerList'
import TournamentSetup from './components/TournamentSetup'
import TournamentView from './components/TournamentView'
import TournamentHistory from './components/TournamentHistory'
import GlobalStats from './components/GlobalStats'
import './App.css'

const queryClient = new QueryClient();

type View = 'home' | 'players' | 'tournament' | 'history' | 'global';

function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    // Check 4-hour rule
    const lastVisit = localStorage.getItem('americano_last_visit');
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;

    if (!lastVisit || (now - parseInt(lastVisit)) > fourHours) {
      return 'home';
    }
    return (localStorage.getItem('americano_view') as View) || 'home';
  });

  const [activeTournamentId, setActiveTournamentId] = useState<number | null>(() => {
    const saved = localStorage.getItem('americano_tournament_id');
    return saved ? parseInt(saved) : null;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Persistence & Visit Tracking
  useEffect(() => {
    localStorage.setItem('americano_view', currentView);
    localStorage.setItem('americano_last_visit', Date.now().toString());
  }, [currentView]);

  useEffect(() => {
    if (activeTournamentId) {
      localStorage.setItem('americano_tournament_id', activeTournamentId.toString());
    } else {
      localStorage.removeItem('americano_tournament_id');
    }
  }, [activeTournamentId]);

  const handleSelectTournament = (id: number) => {
    setActiveTournamentId(id);
    setCurrentView('tournament');
    setIsEditing(false);
  };

  const navigateTo = (view: View) => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        <header className="main-header glass-panel">
          <div className="header-brand" onClick={() => navigateTo('home')} style={{ cursor: 'pointer' }}>
            <img src="/logo.png" alt="Tenis Club Logo" className="header-logo" />
            <div className="header-title">
              <span className="title-main">Tenis Club Puerto Azul</span>
              <span className="title-sub">6ª Master B</span>
            </div>
          </div>

          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
          >
            {isMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
          </button>

          <nav className={isMenuOpen ? 'mobile-open' : ''}>
            <button
              className={`nav-btn ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => navigateTo('home')}
            >
              <HomeIcon size={18} /> Inicio
            </button>
            <button
              className={`nav-btn ${currentView === 'players' ? 'active' : ''}`}
              onClick={() => navigateTo('players')}
            >
              <Users size={18} /> Jugadores
            </button>
            <button
              className={`nav-btn ${currentView === 'tournament' && !activeTournamentId ? 'active' : ''}`}
              onClick={() => {
                setActiveTournamentId(null);
                navigateTo('tournament');
                setIsEditing(false);
              }}
            >
              <Calendar size={18} /> Nueva
            </button>
            {activeTournamentId && (
              <button
                className={`nav-btn ${currentView === 'tournament' && activeTournamentId && !isEditing ? 'active' : ''}`}
                onClick={() => {
                  navigateTo('tournament');
                  setIsEditing(false);
                }}
              >
                <Trophy size={18} /> En curso
              </button>
            )}
            <button
              className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => navigateTo('history')}
            >
              <History size={18} /> Historial
            </button>
            <button
              className={`nav-btn global-btn ${currentView === 'global' ? 'active' : ''}`}
              onClick={() => navigateTo('global')}
            >
              <BarChart2 size={18} /> Global
            </button>
          </nav>
        </header>

        <main className="content-area">
          {currentView === 'home' && <Home onNavigate={navigateTo} />}

          {currentView === 'players' && <PlayerList />}

          {currentView === 'tournament' && (
            isEditing || !activeTournamentId ? (
              <TournamentSetup
                existingTournamentId={activeTournamentId}
                onTournamentStarted={(id) => {
                  setActiveTournamentId(id);
                  setIsEditing(false);
                }}
                onCancel={activeTournamentId ? () => setIsEditing(false) : undefined}
              />
            ) : (
              <TournamentView
                tournamentId={activeTournamentId}
                onEdit={() => setIsEditing(true)}
              />
            )
          )}

          {currentView === 'history' && (
            <TournamentHistory
              onSelectTournament={handleSelectTournament}
              onTournamentDeleted={(id) => {
                if (activeTournamentId === id) {
                  setActiveTournamentId(null);
                }
              }}
            />
          )}

          {currentView === 'global' && (
            <GlobalStats />
          )}
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App
