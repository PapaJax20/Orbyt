"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/tasks", label: "Tasks", icon: "✅" },
  { href: "/shopping", label: "Shopping", icon: "🛒" },
  { href: "/finances", label: "Finances", icon: "💰" },
  { href: "/contacts", label: "Contacts", icon: "👥" },
] as const;

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="flex w-16 flex-col items-center gap-2 border-r py-4 md:w-56 md:items-start md:px-3"
      style={{
        borderColor: "rgb(var(--color-border) / 0.15)",
        background: "rgb(var(--color-bg-subtle) / 0.5)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <div className="mb-4 flex w-full items-center gap-3 px-2 md:px-3">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "linear-gradient(135deg, rgb(var(--color-accent)), rgb(var(--color-accent-hover)))",
            boxShadow: "0 0 12px rgb(var(--color-accent) / 0.4)",
          }}
        >
          <span className="font-display text-sm font-bold text-bg">O</span>
        </div>
        <span className="hidden font-display text-lg font-bold text-text md:block glow-text">
          Orbyt
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex w-full flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-all md:px-3 ${
              isActive(item.href)
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-surface/50 hover:text-text"
            }`}
            title={item.label}
          >
            <span className="text-base">{item.icon}</span>
            <span className="hidden md:block">{item.label}</span>
            {isActive(item.href) && (
              <span
                className="ml-auto hidden h-1.5 w-1.5 rounded-full md:block"
                style={{ background: "rgb(var(--color-accent))" }}
              />
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="flex w-full flex-col gap-1 border-t pt-3" style={{ borderColor: "rgb(var(--color-border) / 0.15)" }}>
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-all md:px-3 ${
              isActive(item.href)
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-surface/50 hover:text-text"
            }`}
            title={item.label}
          >
            <span className="text-base">{item.icon}</span>
            <span className="hidden md:block">{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
