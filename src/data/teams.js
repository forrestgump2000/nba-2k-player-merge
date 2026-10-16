// NBA teams: slug -> display info. Conference is used for All-Star and playoff seeding.
export const TEAMS = {
  'atlanta-hawks': { name: 'Atlanta Hawks', city: 'Atlanta', nick: 'Hawks', abbr: 'ATL', conf: 'East', color: '#e03a3e' },
  'boston-celtics': { name: 'Boston Celtics', city: 'Boston', nick: 'Celtics', abbr: 'BOS', conf: 'East', color: '#007a33' },
  'brooklyn-nets': { name: 'Brooklyn Nets', city: 'Brooklyn', nick: 'Nets', abbr: 'BKN', conf: 'East', color: '#d9d9d9' },
  'charlotte-hornets': { name: 'Charlotte Hornets', city: 'Charlotte', nick: 'Hornets', abbr: 'CHA', conf: 'East', color: '#00788c' },
  'chicago-bulls': { name: 'Chicago Bulls', city: 'Chicago', nick: 'Bulls', abbr: 'CHI', conf: 'East', color: '#ce1141' },
  'cleveland-cavaliers': { name: 'Cleveland Cavaliers', city: 'Cleveland', nick: 'Cavaliers', abbr: 'CLE', conf: 'East', color: '#860038' },
  'dallas-mavericks': { name: 'Dallas Mavericks', city: 'Dallas', nick: 'Mavericks', abbr: 'DAL', conf: 'West', color: '#00538c' },
  'denver-nuggets': { name: 'Denver Nuggets', city: 'Denver', nick: 'Nuggets', abbr: 'DEN', conf: 'West', color: '#fec524' },
  'detroit-pistons': { name: 'Detroit Pistons', city: 'Detroit', nick: 'Pistons', abbr: 'DET', conf: 'East', color: '#c8102e' },
  'golden-state-warriors': { name: 'Golden State Warriors', city: 'Golden State', nick: 'Warriors', abbr: 'GSW', conf: 'West', color: '#ffc72c' },
  'houston-rockets': { name: 'Houston Rockets', city: 'Houston', nick: 'Rockets', abbr: 'HOU', conf: 'West', color: '#ce1141' },
  'indiana-pacers': { name: 'Indiana Pacers', city: 'Indiana', nick: 'Pacers', abbr: 'IND', conf: 'East', color: '#fdbb30' },
  'los-angeles-clippers': { name: 'LA Clippers', city: 'LA', nick: 'Clippers', abbr: 'LAC', conf: 'West', color: '#1d428a' },
  'los-angeles-lakers': { name: 'Los Angeles Lakers', city: 'Los Angeles', nick: 'Lakers', abbr: 'LAL', conf: 'West', color: '#fdb927' },
  'memphis-grizzlies': { name: 'Memphis Grizzlies', city: 'Memphis', nick: 'Grizzlies', abbr: 'MEM', conf: 'West', color: '#5d76a9' },
  'miami-heat': { name: 'Miami Heat', city: 'Miami', nick: 'Heat', abbr: 'MIA', conf: 'East', color: '#98002e' },
  'milwaukee-bucks': { name: 'Milwaukee Bucks', city: 'Milwaukee', nick: 'Bucks', abbr: 'MIL', conf: 'East', color: '#00471b' },
  'minnesota-timberwolves': { name: 'Minnesota Timberwolves', city: 'Minnesota', nick: 'Timberwolves', abbr: 'MIN', conf: 'West', color: '#236192' },
  'new-orleans-pelicans': { name: 'New Orleans Pelicans', city: 'New Orleans', nick: 'Pelicans', abbr: 'NOP', conf: 'West', color: '#85714d' },
  'new-york-knicks': { name: 'New York Knicks', city: 'New York', nick: 'Knicks', abbr: 'NYK', conf: 'East', color: '#f58426' },
  'oklahoma-city-thunder': { name: 'Oklahoma City Thunder', city: 'Oklahoma City', nick: 'Thunder', abbr: 'OKC', conf: 'West', color: '#007ac1' },
  'orlando-magic': { name: 'Orlando Magic', city: 'Orlando', nick: 'Magic', abbr: 'ORL', conf: 'East', color: '#0077c0' },
  'philadelphia-76ers': { name: 'Philadelphia 76ers', city: 'Philadelphia', nick: '76ers', abbr: 'PHI', conf: 'East', color: '#006bb6' },
  'phoenix-suns': { name: 'Phoenix Suns', city: 'Phoenix', nick: 'Suns', abbr: 'PHX', conf: 'West', color: '#e56020' },
  'portland-trail-blazers': { name: 'Portland Trail Blazers', city: 'Portland', nick: 'Trail Blazers', abbr: 'POR', conf: 'West', color: '#e03a3e' },
  'sacramento-kings': { name: 'Sacramento Kings', city: 'Sacramento', nick: 'Kings', abbr: 'SAC', conf: 'West', color: '#5a2d81' },
  'san-antonio-spurs': { name: 'San Antonio Spurs', city: 'San Antonio', nick: 'Spurs', abbr: 'SAS', conf: 'West', color: '#c4ced4' },
  'toronto-raptors': { name: 'Toronto Raptors', city: 'Toronto', nick: 'Raptors', abbr: 'TOR', conf: 'East', color: '#ce1141' },
  'utah-jazz': { name: 'Utah Jazz', city: 'Utah', nick: 'Jazz', abbr: 'UTA', conf: 'West', color: '#753bbd' },
  'washington-wizards': { name: 'Washington Wizards', city: 'Washington', nick: 'Wizards', abbr: 'WAS', conf: 'East', color: '#e31837' },
};

export const FA_TEAM = { name: 'Free Agent', city: '', nick: 'Free Agent', abbr: 'FA', conf: '', color: '#8a8f98' };
export const team = (id) => TEAMS[id] || FA_TEAM;
export const TEAM_IDS = Object.keys(TEAMS);
