import { Logo } from "@/components/logo";
import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size={32} wordmarkClassName="text-xl" />
        </div>

        <div
          className="rounded-lg border p-6"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <h1 className="text-lg font-semibold">Connexion</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            Panneau admin — accès personnel.
          </p>

          {params.error && (
            <p
              className="mt-4 rounded-md px-3 py-2 text-sm"
              style={{
                background: "color-mix(in srgb, var(--color-danger) 15%, transparent)",
                color: "var(--color-danger)",
              }}
            >
              {params.error}
            </p>
          )}
          {params.message && (
            <p
              className="mt-4 rounded-md px-3 py-2 text-sm"
              style={{
                background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                color: "var(--color-success)",
              }}
            >
              {params.message}
            </p>
          )}

          <form className="mt-5 flex flex-col gap-3">
            <label
              className="text-xs font-medium tracking-wide uppercase"
              style={{ color: "var(--color-muted)" }}
            >
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </label>
            <label
              className="text-xs font-medium tracking-wide uppercase"
              style={{ color: "var(--color-muted)" }}
            >
              Mot de passe
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </label>

            <div className="mt-2 flex gap-2">
              <button
                formAction={signIn}
                className="flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: "var(--color-amber)",
                  color: "var(--color-ground)",
                }}
              >
                Se connecter
              </button>
              <button
                formAction={signUp}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                Créer un compte
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
