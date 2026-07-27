"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/value-bets", label: "Value bets" },
  { href: "/admin/bankroll", label: "Bankroll" },
  { href: "/admin/backtests", label: "Backtests" },
  { href: "/admin/settings", label: "Réglages" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-5 text-sm">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
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
