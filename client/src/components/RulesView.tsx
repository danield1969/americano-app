import { BookOpen, Target, Users, Award } from 'lucide-react';
import './RulesView.css';

export default function RulesView() {
  return (
    <div className="rules-container animate-fade-in">
      <header className="rules-header glass-panel">
        <h1><BookOpen className="header-icon" /> Reglamento y Funcionamiento</h1>
        <p>Guía detallada sobre las modalidades de juego y el sistema de emparejamiento.</p>
      </header>

      <div className="rules-grid">
        <section className="rules-section glass-panel">
          <div className="section-title">
            <Target className="section-icon" />
            <h2>Modalidades de Puntuación</h2>
          </div>
          <div className="modality-card">
            <h3>Modalidad 16 Puntos</h3>
            <p>Es el formato estándar donde los puntos de cada partido suman directamente al ranking individual.</p>
            <ul>
              <li>Los partidos se juegan hasta completar un total de 16 puntos entre ambos equipos.</li>
              <li>Ejemplo: Un resultado de 9-7 otorga 9 puntos a los ganadores y 7 a los perdedores.</li>
              <li>La suma máxima permitida por partido es estrictamente 16.</li>
            </ul>
          </div>

          <div className="modality-card">
            <h3>Modalidad 4 Games</h3>
            <p>Diseñada para partidos por sets cortos. Los resultados se normalizan a una escala de 16 para mantener la consistencia en el ranking global.</p>
            <div className="conversion-table">
              <div className="table-header">Resultado Games</div>
              <div className="table-header">Puntos Ranking</div>

              <div className="table-row"><span>4 - 0</span> <span className="arrow">→</span> <span>16 - 0</span></div>
              <div className="table-row"><span>4 - 1</span> <span className="arrow">→</span> <span>13 - 3</span></div>
              <div className="table-row"><span>4 - 2</span> <span className="arrow">→</span> <span>10 - 6</span></div>
              <div className="table-row"><span>4 - 3</span> <span className="arrow">→</span> <span>9 - 7</span></div>
            </div>
            <p className="note">Métricas: Si el partido termina con otra puntuación, se aplica la fórmula: <code>(Games Ganados / Games Totales) * 16</code>.</p>
          </div>
        </section>

        <section className="rules-section glass-panel">
          <div className="section-title">
            <Users className="section-icon" />
            <h2>Sistema de Emparejamiento</h2>
          </div>
          <div className="matchmaking-rules">
            <div className="rule-item">
              <div className="rule-content">
                <h4>1. Rotación y Equidad</h4>
                <p>El sistema prioriza automáticamente a los jugadores con menos partidos jugados para asegurar que todos completen el torneo por igual.</p>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-content">
                <h4>2. Variedad de Parejas</h4>
                <p>Se intenta no repetir una pareja de compañeros, para que juegues con personas diferentes en cada ronda.</p>
              </div>
            </div>

            <div className="rule-item">
              <div className="rule-content">
                <h4>3. Diversidad de Rivales</h4>
                <p>El algoritmo también busca minimizar los enfrentamientos repetidos contra los mismos oponentes durante la jornada.</p>
              </div>
            </div>
          </div>

          <div className="filler-notice">
            <div className="section-title">
              <Award className="section-icon" />
              <h3>Partidos de Complemento (C)</h3>
            </div>
            <p>
              Cuando el número de asistentes no es múltiplo de 4, algunos jugadores podrían jugar un partido adicional para que nadie se quede sin jugar.
            </p>
            <p className="highlight-text">
              Estos jugadores se marcan con una <strong>(C)</strong> en la pantalla. Los puntos obtenidos en estos partidos NO se suman a su ranking personal para no generar ventajas injustas.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
