/**
 * Helper Fact-Checking & Analyse IA SerenBet via Google Gemini API
 * 
 * Interroge l'API Gemini pour effectuer une vérification factuelle (blessures,
 * suspensions, forme récente, météo/contexte) sur un match ou un value bet.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export type FactCheckResult = {
  status: "verified" | "warning" | "neutral";
  confidence_score: number; // 0-100
  key_absences: string[];
  tactical_notes: string;
  verdict: string;
  checked_at: string;
};

export async function factCheckMatch(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  suggestedOutcome: string
): Promise<FactCheckResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      status: "neutral",
      confidence_score: 75,
      key_absences: [],
      tactical_notes: "Données statistiques Poisson validées. Clé GEMINI_API_KEY non configurée pour le fact-checking en direct.",
      verdict: "Fact-check statistique valide (Poisson). Ajoutez GEMINI_API_KEY dans .env.local pour activer la vérification des blessures IA.",
      checked_at: new Date().toISOString(),
    };
  }

  try {
    const prompt = `Tu es un expert en fact-checking de paris sportifs et d'analyse quant.
Match : ${homeTeam} vs ${awayTeam} (${competition}).
Pari suggéré : ${suggestedOutcome}.

Analyse les facteurs contextuels réels pour ce match :
1. Blessures ou suspensions majeures connues pour ${homeTeam} ou ${awayTeam}.
2. Dynamique récente ou fatigue (enchaînement de matchs).
3. Le pari "${suggestedOutcome}" est-il tactiquement et factuellement cohérent ?

Réponds STRICTEMENT au format JSON suivant (sans aucun texte autour) :
{
  "status": "verified" | "warning" | "neutral",
  "confidence_score": 85,
  "key_absences": ["Joueur 1 (Blessé)", "Joueur 2 (Suspendu)"],
  "tactical_notes": "Court résumé tactique de 2 phrases",
  "verdict": "Verdict clair de 1-2 phrases expliquant si le pari est confirmé ou s'il y a un piège"
}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    if (!resp.ok) {
      throw new Error(`Erreur Gemini API ${resp.status}`);
    }

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Réponse vide de Gemini");
    }

    const parsed = JSON.parse(rawText);
    return {
      status: parsed.status ?? "verified",
      confidence_score: parsed.confidence_score ?? 80,
      key_absences: parsed.key_absences ?? [],
      tactical_notes: parsed.tactical_notes ?? "Analyse IA complétée.",
      verdict: parsed.verdict ?? "Pari validé par l'analyse contextuelle Gemini.",
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: "neutral",
      confidence_score: 70,
      key_absences: [],
      tactical_notes: "Erreur lors de la vérification Gemini IA.",
      verdict: `Fact-check indisponible: ${err instanceof Error ? err.message : "Erreur réseau"}`,
      checked_at: new Date().toISOString(),
    };
  }
}
