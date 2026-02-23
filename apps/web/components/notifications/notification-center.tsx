"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useRealtimeInvalidation } from "@/hooks/use-realtime";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";

type RouterOutput = inferRouterOutputs<AppRouter>;
type NotificationItem = RouterOutput["notifications"]["list"][number];

// ── Relative time formatter ─────────────────────────────────────────────────

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ── Single Notification Row ─────────────────────────────────────────────────

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string, route?: string) => void;
}) {
  const isUnread = !notification.readAt;
  const route = notification.data?.route;

  return (
    <button
      onClick={() => onMarkRead(notification.id, route ?? undefined)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/50"
    >
      {/* Unread indicator dot */}
      <div className="mt-1.5 flex shrink-0">
        <span
          className={[
            "inline-block h-2 w-2 rounded-full",
            isUnread ? "bg-accent" : "bg-transparent",
          ].join(" ")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <p
          className={[
            "text-sm leading-tight",
            isUnread ? "font-semibold text-text" : "text-text-muted",
          ].join(" ")}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[11px] text-text-muted/60">
          {timeAgo(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

// ── NotificationCenter ──────────────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  // Queries
  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );
  const unreadCount = unreadData?.count ?? 0;

  const { data: notifications = [], isLoading } =
    trpc.notifications.list.useQuery(
      { limit: 20 },
      { enabled: open },
    );

  // Realtime: auto-refresh when notifications table changes
  const invalidateNotifications = useCallback(() => {
    utils.notifications.list.invalidate();
    utils.notifications.getUnreadCount.invalidate();
  }, [utils]);

  useRealtimeInvalidation("notifications", undefined, invalidateNotifications);

  // Mutations
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to mark notification as read");
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
      toast.success("All notifications marked as read");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to mark all as read");
    },
  });

  // Handlers
  function handleMarkRead(id: string, route?: string) {
    markRead.mutate({ id });
    if (route) {
      setOpen(false);
      router.push(route);
    }
  }

  function handleMarkAllRead() {
    markAllRead.mutate();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors hover:bg-surface/50"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
        >
          <Bell className="h-5 w-5 text-text-muted" />

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg"
              aria-live="polite"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="glass-card-elevated z-50 w-80 overflow-hidden rounded-2xl border sm:w-96"
          style={{ borderColor: "rgb(var(--color-border) / 0.15)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgb(var(--color-border) / 0.1)" }}>
            <h2 className="text-sm font-semibold text-text">Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-1.5 h-2 w-2 animate-pulse rounded-full bg-surface" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="mb-2 h-8 w-8 text-text-muted/40" />
                <p className="text-sm text-text-muted">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgb(var(--color-border) / 0.08)" }}>
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
