export type LeagueKey = "premier-league" | "bundesliga" | "serie-a" | "la-liga" | "ligue-1" | "brasileirao";
export type VenueFilter = "all" | "home" | "away";
export type FormResult = "W" | "D" | "L";

export type League = {
  key: LeagueKey;
  id: number;
  name: string;
  short: string;
  country: string;
  flag: string;
  teams: string[];
};

export type TeamStats = {
  id: number;
  name: string;
  logo: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  shotsOn: number | null;
  shotsOnAgainst: number | null;
  totalShots: number | null;
  corners: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  btts: number;
  over15: number;
  over25: number;
  cleanSheets: number;
  form: FormResult[];
};

export type StatsResponse = {
  mode: "demo" | "live";
  source: string;
  updatedAt: string;
  league: Omit<League, "teams">;
  season: number;
  window: number;
  venue: VenueFilter;
  coverage: number;
  teams: TeamStats[];
  notice?: string;
};

export const LEAGUES: League[] = [
  { key: "premier-league", id: 39, name: "Premier League", short: "EPL", country: "Inglaterra", flag: "GB", teams: ["Arsenal", "Aston Villa", "Brighton", "Chelsea", "Crystal Palace", "Liverpool", "Manchester City", "Manchester United", "Newcastle", "Tottenham"] },
  { key: "bundesliga", id: 78, name: "Bundesliga", short: "BUN", country: "Alemanha", flag: "DE", teams: ["Bayern München", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Eintracht Frankfurt", "Stuttgart", "Freiburg", "Wolfsburg", "Borussia M'gladbach", "Werder Bremen"] },
  { key: "serie-a", id: 135, name: "Serie A", short: "ITA", country: "Itália", flag: "IT", teams: ["Inter", "Milan", "Juventus", "Napoli", "Roma", "Lazio", "Atalanta", "Fiorentina", "Bologna", "Torino"] },
  { key: "la-liga", id: 140, name: "La Liga", short: "LAL", country: "Espanha", flag: "ES", teams: ["Real Madrid", "Barcelona", "Atlético de Madrid", "Athletic Club", "Villarreal", "Real Sociedad", "Real Betis", "Sevilla", "Valencia", "Girona"] },
  { key: "ligue-1", id: 61, name: "Ligue 1", short: "L1", country: "França", flag: "FR", teams: ["Paris Saint-Germain", "Marseille", "Monaco", "Lille", "Lyon", "Nice", "Lens", "Rennes", "Strasbourg", "Toulouse"] },
  { key: "brasileirao", id: 71, name: "Brasileirão", short: "BRA", country: "Brasil", flag: "BR", teams: ["Flamengo", "Palmeiras", "Botafogo", "Corinthians", "São Paulo", "Fluminense", "Atlético Mineiro", "Internacional", "Grêmio", "Cruzeiro"] },
];

export const CURRENT_SEASON = new Date().getFullYear();

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function noise(seed: string, min: number, max: number) {
  const raw = (hash(seed) % 10000) / 10000;
  return min + raw * (max - min);
}

function one(value: number) {
  return Math.round(value * 10) / 10;
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 5) * 5));
}

export function findLeague(key: string | null | undefined) {
  return LEAGUES.find((league) => league.key === key) ?? LEAGUES[0];
}

export function generateDemoStats(
  leagueKey: LeagueKey = "premier-league",
  window = 10,
  venue: VenueFilter = "all",
  season = CURRENT_SEASON,
): StatsResponse {
  const league = findLeague(leagueKey);
  const venueFactor = venue === "home" ? 1.08 : venue === "away" ? 0.93 : 1;
  const teams = league.teams.map((name, index): TeamStats => {
    const strength = 1.15 - index * 0.035 + noise(`${league.key}-${name}-strength`, -0.08, 0.08);
    const matches = window;
    const wins = Math.min(matches, Math.round(noise(`${name}-${window}-w`, 0.28, 0.72) * matches));
    const draws = Math.min(matches - wins, Math.round(noise(`${name}-${window}-d`, 0.12, 0.3) * matches));
    const losses = matches - wins - draws;
    const goalsFor = one(noise(`${name}-${window}-${venue}-gf`, 1.05, 2.25) * strength * venueFactor);
    const goalsAgainst = one(noise(`${name}-${window}-${venue}-ga`, 0.72, 1.7) / strength / venueFactor);
    const shotsOn = one(noise(`${name}-${window}-${venue}-sot`, 3.5, 6.8) * strength * venueFactor);
    const shotsOnAgainst = one(noise(`${name}-${window}-${venue}-sota`, 3.1, 5.9) / strength);
    const totalShots = one(shotsOn * noise(`${name}-shots-ratio`, 2.15, 2.75));
    const corners = one(noise(`${name}-${window}-corners`, 4.1, 7.2) * venueFactor);
    const fouls = one(noise(`${name}-${window}-fouls`, 8.8, 14.4));
    const yellowCards = one(noise(`${name}-${window}-yc`, 1.35, 3.15));
    const redCards = one(noise(`${name}-${window}-rc`, 0.01, 0.18));
    const btts = percent(noise(`${name}-${window}-btts`, 35, 78));
    const over25 = percent(noise(`${name}-${window}-o25`, 35, 82));
    const over15 = Math.max(over25, percent(noise(`${name}-${window}-o15`, 62, 94)));
    const cleanSheets = percent(noise(`${name}-${window}-cs`, 15, 52) * strength);
    const form: FormResult[] = Array.from({ length: Math.min(5, matches) }, (_, formIndex) => {
      const roll = noise(`${name}-${window}-form-${formIndex}`, 0, 1);
      return roll < wins / matches ? "W" : roll < (wins + draws) / matches ? "D" : "L";
    });
    return { id: league.id * 100 + index, name, logo: null, matches, wins, draws, losses, goalsFor, goalsAgainst, shotsOn, shotsOnAgainst, totalShots, corners, fouls, yellowCards, redCards, btts, over15, over25, cleanSheets, form };
  });

  return {
    mode: "demo",
    source: "Amostra simulada",
    updatedAt: new Date().toISOString(),
    league: { key: league.key, id: league.id, name: league.name, short: league.short, country: league.country, flag: league.flag },
    season,
    window,
    venue,
    coverage: 100,
    teams,
    notice: "Os números deste modo são simulados para demonstrar o painel. Configure a API para usar partidas reais.",
  };
}

export function formatMetric(value: number | null, suffix = "") {
  return value === null ? "—" : `${value.toFixed(1)}${suffix}`;
}
