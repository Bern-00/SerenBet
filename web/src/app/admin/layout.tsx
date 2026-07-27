import { requireUser } from "@/lib/supabase/require-user";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin-nav";
import { signOut } from "@/app/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header
        className="border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-3.5">
          <Logo size={22} wordmarkClassName="text-sm" />
          <AdminNav />
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs"
              style={{ color: "var(--color-muted)" }}
            >
              {user.email} · Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
