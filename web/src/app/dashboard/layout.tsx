import { requireUser } from "@/lib/supabase/require-user";
import { Logo } from "@/components/logo";
import { DashboardNav } from "@/components/dashboard-nav";
import { signOut } from "@/app/login/actions";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header
        className="border-b"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface-2)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-3.5">
          <div className="flex items-center gap-6">
            <Logo size={22} wordmarkClassName="text-sm" />
            {/* Séparateur visuel */}
            <span
              className="h-4 w-px"
              style={{ background: "var(--color-border)" }}
            />
            {/* Badge "Parieur" */}
            <span
              className="font-mono text-[11px] tracking-widest uppercase rounded-full px-2.5 py-0.5"
              style={{
                background: "color-mix(in srgb, var(--color-amber) 15%, transparent)",
                color: "var(--color-amber)",
              }}
            >
              Parieur
            </span>
          </div>

          <DashboardNav />

          <div className="flex items-center gap-3">
            <form action={async () => {
              "use server";
              const { refreshDashboardOdds } = await import("@/app/dashboard/actions");
              await refreshDashboardOdds();
            }}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "color-mix(in srgb, var(--color-amber) 15%, transparent)",
                  color: "var(--color-amber)",
                  border: "1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)",
                }}
                title="Actualiser les cotes et suggestions (Sync 24h)"
              >
                <span>🔄 Sync 24h</span>
              </button>
            </form>

            <Link
              href="/admin"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--color-muted)" }}
            >
              ← Admin
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs transition-colors"
                style={{ color: "var(--color-muted)" }}
              >
                {user.email} · Déco
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        {children}
      </main>

      <footer
        className="mx-auto w-full max-w-6xl px-8 py-4 text-[11px]"
        style={{ color: "var(--color-muted)" }}
      >
        Les probabilités et suggestions sont produites par un modèle statistique. Aucune garantie de résultat.
        Usage personnel uniquement.
      </footer>
    </div>
  );
}
