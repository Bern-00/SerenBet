"use client";

import { useState } from "react";
import type { FactCheckResult } from "@/lib/gemini";

type GeminiFactCheckBadgeProps = {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  suggestedOutcome: string;
};

export function GeminiFactCheckBadge({
  homeTeam,
  awayTeam,
  competition,
  suggestedOutcome,
}: GeminiFactCheckBadgeProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleFactCheck() {
    if (result) {
      setIsOpen(!isOpen);
      return;
    }

    setLoading(true);
    setIsOpen(true);
    try {
      const resp = await fetch("/api/fact-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeTeam, awayTeam, competition, suggestedOutcome }),
      });
      const data: FactCheckResult = await resp.json();
      setResult(data);
    } catch {
      setResult({
        status: "neutral",
        confidence_score: 70,
        key_absences: [],
        tactical_notes: "Erreur de connexion Fact-Check.",
        verdict: "Fact-check indisponible pour l'instant.",
        checked_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }

  const badgeColor =
    result?.status === "verified"
      ? "var(--color-success)"
      : result?.status === "warning"
        ? "var(--color-danger)"
        : "var(--color-blue)";

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={handleFactCheck}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold transition-all hover:opacity-85 disabled:opacity-50"
        style={{
          background: "color-mix(in srgb, var(--color-blue) 12%, transparent)",
          color: "var(--color-blue)",
          border: "1px solid color-mix(in srgb, var(--color-blue) 30%, transparent)",
        }}
      >
        <span>🤖</span>
        <span>{loading ? "Vérification IA..." : result ? `Fact-Check ${result.confidence_score}%` : "Fact-Check Gemini IA"}</span>
      </button>

      {isOpen && result && (
        <div
          className="mt-2 rounded-lg border p-3.5 text-xs shadow-lg"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            maxWidth: "360px",
          }}
        >
          <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>🤖</span>
              <span>Analyse Factuelle Gemini</span>
            </div>
            <span
              className="font-mono text-[10px] font-bold rounded-full px-2 py-0.5"
              style={{
                background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`,
                color: badgeColor,
              }}
            >
              {result.status === "verified" ? "✓ Confirmé" : result.status === "warning" ? "⚠️ Piège détecté" : "Neutre"}
            </span>
          </div>

          {/* Absences clés */}
          {result.key_absences && result.key_absences.length > 0 && (
            <div className="mb-2">
              <div className="font-mono text-[10px] font-bold uppercase" style={{ color: "var(--color-muted)" }}>
                Absences & Blessures majeures :
              </div>
              <ul className="mt-1 list-disc pl-4 text-[11px] space-y-0.5" style={{ color: "var(--color-danger)" }}>
                {result.key_absences.map((abs, idx) => (
                  <li key={idx}>{abs}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes tactiques */}
          <p className="text-[11px] leading-relaxed mb-2" style={{ color: "var(--color-text)" }}>
            {result.tactical_notes}
          </p>

          {/* Verdict */}
          <div
            className="rounded p-2 text-[11px] font-medium"
            style={{
              background: "var(--color-surface-2)",
              borderLeft: `3px solid ${badgeColor}`,
            }}
          >
            {result.verdict}
          </div>
        </div>
      )}
    </div>
  );
}
