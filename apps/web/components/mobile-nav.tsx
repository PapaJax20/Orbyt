"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  CheckSquare,
  ShoppingCart,
  Calendar,
  Menu,
  DollarSign,
  Users,
  Settings,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY_TABS = [
  { icon: Home, label: "Home", href: "/dashboard" },
  { icon: CheckSquare, label: "Tasks", href: "/tasks" },
  { icon: ShoppingCart, label: "Shop", href: "/shopping" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
];

const MORE_ITEMS = [
  { icon: DollarSign, label: "Finances", href: "/finances" },
  { icon: Users, label: "Contacts", href: "/contacts" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* More sheet backdrop */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More bottom sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-x-0 bottom-16 z-50 md:hidden glass-card-elevated rounded-t-2xl p-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="p-1 rounded-lg text-text-secondary hover:text-text"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                    pathname === item.href
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:text-text hover:bg-surface"
                  }`}
                >
                  <item.icon size={22} />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 glass-card-elevated flex items-center justify-around md:hidden z-50 border-t border-border">
        {PRIMARY_TABS.map((tab) => (
          <NavTab
            key={tab.href}
            icon={tab.icon}
            label={tab.label}
            href={tab.href}
            active={pathname === tab.href}
          />
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More navigation"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] ${
            moreOpen ? "text-accent" : "text-text-secondary"
          }`}
        >
          <Menu size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* Bottom padding so content doesn't hide behind nav on mobile */}
      <div className="h-16 md:hidden" aria-hidden="true" />
    </>
  );
}

function NavTab({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] ${
        active ? "text-accent" : "text-text-secondary hover:text-text"
      }`}
    >
      <Icon size={22} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
