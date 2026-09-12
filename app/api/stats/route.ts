import { NextRequest, NextResponse } from "next/server";
import {
  CURRENT_SEASON,
  LEAGUES,
  type FormResult,
  type LeagueKey,
  type StatsResponse,
  type TeamStats,
  type VenueFilter,
  findLeague,
  generateDemoStats,
} from "@/lib/football-stats";

export const dynamic = "force-dynamic";

type ApiFixture = {
  fixture: { id: number; date: string; status?: { short?: string } };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
  statistics?: Array<{
    team: { id: number };
    statistics: Array<{ type: string; value: number | string | null }>;
  }>;
};

type Accumulator = {
  id: number;
  name: string;
  logo: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  bttsCount: number;
  over15Count: number;
  over25Count: number;
  cleanSheetsCount: number;
  form: FormResult[];
  metrics: Record<string, { sum: number; count: number }>;
};

const cache = new Map<string, { expires: number; value: StatsResponse }>();
const API_BASE = "https://v3.football.api-sports.io";

function splitInto<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function statValue(fixture: ApiFixture, teamId: number, type: string) {
  const block = fixture.statistics?.find((entry) => entry.team.id === teamId);
  return numberValue(block?.statistics.find((entry) => entry.type === type)?.value);
}

function roundedAverage(metric: { sum: number; count: number } | undefined) {
  return metric?.count ? Math.round((metric.sum / metric.count) * 10) / 10 : null;
}

async function apiRequest(path: string, key: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`API-Football respondeu com HTTP ${response.status}.`);
  const data = (await response.json()) as { response?: unknown[]; errors?: Record<string, string> | string[] };
  if (data.errors && Object.keys(data.errors).length) {
    const reason = Array.isArray(data.errors) ? data.errors.join("; ") : Object.values(data.errors).join("; ");
    throw new Error(reason || "A API-Football recusou a consulta.");
  }
  return data.response ?? [];
}

function getAccumulator(store: Map<number, Accumulator>, team: { id: number; name: string; logo?: string }) {
  const existing = store.get(team.id);
  if (existing) return existing;
  const created: Accumulator = {
    id: team.id,
    name: team.name,
    logo: team.logo ?? null,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    bttsCount: 0,
    over15Count: 0,
    over25Count: 0,
    cleanSheetsCount: 0,
    form: [],
    metrics: {},
  };
  store.set(team.id, created);
  return created;
}

function addMetric(team: Accumulator, name: string, value: number | null) {
  if (value === null) return;
  team.metrics[name] ??= { sum: 0, count: 0 };
  team.metrics[name].sum += value;
  team.metrics[name].count += 1;
}

function buildTeamStats(team: Accumulator): TeamStats {
  const matches = Math.max(1, team.matches);
  const pct = (count: number) => Math.round((count / matches) * 100);
  return {
    id: team.id,
    name: team.name,
    logo: team.logo,
    matches: team.matches,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    goalsFor: Math.round((team.goalsFor / matches) * 10) / 10,
    goalsAgainst: Math.round((team.goalsAgainst / matches) * 10) / 10,
    shotsOn: roundedAverage(team.metrics.shotsOn),
    shotsOnAgainst: roundedAverage(team.metrics.shotsOnAgainst),
    totalShots: roundedAverage(team.metrics.totalShots),
    corners: roundedAverage(team.metrics.corners),
    fouls: roundedAverage(team.metrics.fouls),
    yellowCards: roundedAverage(team.metrics.yellowCards),
    redCards: roundedAverage(team.metrics.redCards),
    btts: pct(team.bttsCount),
    over15: pct(team.over15Count),
    over25: pct(team.over25Count),
    cleanSheets: pct(team.cleanSheetsCount),
    form: team.form.slice(-5),
  };
}

