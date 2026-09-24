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
} from "@/lib/football-stats";

export const dynamic = "force-dynamic";

type EspnTeam = { id?: string; displayName?: string; logo?: string };
type EspnStatistic = { name?: string; displayValue?: string };
type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: EspnTeam;
  statistics?: EspnStatistic[];
};
type EspnDetail = {
  team?: { id?: string };
  yellowCard?: boolean;
  redCard?: boolean;
};
type EspnEvent = {
  id?: string;
  date?: string;
  season?: { year?: number };
  status?: { type?: { completed?: boolean; name?: string } };
  competitions?: Array<{ competitors?: EspnCompetitor[]; details?: EspnDetail[] }>;
};
type EspnScoreboard = { events?: EspnEvent[] };

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

const CACHE_TTL = 15 * 60_000;
const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_LEAGUES: Record<LeagueKey, string> = {
  "premier-league": "eng.1",
  bundesliga: "ger.1",
  "serie-a": "ita.1",
  "la-liga": "esp.1",
  "ligue-1": "fra.1",
  brasileirao: "bra.1",
};

const responseCache = new Map<string, { expires: number; value: StatsResponse }>();
const scoreboardCache = new Map<string, { expires: number; value: EspnEvent[] }>();

function numberValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function numericTeamId(team: EspnTeam | undefined) {
  const parsed = Number(team?.id);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function competitorFor(event: EspnEvent, side: "home" | "away") {
  return event.competitions?.[0]?.competitors?.find((competitor) => competitor.homeAway === side);
}

function statValue(competitor: EspnCompetitor | undefined, name: string) {
  return numberValue(competitor?.statistics?.find((stat) => stat.name === name)?.displayValue);
}

function cardValue(event: EspnEvent, teamId: string | undefined, card: "yellowCard" | "redCard") {
  const details = event.competitions?.[0]?.details;
  if (!Array.isArray(details)) return null;
  return details.filter((detail) => detail.team?.id === teamId && detail[card] === true).length;
}

function roundedAverage(metric: { sum: number; count: number } | undefined) {
  return metric?.count ? Math.round((metric.sum / metric.count) * 10) / 10 : null;
}

function getAccumulator(store: Map<number, Accumulator>, team: EspnTeam) {
  const id = numericTeamId(team);
  if (id === null || !team.displayName) return null;
  const existing = store.get(id);
  if (existing) return existing;
  const created: Accumulator = {
    id,
    name: team.displayName,
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
  store.set(id, created);
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

async function fetchScoreboard(leagueKey: LeagueKey, year: number) {
  const cacheKey = `${leagueKey}:${year}`;
  const cached = scoreboardCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const url = `${ESPN_BASE}/${ESPN_LEAGUES[leagueKey]}/scoreboard?dates=${year}&limit=1000`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BetsStats/1.0 (personal experiment)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`ESPN respondeu com HTTP ${response.status}.`);
  const data = (await response.json()) as EspnScoreboard;
  const events = Array.isArray(data.events) ? data.events : [];
  scoreboardCache.set(cacheKey, { expires: Date.now() + CACHE_TTL, value: events });
  return events;
}

async function loadEspnStats(leagueKey: LeagueKey, season: number, window: number, venue: VenueFilter): Promise<StatsResponse> {
  const league = findLeague(leagueKey);
  const years = leagueKey === "brasileirao" ? [season] : [season, season + 1];
  const scoreboards = await Promise.all(years.map((year) => fetchScoreboard(leagueKey, year)));
  const fixtures = [...new Map(
    scoreboards
      .flat()
      .filter((event) => event.id && event.season?.year === season && event.status?.type?.completed === true)
      .map((event) => [event.id as string, event]),
  ).values()].sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""));

  const selectedByTeam = new Map<number, Set<string>>();
  for (const fixture of fixtures) {
    if (!fixture.id) continue;
    for (const side of ["home", "away"] as const) {
      if (venue !== "all" && venue !== side) continue;
      const teamId = numericTeamId(competitorFor(fixture, side)?.team);
      if (teamId === null) continue;
      const selected = selectedByTeam.get(teamId) ?? new Set<string>();
      if (selected.size < window) selected.add(fixture.id);
      selectedByTeam.set(teamId, selected);
    }
  }

  const selectedIds = new Set([...selectedByTeam.values()].flatMap((ids) => [...ids]));
  if (!selectedIds.size) throw new Error("Nenhuma partida finalizada foi encontrada para esse recorte na ESPN.");

  const selectedFixtures = fixtures
    .filter((fixture) => fixture.id && selectedIds.has(fixture.id))
    .sort((a, b) => Date.parse(a.date ?? "") - Date.parse(b.date ?? ""));
  const aggregate = new Map<number, Accumulator>();
  let matchesWithStats = 0;

  for (const fixture of selectedFixtures) {
    const home = competitorFor(fixture, "home");
    const away = competitorFor(fixture, "away");
    const homeGoals = numberValue(home?.score);
    const awayGoals = numberValue(away?.score);
    if (!home?.team || !away?.team || homeGoals === null || awayGoals === null || !fixture.id) continue;
    if (home.statistics?.length && away.statistics?.length) matchesWithStats += 1;

    for (const side of ["home", "away"] as const) {
      const team = side === "home" ? home : away;
      const opponent = side === "home" ? away : home;
      const teamInfo = team.team;
      if (!teamInfo) continue;
      const teamId = numericTeamId(teamInfo);
      if (teamId === null || !selectedByTeam.get(teamId)?.has(fixture.id)) continue;
      const goalsFor = side === "home" ? homeGoals : awayGoals;
      const goalsAgainst = side === "home" ? awayGoals : homeGoals;
      const entry = getAccumulator(aggregate, teamInfo);
      if (!entry) continue;

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
      addMetric(entry, "shotsOn", statValue(team, "shotsOnTarget"));
      addMetric(entry, "shotsOnAgainst", statValue(opponent, "shotsOnTarget"));
      addMetric(entry, "totalShots", statValue(team, "totalShots"));
      addMetric(entry, "corners", statValue(team, "wonCorners"));
      addMetric(entry, "fouls", statValue(team, "foulsCommitted"));
      addMetric(entry, "yellowCards", cardValue(fixture, teamInfo.id, "yellowCard"));
      addMetric(entry, "redCards", cardValue(fixture, teamInfo.id, "redCard"));
    }
  }

  const teams = [...aggregate.values()].filter((team) => team.matches > 0).map(buildTeamStats);
  const coverage = Math.round((matchesWithStats / Math.max(1, selectedFixtures.length)) * 100);
  const coverageNotice = coverage < 100
    ? ` A cobertura das estatísticas detalhadas neste recorte é de ${coverage}%; campos ausentes aparecem como traço.`
    : "";
  return {
    mode: "live",
    source: "ESPN (feed experimental)",
    updatedAt: new Date().toISOString(),
    league: { key: league.key, id: league.id, name: league.name, short: league.short, country: league.country, flag: league.flag },
    season,
    window,
    venue,
    coverage,
    teams,
    notice: `Fonte experimental baseada no feed usado pelo site da ESPN, sem garantia de estabilidade ou autorização para redistribuição.${coverageNotice}`,
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
  const cacheKey = `${league}:${season}:${window}:${venue}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value);

  try {
    const value = await loadEspnStats(league, season, window, venue);
    responseCache.set(cacheKey, { expires: Date.now() + CACHE_TTL, value });
    return NextResponse.json(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o feed experimental da ESPN.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
