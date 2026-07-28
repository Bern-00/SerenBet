import Link from "next/link";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto w-full max-w-5xl px-8 pt-6">
        <Logo />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-8 py-16">
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          La rigueur du <span style={{ color: "var(--color-amber)" }}>quant</span>,
          <br />
          pas l&apos;adrénaline du pari.
        </h1>
        <p
          className="mt-5 max-w-xl text-lg leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          Un modèle qui calcule des probabilités, les compare au marché, et ne
          prétend jamais garantir un résultat. L&apos;edge se compte en points
          de pourcentage — le calme, en continu.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "var(--color-amber)",
              color: "var(--color-ground)",
            }}
          >
            Dashboard Parieur →
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-muted)",
            }}
          >
            Panneau admin
          </Link>
        </div>
      </main>

      <footer
        className="mx-auto w-full max-w-5xl px-8 py-6 text-xs"
        style={{ color: "var(--color-muted)" }}
      >
        Usage personnel — aucune garantie de résultat, probabilités estimées
        et backtestées.
      </footer>
    </div>
  );
}
