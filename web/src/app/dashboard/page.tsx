import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { PickCard } from "@/components/pick-card";
import { ProbabilityBar } from "@/components/probability-bar";
import type { ValueBet, Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import {
  DEMO_PICKS,
  DEMO_UPCOMING_MATCHES,
  valueBetToPick,
} from "@/lib/demo-data";

function formatMatchDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (d.getTime() - now.getTime()) / 3600000;
  if (diffH < 24) return `Dans ${Math.round(diffH)}h`;
  if (diffH < 48) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [{ data: settingsRow }, { data: realValueBets }] = await Promise.all([
    supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Settings>(),
    supabase
      .from("value_bets")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "detected")
      .order("edge", { ascending: false })
      .limit(10)
      .returns<ValueBet[]>(),
  ]);

  const bankroll = settingsRow?.starting_bankroll ?? DEFAULT_SETTINGS.starting_bankroll;
  const kellyMult = settingsRow?.kelly_multiplier ?? DEFAULT_SETTINGS.kelly_multiplier;

  // Picks réels convertis depuis Supabase
  const realPicks = (realValueBets ?? []).map((vb) =>
    valueBetToPick(vb, bankroll, kellyMult)
  );

  // Si pas encore de données réelles → utiliser la démo
  const hasRealData = realPicks.length > 0;
  const picks = hasRealData ? realPicks : DEMO_PICKS;
  const topPicks = picks.slice(0, 3);
  const upcomingMatches = DEMO_UPCOMING_MATCHES.slice(0, 3);

  // Statistiques rapides
  const highConf = picks.filter((p) => p.confidence === "high").length;
  const avgEV =
    picks.length > 0
      ? picks.reduce((s, p) => s + p.expected_value, 0) / picks.length
      : 0;
  const totalKelly = picks.reduce((s, p) => s + p.kelly_stake_euros, 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          eyebrow="Dashboard Parieur"
          title="Vue d'ensemble"
        />
        {!hasRealData && (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-mono"
            style={{
              background: "color-mix(in srgb, var(--color-muted) 10%, transparent)",
              color: "var(--color-muted)",
              border: "1px dashed var(--color-border)",
            }}
          >
            Données illustratives — synchronisation moteur Python en attente
          </span>
        )}
      </div>

      {/* Stats rapides */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Picks détectés"
          value={picks.length}
        />
        <StatCard
          label="Confiance élevée ★★★"
          value={highConf}
          tone={highConf > 0 ? "success" : "default"}
        />
        <StatCard
          label="EV moyen"
          value={`${avgEV >= 0 ? "+" : ""}${(avgEV * 100).toFixed(1)}%`}
          tone={avgEV > 0.05 ? "success" : avgEV > 0 ? "default" : "danger"}
        />
        <StatCard
          label="Exposition Kelly totale"
          value={`${totalKelly}€`}
        />
      </div>

      {/* Top 3 Picks */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Top Picks du moment</h2>
        <Link
          href="/dashboard/picks"
          className="text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--color-muted)" }}
        >
          Tous les picks ({picks.length}) →
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {topPicks.map((pick, i) => (
          <PickCard key={pick.id} pick={pick} rank={i + 1} />
        ))}
      </div>

      {/* Matchs à venir — Barres de probabilité */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Matchs à venir — Probabilités modèle</h2>
        <Link
          href="/dashboard/matches"
          className="text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--color-muted)" }}
        >
          Voir tous les matchs →
        </Link>
      </div>

      <Card>
        <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {upcomingMatches.map((match) => (
            <div key={match.id} className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div
                    className="font-mono text-[11px] tracking-wide"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {match.competition} · {formatMatchDate(match.commence_time)}
                  </div>
                  <div className="mt-0.5 font-semibold text-sm">
                    {match.home_team} vs {match.away_team}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {match.best_ev != null && match.best_ev > 0 && (
                    <span
                      className="font-mono text-[11px] rounded-full px-2 py-0.5"
                      style={{
                        background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
                        color: "var(--color-success)",
                      }}
                    >
                      +{(match.best_ev * 100).toFixed(1)}% EV
                    </span>
                  )}
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {match.best_bookmaker}
                  </span>
                </div>
              </div>
              <ProbabilityBar
                modelProbs={match.model_probs}
                marketOdds={match.market_odds}
                homeLabel={match.home_team.split(" ")[0]}
                awayLabel={match.away_team.split(" ").slice(-1)[0]}
                bestOutcome={match.best_outcome}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Liens rapides */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/dashboard/picks",
            title: "Top Picks",
            desc: "Classement complet par edge & EV",
            icon: "🎯",
          },
          {
            href: "/dashboard/matches",
            title: "Matchs à venir",
            desc: "Probabilités 1X2 + cotes marché",
            icon: "📅",
          },
          {
            href: "/dashboard/suggestions",
            title: "Suggestions",
            desc: "Recommandations actionnables Kelly",
            icon: "💡",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className="group rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:border-opacity-80"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="mb-2 text-2xl">{item.icon}</div>
              <div className="font-semibold text-sm">{item.title}</div>
              <div
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-muted)" }}
              >
                {item.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
