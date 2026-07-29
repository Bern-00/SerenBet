import { NextResponse } from "next/server";
import { factCheckMatch } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, competition, suggestedOutcome } = body;

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: "homeTeam et awayTeam sont requis" },
        { status: 400 }
      );
    }

    const result = await factCheckMatch(
      homeTeam,
      awayTeam,
      competition ?? "Football",
      suggestedOutcome ?? "Victoire"
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
