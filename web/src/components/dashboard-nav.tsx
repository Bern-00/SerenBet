"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/matches", label: "Matchs à venir" },
  { href: "/dashboard/picks", label: "Top Picks" },
  { href: "/dashboard/suggestions", label: "Suggestions" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-5 text-sm">
      {LINKS.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors"
            style={{ color: active ? "var(--color-text)" : "var(--color-muted)" }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
