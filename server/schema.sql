CREATE DATABASE IF NOT EXISTS americano_db;
USE americano_db;

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  location VARCHAR(255),
  courts_available INT NOT NULL,
  matches_per_player INT NOT NULL DEFAULT 3,
  modality VARCHAR(50) DEFAULT '16 puntos',
  status ENUM('planned', 'in_progress', 'completed') DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id INT,
  player_id INT,
  current_score INT DEFAULT 0,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT,
  round_number INT NOT NULL,
  court_number INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id INT,
  player_id INT,
  partner_id INT,
  opponent_team_id INT COMMENT 'Artificial ID (1 or 2) to group partners',
  score_obtained INT DEFAULT 0,
  points_won INT DEFAULT 0,
  is_filler BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (match_id, player_id)
);
