"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  CheckSquare,
  ShoppingCart,
  DollarSign,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/finances", label: "Finances", icon: DollarSign },
  { href: "/contacts", label: "Contacts", icon: Users },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="hidden md:flex w-16 flex-col items-center gap-2 border-r py-4 lg:w-56 lg:items-start lg:px-3"
      style={{
        borderColor: "rgb(var(--color-border) / 0.15)",
        background: "rgb(var(--color-bg-subtle) / 0.5)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <div className="mb-4 flex w-full items-center gap-3 px-2 lg:px-3">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "linear-gradient(135deg, rgb(var(--color-accent)), rgb(var(--color-accent-hover)))",
            boxShadow: "0 0 12px rgb(var(--color-accent) / 0.4)",
          }}
        >
          <span className="font-display text-sm font-bold text-bg">O</span>
        </div>
        <span className="hidden font-display text-lg font-bold text-text lg:block glow-text">
          Orbyt
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex w-full flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-all lg:px-3 ${
              isActive(item.href)
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-surface/50 hover:text-text"
            }`}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden lg:block">{item.label}</span>
            {isActive(item.href) && (
              <span
                className="ml-auto hidden h-1.5 w-1.5 rounded-full lg:block"
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
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-all lg:px-3 ${
              isActive(item.href)
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:bg-surface/50 hover:text-text"
            }`}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden lg:block">{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
