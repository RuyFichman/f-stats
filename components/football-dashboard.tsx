"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Database,
  Goal,
  Info,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CURRENT_SEASON,
  LEAGUES,
  type LeagueKey,
  type StatsResponse,
  type TeamStats,
  type VenueFilter,
  formatMetric,
  generateDemoStats,
} from "@/lib/football-stats";

type SortKey = "shotsOn" | "totalShots" | "corners" | "yellowCards" | "fouls" | "btts" | "over25" | "cleanSheets";
type SortDirection = "asc" | "desc";

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown | Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): void | Promise<void>;
    };
  }
}

const sortLabels: Record<SortKey, string> = {
  shotsOn: "chutes no alvo",
  totalShots: "chutes totais",
  corners: "escanteios",
  yellowCards: "cartões amarelos",
  fouls: "faltas",
  btts: "ambas marcam",
  over25: "over 2,5",
  cleanSheets: "jogos sem sofrer gol",
};

const venueLabels: Record<VenueFilter, string> = { all: "Geral", home: "Em casa", away: "Fora" };

function TeamMark({ team, size = "normal" }: { team: TeamStats; size?: "normal" | "large" }) {
  const initials = team.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("");
  const sizeClass = size === "large" ? "size-14 text-base" : "size-9 text-[11px]";
  return team.logo ? (
    <span className={`${sizeClass} grid shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white p-1`}>
      <img src={team.logo} alt="" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
    </span>
  ) : (
    <span className={`${sizeClass} grid shrink-0 place-items-center rounded-lg border border-[#c7ff3d]/15 bg-[#c7ff3d]/8 font-black tracking-tight text-[#c7ff3d]`} aria-hidden="true">{initials}</span>
  );
}

function FormStrip({ form }: { form: TeamStats["form"] }) {
  return (
    <div className="flex gap-1" aria-label={`Forma recente: ${form.join(", ")}`}>
      {form.map((result, index) => (
        <span key={`${result}-${index}`} className={`grid size-5 place-items-center rounded text-[10px] font-black ${result === "W" ? "bg-[#c7ff3d] text-[#07110f]" : result === "D" ? "bg-[#41574e] text-white" : "bg-[#ff6b6b]/85 text-white"}`}>{result === "W" ? "V" : result === "D" ? "E" : "D"}</span>
      ))}
    </div>
  );
}

