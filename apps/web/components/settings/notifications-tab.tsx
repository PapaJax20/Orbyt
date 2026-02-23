"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellOff,
  Calendar,
  CreditCard,
  CheckSquare,
  ListChecks,
  Cake,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

// ── Notification type config ────────────────────────────────────────────────

const NOTIFICATION_TYPES = [
  {
    key: "eventReminder" as const,
    label: "Event Reminders",
    description: "Get notified before calendar events start",
    Icon: Calendar,
  },
  {
    key: "billDue" as const,
    label: "Bill Due Alerts",
    description: "Receive alerts when bills are due soon",
    Icon: CreditCard,
  },
  {
    key: "taskAssigned" as const,
    label: "Task Assigned",
    description: "Get notified when a task is assigned to you",
    Icon: CheckSquare,
  },
  {
    key: "taskCompleted" as const,
    label: "Task Completed",
    description: "Get notified when assigned tasks are completed",
    Icon: ListChecks,
  },
  {
    key: "birthdayReminder" as const,
    label: "Birthday Reminders",
    description: "Reminders for upcoming contact birthdays",
    Icon: Cake,
  },
  {
    key: "memberJoined" as const,
    label: "Member Joined",
    description: "Get notified when someone joins your household",
    Icon: UserPlus,
  },
];

type PrefKey = (typeof NOTIFICATION_TYPES)[number]["key"];

// ── Push notification status ────────────────────────────────────────────────

type PushStatus = "unsupported" | "denied" | "default" | "granted";

function getPushStatus(): PushStatus {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  return Notification.permission as PushStatus;
}

// ── NotificationsTab ────────────────────────────────────────────────────────

export function NotificationsTab() {
  const utils = trpc.useUtils();

  // Preferences query
  const { data: prefs, isLoading } = trpc.notifications.getPreferences.useQuery();

  // Push status
  const [pushStatus, setPushStatus] = useState<PushStatus>("default");
  const [pushRegistering, setPushRegistering] = useState(false);

  useEffect(() => {
    setPushStatus(getPushStatus());
  }, []);

  // Mutations
  const updatePrefs = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
      toast.success("Notification preference updated");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update preference");
    },
  });

  const registerPushToken = trpc.notifications.registerPushToken.useMutation({
    onSuccess: () => {
      toast.success("Push notifications enabled");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to register push notifications");
    },
  });

  // Handlers
  const handleToggle = useCallback(
    (key: PrefKey, currentlyEnabled: boolean) => {
      updatePrefs.mutate({ [key]: !currentlyEnabled });
    },
    [updatePrefs],
  );

  async function handleEnablePush() {
    if (pushStatus === "unsupported") {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    setPushRegistering(true);
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission as PushStatus);

      if (permission !== "granted") {
        toast.error("Push notification permission was denied");
        setPushRegistering(false);
        return;
      }

      // Subscribe to push via service worker
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        toast.error("Push notifications are not configured on this server");
        setPushRegistering(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // Send subscription to server
      registerPushToken.mutate({
        token: JSON.stringify(subscription),
        platform: "web",
      });

      // Also update preferences
      updatePrefs.mutate({ pushEnabled: true });
    } catch (err) {
      console.error("Push registration failed:", err);
      toast.error("Failed to enable push notifications");
    } finally {
      setPushRegistering(false);
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  // Opt-out model: undefined/null means enabled; explicit false means disabled
  const currentPrefs = prefs ?? {};

  return (
    <div className="flex max-w-lg flex-col gap-8">
      {/* Notification Type Toggles */}
      <div>
        <p className="orbyt-label">Notification Types</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Choose which notifications you want to receive.
        </p>
        <div className="flex flex-col gap-3">
          {NOTIFICATION_TYPES.map(({ key, label, description, Icon }) => {
            const isEnabled = (currentPrefs as Record<string, unknown>)[key] !== false;
            return (
              <div
                key={key}
                className="glass-card-subtle flex items-center justify-between gap-4 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/5 p-2 text-accent">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{label}</p>
                    <p className="text-xs text-text-muted">{description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`Toggle ${label}`}
                  onClick={() => handleToggle(key, isEnabled)}
                  disabled={updatePrefs.isPending}
                  className={[
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50",
                    isEnabled ? "bg-accent" : "bg-white/10",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                      isEnabled ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Push Notifications Section */}
      <div>
        <p className="orbyt-label">Push Notifications</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Receive push notifications even when Orbyt is not open.
        </p>

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/5 p-2.5 text-accent">
              {pushStatus === "granted" ? (
                <Bell size={22} aria-hidden="true" />
              ) : (
                <BellOff size={22} aria-hidden="true" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">
                Browser Push Notifications
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {pushStatus === "unsupported"
                  ? "Your browser does not support push notifications."
                  : pushStatus === "denied"
                    ? "Push notifications are blocked. Please enable them in your browser settings."
                    : pushStatus === "granted"
                      ? "Push notifications are enabled for this browser."
                      : "Enable push notifications to stay updated in real time."}
              </p>

              {/* Status badge */}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    pushStatus === "granted"
                      ? "bg-green-500/15 text-green-500"
                      : pushStatus === "denied"
                        ? "bg-red-500/15 text-red-500"
                        : pushStatus === "unsupported"
                          ? "bg-yellow-500/15 text-yellow-500"
                          : "bg-surface text-text-muted",
                  ].join(" ")}
                >
                  {pushStatus === "granted"
                    ? "Enabled"
                    : pushStatus === "denied"
                      ? "Blocked"
                      : pushStatus === "unsupported"
                        ? "Not supported"
                        : "Disabled"}
                </span>
              </div>

              {/* Enable button */}
              {pushStatus !== "granted" && pushStatus !== "unsupported" && pushStatus !== "denied" && (
                <button
                  onClick={handleEnablePush}
                  disabled={pushRegistering}
                  className="orbyt-button-accent mt-4"
                >
                  {pushRegistering ? "Enabling..." : "Enable Push Notifications"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