async function loadLiveStats(leagueKey: LeagueKey, season: number, window: number, venue: VenueFilter, key: string): Promise<StatsResponse> {
  const league = findLeague(leagueKey);
  const fixtures = (await apiRequest(`/fixtures?league=${league.id}&season=${season}&status=FT-AET-PEN`, key)) as ApiFixture[];
  const completed = fixtures
    .filter((item) => item.fixture?.id && item.teams?.home && item.teams?.away)
    .sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date));

  const selectedByTeam = new Map<number, Set<number>>();
  for (const fixture of completed) {
    for (const side of ["home", "away"] as const) {
      if (venue !== "all" && venue !== side) continue;
      const teamId = fixture.teams[side].id;
      const selected = selectedByTeam.get(teamId) ?? new Set<number>();
      if (selected.size < window) selected.add(fixture.fixture.id);
      selectedByTeam.set(teamId, selected);
    }
  }

  const fixtureIds = [...new Set([...selectedByTeam.values()].flatMap((ids) => [...ids]))];
  if (!fixtureIds.length) throw new Error("Nenhuma partida finalizada foi encontrada para esse recorte.");

  const detailed: ApiFixture[] = [];
  for (const chunk of splitInto(fixtureIds, 20)) {
    const items = (await apiRequest(`/fixtures?ids=${chunk.join("-")}`, key)) as ApiFixture[];
    detailed.push(...items);
  }
  detailed.sort((a, b) => Date.parse(a.fixture.date) - Date.parse(b.fixture.date));

  const aggregate = new Map<number, Accumulator>();
  let matchesWithStats = 0;
  for (const fixture of detailed) {
    if (fixture.statistics?.length) matchesWithStats += 1;
    const homeGoals = fixture.goals.home ?? 0;
    const awayGoals = fixture.goals.away ?? 0;
    for (const side of ["home", "away"] as const) {
      const team = fixture.teams[side];
      if (!selectedByTeam.get(team.id)?.has(fixture.fixture.id)) continue;
      const opponent = fixture.teams[side === "home" ? "away" : "home"];
      const goalsFor = side === "home" ? homeGoals : awayGoals;
      const goalsAgainst = side === "home" ? awayGoals : homeGoals;
      const entry = getAccumulator(aggregate, team);
      entry.matches += 1;
      entry.goalsFor += goalsFor;
      entry.goalsAgainst += goalsAgainst;
      if (goalsFor > goalsAgainst) { entry.wins += 1; entry.form.push("W"); }
      else if (goalsFor === goalsAgainst) { entry.draws += 1; entry.form.push("D"); }
      else { entry.losses += 1; entry.form.push("L"); }
      if (goalsFor > 0 && goalsAgainst > 0) entry.bttsCount += 1;
      if (goalsFor + goalsAgainst > 1) entry.over15Count += 1;
      if (goalsFor + goalsAgainst > 2) entry.over25Count += 1;
      if (goalsAgainst === 0) entry.cleanSheetsCount += 1;
      addMetric(entry, "shotsOn", statValue(fixture, team.id, "Shots on Goal"));
      addMetric(entry, "shotsOnAgainst", statValue(fixture, opponent.id, "Shots on Goal"));
      addMetric(entry, "totalShots", statValue(fixture, team.id, "Total Shots"));
      addMetric(entry, "corners", statValue(fixture, team.id, "Corner Kicks"));
      addMetric(entry, "fouls", statValue(fixture, team.id, "Fouls"));
      addMetric(entry, "yellowCards", statValue(fixture, team.id, "Yellow Cards"));
      addMetric(entry, "redCards", statValue(fixture, team.id, "Red Cards"));
    }
  }

  const teams = [...aggregate.values()].filter((team) => team.matches > 0).map(buildTeamStats);
  const coverage = Math.round((matchesWithStats / Math.max(1, detailed.length)) * 100);
  return {
    mode: "live",
    source: "API-Football",
    updatedAt: new Date().toISOString(),
    league: { key: league.key, id: league.id, name: league.name, short: league.short, country: league.country, flag: league.flag },
    season,
    window,
    venue,
    coverage,
    teams,
    notice: coverage < 100 ? "Algumas partidas não têm todas as métricas no provedor; campos sem cobertura aparecem como traço." : undefined,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requestedLeague = params.get("league") ?? "premier-league";
  const league = LEAGUES.some((item) => item.key === requestedLeague) ? requestedLeague as LeagueKey : "premier-league";
  const parsedWindow = Number(params.get("window") ?? 10);
  const window = [5, 10, 20].includes(parsedWindow) ? parsedWindow : 10;
  const parsedSeason = Number(params.get("season") ?? CURRENT_SEASON);
  const season = Number.isInteger(parsedSeason) && parsedSeason >= 2020 && parsedSeason <= CURRENT_SEASON + 1 ? parsedSeason : CURRENT_SEASON;
  const requestedVenue = params.get("venue");
  const venue: VenueFilter = requestedVenue === "home" || requestedVenue === "away" ? requestedVenue : "all";
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) return NextResponse.json(generateDemoStats(league, window, venue, season));

  const cacheKey = `${league}:${season}:${window}:${venue}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value);

  try {
    const value = await loadLiveStats(league, season, window, venue, apiKey);
    cache.set(cacheKey, { expires: Date.now() + 15 * 60_000, value });
    return NextResponse.json(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o provedor.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