function MetricHeader({ label, metric, sortKey, direction, onSort }: { label: string; metric: SortKey; sortKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  const active = sortKey === metric;
  return (
    <button type="button" onClick={() => onSort(metric)} className={`inline-flex items-center gap-1.5 rounded px-1 py-1 text-left transition hover:text-white ${active ? "text-[#c7ff3d]" : "text-[#78978b]"}`} title={`Ordenar por ${sortLabels[metric]}`}>
      {label}{active ? direction === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
    </button>
  );
}

function StatBar({ label, value, color = "#c7ff3d" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm"><span className="text-[#93aa9f]">{label}</span><strong>{value}%</strong></div>
      <Progress value={value} className="h-1.5 bg-white/8 [&_[data-slot=progress-indicator]]:bg-[var(--bar-color)]" style={{ "--bar-color": color } as React.CSSProperties} />
    </div>
  );
}

function InfoCard({ eyebrow, value, detail, icon: Icon, tone = "lime" }: { eyebrow: string; value: string; detail: string; icon: typeof Target; tone?: "lime" | "cyan" | "amber" | "red" }) {
  const tones = { lime: "bg-[#c7ff3d]/10 text-[#c7ff3d]", cyan: "bg-[#5ce1e6]/10 text-[#5ce1e6]", amber: "bg-[#ffbd59]/10 text-[#ffbd59]", red: "bg-[#ff6b6b]/10 text-[#ff6b6b]" };
  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/8 bg-[#0d1b17] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#78978b]">{eyebrow}</p><span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}><Icon className="size-4" aria-hidden="true" /></span></div>
      <p className="font-display mt-5 text-2xl font-black tracking-[-0.04em]">{value}</p>
      <p className="mt-1 truncate text-sm text-[#93aa9f]">{detail}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#c7ff3d] transition-all duration-300 group-hover:w-full" aria-hidden="true" />
    </article>
  );
}

export function FootballDashboard() {
  const [leagueKey, setLeagueKey] = useState<LeagueKey>("premier-league");
  const [windowSize, setWindowSize] = useState(10);
  const [venue, setVenue] = useState<VenueFilter>("all");
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("shotsOn");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [data, setData] = useState<StatsResponse>(() => generateDemoStats("premier-league", 10, "all", CURRENT_SEASON));
  const [selectedTeam, setSelectedTeam] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ league: leagueKey, window: String(windowSize), venue, season: String(season), refresh: String(refreshTick) });
      const response = await fetch(`/api/stats?${params}`, { signal });
      const payload = await response.json() as StatsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar os dados.");
      setData(payload);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar os dados.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [leagueKey, windowSize, venue, season, refreshTick]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStats(controller.signal);
    return () => controller.abort();
  }, [loadStats]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validLeagueKeys = LEAGUES.map((league) => league.key);
    try {
      void Promise.resolve(context.registerTool({
        name: "configure_football_analysis",
        title: "Configurar análise de futebol",
        description: "Seleciona liga, quantidade de jogos, mando e busca; atualiza o mesmo ranking visível no painel.",
        inputSchema: {
          type: "object",
          properties: {
            league: { type: "string", enum: validLeagueKeys },
            window: { type: "integer", enum: [5, 10, 20] },
            venue: { type: "string", enum: ["all", "home", "away"] },
            search: { type: "string", maxLength: 80 },
          },
          required: ["league", "window", "venue"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const value = input as { league?: string; window?: number; venue?: string; search?: string };
          if (!value || !validLeagueKeys.includes(value.league as LeagueKey) || ![5, 10, 20].includes(value.window ?? 0) || !["all", "home", "away"].includes(value.venue ?? "")) throw new Error("Filtros inválidos.");
          setLeagueKey(value.league as LeagueKey);
          setWindowSize(value.window as number);
          setVenue(value.venue as VenueFilter);
          setQuery(value.search?.slice(0, 80) ?? "");
          return { league: value.league, window: value.window, venue: value.venue, search: value.search ?? "", status: "analysis_updated" };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch { /* Navegadores sem WebMCP continuam com a interface normal. */ }
    return () => lifecycle.abort();
  }, []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setDirection((current) => current === "desc" ? "asc" : "desc");
    else { setSortKey(key); setDirection("desc"); }
  };

  const visibleTeams = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return data.teams
      .filter((team) => team.name.toLocaleLowerCase("pt-BR").includes(normalized))
      .sort((a, b) => {
        const first = a[sortKey] ?? -1;
        const second = b[sortKey] ?? -1;
        return direction === "desc" ? second - first : first - second;
      });
  }, [data.teams, query, sortKey, direction]);

  const leader = useCallback((key: SortKey) => data.teams.reduce<TeamStats | null>((best, team) => !best || (team[key] ?? -1) > (best[key] ?? -1) ? team : best, null), [data.teams]);
  const shotsLeader = leader("shotsOn");
  const cornersLeader = leader("corners");
  const cardsLeader = leader("yellowCards");
  const bttsLeader = leader("btts");
  const averageShots = data.teams.length ? data.teams.reduce((sum, team) => sum + (team.shotsOn ?? 0), 0) / data.teams.filter((team) => team.shotsOn !== null).length : 0;
  const chartData = [...data.teams].sort((a, b) => (b.shotsOn ?? 0) - (a.shotsOn ?? 0)).slice(0, 6).map((team) => ({ name: team.name.split(" ")[0], "A favor": team.shotsOn ?? 0, "Contra": team.shotsOnAgainst ?? 0 }));
  const venueText = venueLabels[data.venue];

  return (
    <main className="min-h-screen bg-[#07110f] text-[#ecf8f3]">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#081512]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-[#c7ff3d] text-[#07110f]"><Activity className="size-5" aria-hidden="true" /></div>
            <div><p className="font-display text-lg font-extrabold tracking-[-0.03em]">BETS/STATS</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#78978b]">Football intelligence</p></div>
          </div>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Ligas">
            {LEAGUES.map((league) => <Button key={league.key} type="button" variant="ghost" onClick={() => setLeagueKey(league.key)} className={`h-8 px-3 text-xs ${leagueKey === league.key ? "bg-white/8 text-[#c7ff3d]" : "text-[#93aa9f] hover:bg-white/5 hover:text-white"}`}>{league.short}</Button>)}
          </nav>
          <div className="flex items-center gap-2">
            <Badge className={data.mode === "live" ? "border-[#5ce1e6]/25 bg-[#5ce1e6]/10 text-[#5ce1e6]" : "border-[#ffbd59]/25 bg-[#ffbd59]/10 text-[#ffbd59]"}><span className={`size-1.5 rounded-full ${data.mode === "live" ? "bg-[#5ce1e6]" : "bg-[#ffbd59]"}`} />{data.mode === "live" ? "Dados reais" : "Demonstração"}</Badge>
            <Dialog>
              <DialogTrigger asChild><Button variant="ghost" className="size-9 p-0 text-[#93aa9f] hover:bg-white/6 hover:text-white" aria-label="Configurar fonte de dados"><Settings2 className="size-4" /></Button></DialogTrigger>
              <DialogContent className="border-white/10 bg-[#0d1b17] text-white">
                <DialogHeader><DialogTitle className="font-display text-xl">Fonte de dados</DialogTitle><DialogDescription className="text-[#93aa9f]">A coleta ocorre somente no servidor e as respostas ficam em cache por 15 minutos.</DialogDescription></DialogHeader>
                <div className="rounded-lg border border-white/8 bg-[#07110f] p-4">
                  <p className="mb-2 flex items-center gap-2 font-semibold"><Database className="size-4 text-[#c7ff3d]" /> ESPN · experimento pessoal</p>
                  <p className="text-sm leading-6 text-[#93aa9f]">O painel consulta o feed JSON usado pelo site da ESPN. Não é uma API pública documentada e pode mudar ou ficar indisponível sem aviso.</p>
                </div>
                <div className="flex gap-2 rounded-lg border border-[#ffbd59]/15 bg-[#ffbd59]/6 p-3 text-sm text-[#d8c18c]"><Info className="mt-0.5 size-4 shrink-0" /><p>A disponibilidade de estatísticas varia por campeonato e partida. O painel calcula a cobertura e preserva dados ausentes como traço.</p></div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1540px] px-4 py-6 sm:px-7 sm:py-8">
        <section className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c7ff3d]"><Zap className="size-3.5" aria-hidden="true" /> Central de análise · {data.league.country}</p>
            <h1 className="font-display max-w-3xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">Números que importam antes da aposta.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#93aa9f]">
            <span className="flex items-center gap-2"><Clock3 className="size-4 text-[#c7ff3d]" /> Atualizado {new Date(data.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#c7ff3d]" /> Uso informativo</span>
          </div>
        </section>

        <section aria-label="Filtros da análise" className="mb-5 grid gap-3 rounded-xl border border-white/8 bg-[#0d1b17] p-3 md:grid-cols-2 xl:grid-cols-[1.5fr_.8fr_.9fr_.9fr_1.2fr_auto]">
          <label className="grid gap-1.5"><span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#78978b]">Campeonato</span><NativeSelect value={leagueKey} onChange={(event) => setLeagueKey(event.target.value as LeagueKey)} className="h-10 w-full border-white/10 bg-[#07110f] text-white"><NativeSelectOption value="premier-league">Premier League</NativeSelectOption>{LEAGUES.slice(1).map((league) => <NativeSelectOption key={league.key} value={league.key}>{league.name}</NativeSelectOption>)}</NativeSelect></label>
          <label className="grid gap-1.5"><span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#78978b]">Temporada</span><NativeSelect value={season} onChange={(event) => setSeason(Number(event.target.value))} className="h-10 w-full border-white/10 bg-[#07110f] text-white">{[CURRENT_SEASON, CURRENT_SEASON - 1, CURRENT_SEASON - 2].map((year) => <NativeSelectOption key={year} value={year}>{year}</NativeSelectOption>)}</NativeSelect></label>
          <label className="grid gap-1.5"><span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#78978b]">Amostra</span><NativeSelect value={windowSize} onChange={(event) => setWindowSize(Number(event.target.value))} className="h-10 w-full border-white/10 bg-[#07110f] text-white"><NativeSelectOption value="5">Últimos 5</NativeSelectOption><NativeSelectOption value="10">Últimos 10</NativeSelectOption><NativeSelectOption value="20">Últimos 20</NativeSelectOption></NativeSelect></label>
          <label className="grid gap-1.5"><span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#78978b]">Mando</span><NativeSelect value={venue} onChange={(event) => setVenue(event.target.value as VenueFilter)} className="h-10 w-full border-white/10 bg-[#07110f] text-white"><NativeSelectOption value="all">Geral</NativeSelectOption><NativeSelectOption value="home">Em casa</NativeSelectOption><NativeSelectOption value="away">Fora</NativeSelectOption></NativeSelect></label>
          <label className="grid gap-1.5"><span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#78978b]">Buscar clube</span><span className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78978b]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Arsenal" className="h-10 border-white/10 bg-[#07110f] pl-9 text-white placeholder:text-[#567064]" /></span></label>
          <div className="flex items-end"><Button type="button" onClick={() => setRefreshTick((value) => value + 1)} disabled={loading} className="h-10 w-full bg-[#c7ff3d] font-extrabold text-[#07110f] hover:bg-[#dcff84] xl:w-auto"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Lendo…" : "Atualizar"}</Button></div>
        </section>

        {error ? <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-[#ff6b6b]/20 bg-[#ff6b6b]/8 p-4 text-sm text-[#ffb0b0]"><TriangleAlert className="mt-0.5 size-4 shrink-0" /><div><strong className="block text-white">Falha na atualização</strong>{error} Os dados anteriores foram mantidos.</div></div> : null}
        {data.notice ? <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#ffbd59]/15 bg-[#ffbd59]/6 p-3 text-sm text-[#d8c18c]"><CircleHelp className="mt-0.5 size-4 shrink-0" /><p>{data.notice}</p></div> : null}

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Destaques estatísticos">
          <InfoCard eyebrow="Chutes no alvo" value={shotsLeader ? formatMetric(shotsLeader.shotsOn) : "—"} detail={shotsLeader ? `${shotsLeader.name} · média por jogo` : "Sem dados"} icon={Target} />
          <InfoCard eyebrow="Escanteios" value={cornersLeader ? formatMetric(cornersLeader.corners) : "—"} detail={cornersLeader ? `${cornersLeader.name} · média por jogo` : "Sem dados"} icon={Crosshair} tone="cyan" />
          <InfoCard eyebrow="Ambas marcam" value={bttsLeader ? `${bttsLeader.btts}%` : "—"} detail={bttsLeader ? `${bttsLeader.name} · maior frequência` : "Sem dados"} icon={Goal} tone="amber" />
          <InfoCard eyebrow="Mais cartões" value={cardsLeader ? formatMetric(cardsLeader.yellowCards) : "—"} detail={cardsLeader ? `${cardsLeader.name} · amarelos/jogo` : "Sem dados"} icon={Sparkles} tone="red" />
        </section>

        <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,.75fr)]">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0d1b17]">
            <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div><h2 className="font-display text-lg font-bold">Ranking de mercados</h2><p className="text-sm text-[#78978b]">{data.league.name} · {data.window} jogos · {venueText.toLowerCase()}</p></div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#78978b]"><BarChart3 className="size-4 text-[#c7ff3d]" /> {visibleTeams.length} clubes</div>
            </div>
            <Table className="min-w-[1120px]">
              <TableHeader className="bg-[#0a1713] text-[11px] uppercase tracking-[0.08em] text-[#78978b]"><TableRow className="border-white/8 hover:bg-transparent"><TableHead className="sticky left-0 z-10 min-w-60 bg-[#0a1713] px-5 text-[#78978b]">Clube / forma</TableHead><TableHead className="text-[#78978b]">J</TableHead><TableHead><MetricHeader label="No alvo" metric="shotsOn" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="Chutes" metric="totalShots" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="Escant." metric="corners" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="Cartões" metric="yellowCards" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="Faltas" metric="fouls" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="Ambas" metric="btts" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="Over 2,5" metric="over25" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><MetricHeader label="SG" metric="cleanSheets" sortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead><TableHead><span className="sr-only">Detalhes</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleTeams.map((team, index) => <TableRow key={team.id} tabIndex={0} onClick={() => setSelectedTeam(team)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedTeam(team); }} className="cursor-pointer border-white/6 outline-none hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#c7ff3d]/60"><TableCell className="sticky left-0 z-10 bg-[#0d1b17] px-5 group-hover:bg-[#10211c]"><div className="flex items-center gap-3"><span className="w-5 text-xs font-bold text-[#567064]">{String(index + 1).padStart(2, "0")}</span><TeamMark team={team} /><div><p className="max-w-36 truncate font-bold text-white">{team.name}</p><FormStrip form={team.form} /></div></div></TableCell><TableCell className="text-[#93aa9f]">{team.matches}</TableCell><TableCell className="font-extrabold text-[#c7ff3d]">{formatMetric(team.shotsOn)}</TableCell><TableCell>{formatMetric(team.totalShots)}</TableCell><TableCell className="text-[#5ce1e6]">{formatMetric(team.corners)}</TableCell><TableCell>{formatMetric(team.yellowCards)}</TableCell><TableCell>{formatMetric(team.fouls)}</TableCell><TableCell>{team.btts}%</TableCell><TableCell>{team.over25}%</TableCell><TableCell>{team.cleanSheets}%</TableCell><TableCell><ChevronRight className="size-4 text-[#567064]" /></TableCell></TableRow>)}
                {!visibleTeams.length ? <TableRow><TableCell colSpan={11} className="h-40 text-center text-[#78978b]">Nenhum clube encontrado para “{query}”.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>

          <aside className="rounded-xl border border-white/8 bg-[#0d1b17] p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#78978b]">Comparativo ofensivo</p><h2 className="font-display mt-1 text-lg font-bold">Chutes no alvo</h2></div><span className="rounded-md bg-[#c7ff3d]/10 px-2 py-1 text-xs font-bold text-[#c7ff3d]">média/jogo</span></div>
            <div className="h-[285px] w-full" aria-label="Gráfico dos seis times com mais chutes no alvo">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 420, height: 285 }}><BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 6, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} /><XAxis type="number" stroke="#567064" tickLine={false} axisLine={false} fontSize={11} /><YAxis dataKey="name" type="category" width={74} stroke="#93aa9f" tickLine={false} axisLine={false} fontSize={11} /><RechartsTooltip cursor={{ fill: "rgba(255,255,255,.035)" }} contentStyle={{ background: "#10231d", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} /><Bar dataKey="A favor" fill="#c7ff3d" radius={[0, 4, 4, 0]} barSize={9} /><Bar dataKey="Contra" fill="#315b4d" radius={[0, 4, 4, 0]} barSize={9} /></BarChart></ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-white/8 pt-4 text-xs text-[#93aa9f]"><span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-[#c7ff3d]" /> A favor</span><span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-[#315b4d]" /> Contra</span></div>
          </aside>
        </section>

        <section className="grid gap-4 rounded-xl border border-white/8 bg-[#0a1713] p-4 md:grid-cols-3 sm:p-5" aria-label="Leitura rápida">
          <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#c7ff3d]/10 text-[#c7ff3d]"><TrendingUp className="size-4" /></span><div><p className="font-bold">Volume ofensivo</p><p className="mt-1 text-sm leading-6 text-[#78978b]">A liga registra média de <strong className="text-[#b9cec5]">{Number.isFinite(averageShots) ? averageShots.toFixed(1) : "—"}</strong> chutes no alvo por clube/jogo neste recorte.</p></div></div>
          <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#5ce1e6]/10 text-[#5ce1e6]"><CalendarDays className="size-4" /></span><div><p className="font-bold">Amostra aplicada</p><p className="mt-1 text-sm leading-6 text-[#78978b]">Até <strong className="text-[#b9cec5]">{data.window} jogos</strong> por clube, temporada {data.season}, com mando “{venueText}”.</p></div></div>
          <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#ffbd59]/10 text-[#ffbd59]"><Database className="size-4" /></span><div><p className="font-bold">Cobertura da fonte</p><p className="mt-1 text-sm leading-6 text-[#78978b]"><strong className="text-[#b9cec5]">{data.coverage}%</strong> das partidas consultadas têm bloco estatístico disponível.</p></div></div>
        </section>

        <footer className="flex flex-col gap-3 py-6 text-xs leading-5 text-[#567064] sm:flex-row sm:items-center sm:justify-between"><p>Estatísticas históricas não garantem resultados futuros. Defina limites e aposte apenas o que pode perder.</p><p>Fonte: {data.source} · cache de 15 min no modo ao vivo</p></footer>
      </div>

      <Sheet open={Boolean(selectedTeam)} onOpenChange={(open) => { if (!open) setSelectedTeam(null); }}>
        <SheetContent className="w-full overflow-y-auto border-white/10 bg-[#0a1713] p-0 text-white sm:max-w-lg">
          {selectedTeam ? <><SheetHeader className="border-b border-white/8 p-5 pr-12"><div className="flex items-center gap-4"><TeamMark team={selectedTeam} size="large" /><div><SheetTitle className="font-display text-2xl font-black">{selectedTeam.name}</SheetTitle><SheetDescription className="text-[#78978b]">{data.league.name} · últimos {selectedTeam.matches} jogos</SheetDescription></div></div></SheetHeader><div className="space-y-6 p-5">
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0d1b17] p-4"><div><p className="text-xs uppercase tracking-[0.12em] text-[#78978b]">Forma recente</p><div className="mt-2"><FormStrip form={selectedTeam.form} /></div></div><div className="text-right"><p className="text-xs uppercase tracking-[0.12em] text-[#78978b]">Campanha</p><p className="mt-1 font-display text-xl font-black"><span className="text-[#c7ff3d]">{selectedTeam.wins}V</span> · {selectedTeam.draws}E · <span className="text-[#ff6b6b]">{selectedTeam.losses}D</span></p></div></div>
            <div><h3 className="font-display mb-3 font-bold">Produção por jogo</h3><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-white/8 bg-[#0d1b17] p-3"><p className="text-xs text-[#78978b]">Chutes no alvo</p><p className="mt-1 text-2xl font-black text-[#c7ff3d]">{formatMetric(selectedTeam.shotsOn)}</p></div><div className="rounded-lg border border-white/8 bg-[#0d1b17] p-3"><p className="text-xs text-[#78978b]">Chutes sofridos</p><p className="mt-1 text-2xl font-black">{formatMetric(selectedTeam.shotsOnAgainst)}</p></div><div className="rounded-lg border border-white/8 bg-[#0d1b17] p-3"><p className="text-xs text-[#78978b]">Gols marcados</p><p className="mt-1 text-2xl font-black">{selectedTeam.goalsFor.toFixed(1)}</p></div><div className="rounded-lg border border-white/8 bg-[#0d1b17] p-3"><p className="text-xs text-[#78978b]">Gols sofridos</p><p className="mt-1 text-2xl font-black">{selectedTeam.goalsAgainst.toFixed(1)}</p></div><div className="rounded-lg border border-white/8 bg-[#0d1b17] p-3"><p className="text-xs text-[#78978b]">Escanteios</p><p className="mt-1 text-2xl font-black text-[#5ce1e6]">{formatMetric(selectedTeam.corners)}</p></div><div className="rounded-lg border border-white/8 bg-[#0d1b17] p-3"><p className="text-xs text-[#78978b]">Cartões amarelos</p><p className="mt-1 text-2xl font-black text-[#ffbd59]">{formatMetric(selectedTeam.yellowCards)}</p></div></div></div>
            <div><h3 className="font-display mb-4 font-bold">Frequência de mercados</h3><div className="space-y-4"><StatBar label="Mais de 1,5 gols" value={selectedTeam.over15} /><StatBar label="Mais de 2,5 gols" value={selectedTeam.over25} color="#5ce1e6" /><StatBar label="Ambas as equipes marcam" value={selectedTeam.btts} color="#ffbd59" /><StatBar label="Sem sofrer gols" value={selectedTeam.cleanSheets} color="#9b8cff" /></div></div>
            <div className="flex gap-2 rounded-lg border border-white/8 bg-[#07110f] p-3 text-xs leading-5 text-[#78978b]"><Info className="mt-0.5 size-4 shrink-0" /><p>Use as métricas em conjunto com escalações, contexto da partida e odds. Elas descrevem o passado; não são uma recomendação de aposta.</p></div>
          </div></> : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
