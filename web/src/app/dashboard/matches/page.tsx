"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card, Pill } from "@/components/ui";
import { ProbabilityBar } from "@/components/probability-bar";
import { MatchMarketPanoply } from "@/components/match-market-panoply";

// Types pour les données réelles de l'API
type LiveMatch = {
  id: string;
  sofascore_id: number;
  sport: string;
  competition: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  status: string;
  model_probs: { home: number; draw: number; away: number };
  market_odds: { home: number; draw: number; away: number } | null;
  best_bookmaker: string | null;
  best_outcome: "home" | "draw" | "away" | null;
  best_edge: number | null;
  best_ev: number | null;
  is_demo: false;
  stat_rates: {
    lambda_goals_home: number; lambda_goals_away: number;
    lambda_corners_home: number; lambda_corners_away: number;
    lambda_cards_home: number; lambda_cards_away: number;
    lambda_fouls_home: number; lambda_fouls_away: number;
    lambda_shots_home: number; lambda_shots_away: number;
    lambda_sot_home: number; lambda_sot_away: number;
    lambda_offsides_home: number; lambda_offsides_away: number;
  };
};

type ApiResponse = {
  date: string;
  source: string;
  total_events_today: number;
  big_league_events: number;
  matches: LiveMatch[];
  errors: string[];
  fetched_at: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const COMPETITION_ICONS: Record<string, string> = {
  "Premier League": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "La Liga": "🇪🇸",
  "Bundesliga": "🇩🇪",
  "Serie A": "🇮🇹",
  "Ligue 1": "🇫🇷",
  "Champions League": "⭐",
  "Europa League": "🟠",
  "Liga Portugal": "🇵🇹",
  "Eredivisie": "🇳🇱",
};

function MatchCard({ match }: { match: LiveMatch }) {
  const isLive = match.status.toLowerCase().includes("progress") || match.status === "In Progress";
  const isFinished = match.status.toLowerCase().includes("finished") || match.status.toLowerCase().includes("ended");
  const compIcon = COMPETITION_ICONS[match.competition] ?? "⚽";

  return (
    <Card className="overflow-hidden mb-4">
      <div className="px-5 py-4" style={{ background: "var(--color-surface-2)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>{compIcon}</span>
              <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: "var(--color-muted)" }}>
                {match.competition}
              </span>
              {isLive && (
                <span className="animate-pulse rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                  style={{ background: "color-mix(in srgb, var(--color-danger) 15%, transparent)", color: "var(--color-danger)" }}>
                  🔴 LIVE
                </span>
              )}
              {isFinished && (
                <span className="rounded-full px-2 py-0.5 font-mono text-[10px]"
                  style={{ background: "var(--color-surface)", color: "var(--color-muted)" }}>
                  Terminé
                </span>
              )}
            </div>
            <h3 className="text-base font-bold">
              {match.home_team} <span style={{ color: "var(--color-muted)" }}>vs</span> {match.away_team}
            </h3>
            <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--color-muted)" }}>
              🕒 {formatTime(match.commence_time)} (Paris)
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {match.best_ev !== null && match.best_ev > 0.02 && (
              <Pill tone="success">✓ Value +{(match.best_ev * 100).toFixed(1)}%</Pill>
            )}
            {match.market_odds ? (
              <span className="font-mono text-[10px] rounded-full px-2 py-0.5"
                style={{ background: "color-mix(in srgb, var(--color-blue) 10%, transparent)", color: "var(--color-blue)" }}>
                Cotes réelles ✓
              </span>
            ) : (
              <span className="font-mono text-[10px] rounded-full px-2 py-0.5"
                style={{ background: "var(--color-surface)", color: "var(--color-muted)" }}>
                Cotes indisponibles
              </span>
            )}
          </div>
        </div>

        {/* Barres de probabilités 1X2 */}
        <div className="mt-3">
          <ProbabilityBar
            modelProbs={match.model_probs}
            marketOdds={match.market_odds ?? { home: 0, draw: 0, away: 0 }}
            homeLabel={match.home_team.split(" ").pop() ?? match.home_team}
            awayLabel={match.away_team.split(" ").pop() ?? match.away_team}
            bestOutcome={match.best_outcome}
          />
        </div>
      </div>

      {/* Tableau 1X2 si cotes disponibles */}
      {match.market_odds && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Résultat", "Cote marché", "Prob. marché", "Prob. modèle", "Edge"].map((h) => (
                  <th key={h} className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { label: match.home_team, outcome: "home" as const, mktOdd: match.market_odds.home, modelP: match.model_probs.home },
                  { label: "Nul", outcome: "draw" as const, mktOdd: match.market_odds.draw, modelP: match.model_probs.draw },
                  { label: match.away_team, outcome: "away" as const, mktOdd: match.market_odds.away, modelP: match.model_probs.away },
                ] as const
              ).map((row) => {
                const impliedP = row.mktOdd > 1 ? 1 / row.mktOdd : 0;
                const edge = row.modelP - impliedP;
                const isBest = match.best_outcome === row.outcome;
                return (
                  <tr key={row.outcome} style={{
                    borderBottom: "1px solid var(--color-border)",
                    background: isBest ? "color-mix(in srgb, var(--color-success) 5%, transparent)" : undefined,
                  }}>
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {row.label}
                        {isBest && (
                          <span className="font-mono text-[10px] rounded-full px-1.5 py-0.5"
                            style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)", color: "var(--color-success)" }}>
                            ← value
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-right">{row.mktOdd > 0 ? row.mktOdd.toFixed(2) : "—"}</td>
                    <td className="px-5 py-3 font-mono text-right" style={{ color: "var(--color-muted)" }}>
                      {impliedP > 0 ? `${(impliedP * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-5 py-3 font-mono font-semibold text-right" style={{ color: "var(--color-blue)" }}>
                      {(row.modelP * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 font-mono font-semibold text-right" style={{
                      color: edge > 0.06 ? "var(--color-success)" : edge > 0.02 ? "var(--color-amber)" : "var(--color-danger)"
                    }}>
                      {edge >= 0 ? "+" : ""}{(edge * 100).toFixed(1)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panoplie complète de marchés statistiques */}
      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
        <MatchMarketPanoply
          statRates={match.stat_rates}
          homeTeam={match.home_team}
          awayTeam={match.away_team}
        />
      </div>
    </Card>
  );
}

const LEAGUE_FILTERS = [
  { key: "all", label: "Toutes les ligues", icon: "🌍" },
  { key: "Premier League", label: "Premier League", icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "La Liga", label: "La Liga", icon: "🇪🇸" },
  { key: "Bundesliga", label: "Bundesliga", icon: "🇩🇪" },
  { key: "Serie A", label: "Serie A", icon: "🇮🇹" },
  { key: "Ligue 1", label: "Ligue 1", icon: "🇫🇷" },
  { key: "Champions League", label: "Champions League", icon: "⭐" },
  { key: "Europa League", label: "Europa League", icon: "🟠" },
];

export default function MatchesPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/matches/today", { cache: "no-store" });
      if (!resp.ok) throw new Error(`Erreur API: ${resp.status}`);
      const json: ApiResponse = await resp.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    // Auto-refresh toutes les 30 minutes
    const interval = setInterval(fetchMatches, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  const matches = data?.matches ?? [];
  const filteredMatches = selectedLeague === "all"
    ? matches
    : matches.filter((m) => m.competition === selectedLeague);

  const today = new Date();

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader
            eyebrow={`Calendrier officiel · Big Leagues`}
            title="Prochains Matchs — Cotes Réelles"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Source :{" "}
            <span className="font-semibold" style={{ color: "var(--color-blue)" }}>The Odds API</span> — cotes réelles bookmakers européens.
            Probabilités par modèle Poisson (Loi de Poisson bivariée).
          </p>
          {lastRefresh && (
            <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
              Dernière actualisation : {lastRefresh.toLocaleTimeString("fr-FR")}
            </p>
          )}
        </div>
        <button
          onClick={fetchMatches}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--color-amber)", color: "var(--color-ground)" }}
        >
          {loading ? "⏳ Chargement..." : "🔄 Actualiser"}
        </button>
      </div>

      {/* Filtres par Ligue */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {LEAGUE_FILTERS.map((lf) => {
          const active = selectedLeague === lf.key;
          const count = lf.key === "all" ? matches.length : matches.filter((m) => m.competition === lf.key).length;
          if (lf.key !== "all" && count === 0) return null;
          return (
            <button key={lf.key} type="button" onClick={() => setSelectedLeague(lf.key)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? "var(--color-amber)" : "var(--color-surface-2)",
                color: active ? "var(--color-ground)" : "var(--color-text)",
                border: active ? "1px solid var(--color-amber)" : "1px solid var(--color-border)",
              }}>
              <span>{lf.icon}</span>
              <span>{lf.label}</span>
              <span className="font-mono text-[10px] rounded-full px-1.5"
                style={{ background: active ? "rgba(0,0,0,0.15)" : "var(--color-surface)", color: active ? "var(--color-ground)" : "var(--color-muted)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats rapides */}
      {data && (
        <div className="mb-6 grid grid-cols-3 gap-4 rounded-xl p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div>
            <div className="font-mono text-[11px] uppercase" style={{ color: "var(--color-muted)" }}>Matchs disponibles</div>
            <div className="mt-1 font-mono text-2xl font-bold">{matches.length}</div>
            <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>Big Leagues (cotes réelles)</div>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase" style={{ color: "var(--color-muted)" }}>Avec cotes disponibles</div>
            <div className="mt-1 font-mono text-2xl font-bold" style={{ color: "var(--color-blue)" }}>
              {matches.filter((m) => m.market_odds !== null).length}
            </div>
            <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>bookmakers EU</div>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase" style={{ color: "var(--color-muted)" }}>Value Bets détectés</div>
            <div className="mt-1 font-mono text-2xl font-bold" style={{ color: "var(--color-success)" }}>
              {matches.filter((m) => m.best_ev !== null && m.best_ev >= 0.02 && m.best_ev <= 0.25).length}
            </div>
            <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>EV +2% à +25% (filtre strict)</div>
          </div>
        </div>
      )}

      {/* Erreurs API */}
      {data?.errors && data.errors.length > 0 && (
        <div className="mb-4 rounded-lg p-4 text-sm"
          style={{ background: "color-mix(in srgb, var(--color-danger) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)" }}>
          <div className="font-semibold mb-1" style={{ color: "var(--color-danger)" }}>⚠️ Avertissements API</div>
          {data.errors.map((e, i) => <div key={i} className="font-mono text-[11px]" style={{ color: "var(--color-muted)" }}>{e}</div>)}
        </div>
      )}

      {/* État chargement */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mb-3 font-mono text-2xl animate-pulse">⚽</div>
            <p className="text-sm font-medium">Récupération des matchs en temps réel...</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>SofaScore + The Odds API</p>
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && !loading && (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="text-2xl mb-3">🔌</div>
          <p className="font-semibold">Impossible de récupérer les données</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>{error}</p>
          <button onClick={fetchMatches} className="mt-4 rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--color-amber)", color: "var(--color-ground)" }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Liste des matchs */}
      {!loading && !error && (
        filteredMatches.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="text-3xl mb-3">🗓️</div>
            <p className="font-semibold">Aucun match disponible pour cette ligue</p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              Période pré-saison — les ligues reprennent à partir d&apos;août 2026.
            </p>
          </div>
        ) : (
          <div>
            {filteredMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
