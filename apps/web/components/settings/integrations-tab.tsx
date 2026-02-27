"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  RefreshCw,
  Unlink,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
  Bell,
  BellOff,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { ConnectedBanks } from "@/components/plaid/connected-banks";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";

// ── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: "google" as const,
    label: "Google Calendar",
    description: "Sync events from your Google Calendar",
    color: "#4285F4",
  },
  {
    id: "microsoft" as const,
    label: "Microsoft Calendar",
    description: "Sync events from your Outlook / Microsoft 365 calendar",
    color: "#00A4EF",
  },
] as const;

type Provider = (typeof PROVIDERS)[number]["id"];

// ── Scope helpers ────────────────────────────────────────────────────────────

function hasWriteScopes(provider: string, scopes: string | null): boolean {
  if (!scopes) return false;
  if (provider === "google") return scopes.includes("calendar");
  if (provider === "microsoft") return scopes.includes("ReadWrite");
  return false;
}

// ── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(date: Date | string | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return "Just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

/** Returns true when lastSyncAt is more than 1 hour ago or missing */
function isSyncStale(lastSyncAt: Date | string | null): boolean {
  if (!lastSyncAt) return true;
  const d = new Date(lastSyncAt);
  return Date.now() - d.getTime() > 60 * 60 * 1000;
}

// ── IntegrationsTab ──────────────────────────────────────────────────────────

export function IntegrationsTab() {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();

  // Track which provider is currently connecting (for loading state on button)
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);
  // Track which account is being disconnected (for confirmation)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  // Track whether the OAuth callback has been handled
  const [callbackHandled, setCallbackHandled] = useState(false);
  // Client-side webhook active tracking (optimistic) keyed by accountId
  const [webhookActive, setWebhookActive] = useState<Record<string, boolean>>({});

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: accounts, isLoading } = trpc.integrations.listConnectedAccounts.useQuery();

  // ── Mutations ────────────────────────────────────────────────────────────────

  const handleCallbackMutation = trpc.integrations.handleCallback.useMutation({
    onSuccess: () => {
      utils.integrations.listConnectedAccounts.invalidate();
      toast.success("Calendar connected successfully!");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to connect calendar");
    },
  });

  const syncMutation = trpc.integrations.syncCalendar.useMutation({
    onSuccess: (data) => {
      utils.integrations.listConnectedAccounts.invalidate();
      utils.integrations.listExternalEvents.invalidate();
      toast.success(`Synced ${data.synced} events`);
    },
    onError: (err) => {
      utils.integrations.listConnectedAccounts.invalidate();
      toast.error(err.message ?? "Failed to sync calendar");
    },
  });

  const disconnectMutation = trpc.integrations.disconnectAccount.useMutation({
    onSuccess: () => {
      utils.integrations.listConnectedAccounts.invalidate();
      utils.integrations.listExternalEvents.invalidate();
      setDisconnectingId(null);
      toast.success("Calendar disconnected");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to disconnect calendar");
    },
  });

  const registerWebhookMutation = trpc.integrations.registerWebhook.useMutation({
    onSuccess: (_data, variables) => {
      utils.integrations.listConnectedAccounts.invalidate();
      setWebhookActive((prev) => ({ ...prev, [variables.accountId]: true }));
      toast.success("Real-time sync enabled");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to enable real-time sync");
    },
  });

  const unregisterWebhookMutation = trpc.integrations.unregisterWebhook.useMutation({
    onSuccess: (_data, variables) => {
      utils.integrations.listConnectedAccounts.invalidate();
      setWebhookActive((prev) => ({ ...prev, [variables.accountId]: false }));
      toast.success("Real-time sync disabled");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to disable real-time sync");
    },
  });

  const testTxnMutation = trpc.plaid.createTestTransactions.useMutation({
    onSuccess: (data) => {
      utils.plaid.invalidate();
      toast.success(data.message ?? "Test transactions created — click Sync Transactions to pull them in");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create test transactions");
    },
  });

  const wipePlaidMutation = trpc.plaid.wipePlaidTransactions.useMutation({
    onSuccess: (data) => {
      utils.finances.invalidate();
      utils.plaid.invalidate();
      toast.success(`Deleted ${data.deleted} Plaid transactions`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to reset Plaid data");
    },
  });

  // ── OAuth callback handling on mount ─────────────────────────────────────────

  useEffect(() => {
    if (callbackHandled) return;

    const provider = searchParams.get("provider") as Provider | null;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      toast.error(`OAuth error: ${error}`);
      // Clean up URL params
      window.history.replaceState({}, "", "/settings?tab=integrations");
      setCallbackHandled(true);
      return;
    }

    if (provider && code && state) {
      // Verify CSRF state
      const storedState = sessionStorage.getItem(`orbyt_oauth_state_${provider}`);
      if (storedState !== state) {
        toast.error("OAuth state mismatch. Please try connecting again.");
        window.history.replaceState({}, "", "/settings?tab=integrations");
        setCallbackHandled(true);
        return;
      }

      // Clean up sessionStorage
      sessionStorage.removeItem(`orbyt_oauth_state_${provider}`);

      // Exchange code for tokens
      handleCallbackMutation.mutate(
        { provider, code, state },
        {
          onSettled: () => {
            // Clean up URL params regardless of success or error
            window.history.replaceState({}, "", "/settings?tab=integrations");
          },
        },
      );
      setCallbackHandled(true);
    }
  }, [searchParams, callbackHandled, handleCallbackMutation]);

  // ── Connect handler ──────────────────────────────────────────────────────────

  const handleConnect = useCallback(
    async (provider: Provider) => {
      setConnectingProvider(provider);
      try {
        const result = await utils.integrations.getOAuthUrl.fetch({ provider });
        // Store state in sessionStorage for CSRF verification
        sessionStorage.setItem(`orbyt_oauth_state_${provider}`, result.state);
        // Redirect to OAuth provider
        window.location.href = result.url;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start OAuth flow";
        toast.error(message);
        setConnectingProvider(null);
      }
    },
    [utils],
  );

  // ── Sync handler ─────────────────────────────────────────────────────────────

  const handleSync = useCallback(
    (accountId: string) => {
      syncMutation.mutate({ accountId });
    },
    [syncMutation],
  );

  // ── Disconnect handler ───────────────────────────────────────────────────────

  const handleDisconnect = useCallback(
    (accountId: string) => {
      disconnectMutation.mutate({ accountId });
    },
    [disconnectMutation],
  );

  // ── Webhook handlers ─────────────────────────────────────────────────────────

  const handleEnableWebhook = useCallback(
    (accountId: string) => {
      registerWebhookMutation.mutate({ accountId });
    },
    [registerWebhookMutation],
  );

  const handleDisableWebhook = useCallback(
    (accountId: string) => {
      unregisterWebhookMutation.mutate({ accountId });
    },
    [unregisterWebhookMutation],
  );

  // ── Loading state ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  // ── Determine which providers are already connected ──────────────────────────

  const connectedProviders = new Set(accounts?.map((a) => a.provider) ?? []);

  return (
    <div className="flex max-w-lg flex-col gap-8">
      {/* Section header */}
      <div>
        <p className="orbyt-label">Connected Calendars</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Connect your Google or Microsoft calendar to sync events bidirectionally with Orbyt.
        </p>
      </div>

      {/* Connected accounts list */}
      {accounts && accounts.length > 0 && (
        <div className="flex flex-col gap-3">
          {accounts.map((account) => {
            const providerConfig = PROVIDERS.find((p) => p.id === account.provider);
            const isSyncing = syncMutation.isPending && syncMutation.variables?.accountId === account.id;
            const isDisconnecting =
              disconnectMutation.isPending && disconnectMutation.variables?.accountId === account.id;
            const showDisconnectConfirm = disconnectingId === account.id;

            // Scope detection — use scopes from listConnectedAccounts
            const hasWrite = hasWriteScopes(account.provider, account.scopes ?? null);
            const needsReauth = !hasWrite;

            // Webhook state (optimistic)
            const isWebhookActive = webhookActive[account.id] ?? false;
            const isRegisteringWebhook =
              registerWebhookMutation.isPending &&
              registerWebhookMutation.variables?.accountId === account.id;
            const isUnregisteringWebhook =
              unregisterWebhookMutation.isPending &&
              unregisterWebhookMutation.variables?.accountId === account.id;

            // Sync status for enhanced display
            const hasSyncError = !!account.syncError;
            const stale = isSyncStale(account.lastSyncAt);

            return (
              <div
                key={account.id}
                className="glass-card flex flex-col gap-3 rounded-2xl p-4"
              >
                {/* Account info row */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${providerConfig?.color ?? "#64748B"}20` }}
                  >
                    <Calendar
                      size={20}
                      style={{ color: providerConfig?.color ?? "#64748B" }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">
                      {providerConfig?.label ?? account.provider}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {account.email ?? "Unknown email"}
                    </p>
                  </div>
                  {/* Scope badge */}
                  {hasWrite ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-500">
                      <Shield size={12} aria-hidden="true" />
                      Read &amp; Write
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-500">
                      <ShieldAlert size={12} aria-hidden="true" />
                      Read-only
                    </span>
                  )}
                </div>

                {/* Upgrade permissions prompt for read-only accounts */}
                {needsReauth && (
                  <button
                    type="button"
                    onClick={() => handleConnect(account.provider as Provider)}
                    disabled={connectingProvider === account.provider}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {connectingProvider === account.provider ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Shield size={14} aria-hidden="true" />
                    )}
                    Upgrade Permissions
                  </button>
                )}

                {/* Enhanced sync status display */}
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {hasSyncError ? (
                    <>
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span className="text-red-400">Sync error</span>
                    </>
                  ) : isWebhookActive ? (
                    <>
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
                      <span className="text-green-500">Real-time sync active</span>
                    </>
                  ) : (
                    <>
                      <span
                        className={[
                          "inline-block h-2 w-2 shrink-0 rounded-full",
                          stale ? "bg-amber-500" : "bg-green-500",
                        ].join(" ")}
                      />
                      <span>Manual sync only</span>
                    </>
                  )}
                  <span className="ml-auto">
                    Last synced: {relativeTime(account.lastSyncAt)}
                  </span>
                </div>

                {/* Sync error details */}
                {account.syncError && (
                  <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {account.syncError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSync(account.id)}
                    disabled={isSyncing}
                    aria-label={`Sync ${providerConfig?.label ?? "calendar"}`}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw size={14} aria-hidden="true" />
                    )}
                    {isSyncing ? "Syncing..." : "Sync Now"}
                  </button>

                  {/* Webhook toggle — requires write scopes */}
                  {isWebhookActive ? (
                    <button
                      type="button"
                      onClick={() => handleDisableWebhook(account.id)}
                      disabled={isUnregisteringWebhook}
                      aria-label="Disable real-time sync"
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      {isUnregisteringWebhook ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <BellOff size={14} aria-hidden="true" />
                      )}
                      {isUnregisteringWebhook ? "Disabling..." : "Disable Real-time Sync"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEnableWebhook(account.id)}
                      disabled={isRegisteringWebhook || !hasWrite}
                      aria-label={hasWrite ? "Enable real-time sync" : "Upgrade permissions to enable real-time sync"}
                      title={!hasWrite ? "Write permissions required for real-time sync" : undefined}
                      className={[
                        "flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50",
                        hasWrite
                          ? "border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20"
                          : "border border-border bg-surface/50 text-text-muted cursor-not-allowed",
                      ].join(" ")}
                    >
                      {isRegisteringWebhook ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Bell size={14} aria-hidden="true" />
                      )}
                      {isRegisteringWebhook ? "Enabling..." : "Enable Real-time Sync"}
                    </button>
                  )}

                  {showDisconnectConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDisconnect(account.id)}
                        disabled={isDisconnecting}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                      >
                        {isDisconnecting ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Unlink size={14} aria-hidden="true" />
                        )}
                        {isDisconnecting ? "Disconnecting..." : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisconnectingId(null)}
                        className="min-h-[44px] rounded-xl border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDisconnectingId(account.id)}
                      aria-label={`Disconnect ${providerConfig?.label ?? "calendar"}`}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-red-400"
                    >
                      <Unlink size={14} aria-hidden="true" />
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {(!accounts || accounts.length === 0) && (
        <div className="glass-card flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
          <div className="rounded-2xl bg-surface p-4 text-text-muted">
            <Calendar size={32} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">No calendars connected</p>
            <p className="mt-1 text-xs text-text-muted">
              Connect your Google or Microsoft calendar to see external events in Orbyt.
            </p>
          </div>
        </div>
      )}

      {/* Connect buttons */}
      <div>
        <p className="orbyt-label">Add a Calendar</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Connect a new external calendar account.
        </p>
        <div className="flex flex-col gap-3">
          {PROVIDERS.map((provider) => {
            const isConnected = connectedProviders.has(provider.id);
            const isConnecting = connectingProvider === provider.id;

            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleConnect(provider.id)}
                disabled={isConnecting}
                className={[
                  "glass-card-subtle flex items-center gap-3 rounded-2xl p-4 text-left transition-all",
                  isConnecting
                    ? "cursor-wait opacity-70"
                    : "cursor-pointer hover:bg-surface/80",
                ].join(" ")}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${provider.color}20` }}
                >
                  {isConnecting ? (
                    <Loader2
                      size={20}
                      className="animate-spin"
                      style={{ color: provider.color }}
                      aria-hidden="true"
                    />
                  ) : (
                    <ExternalLink
                      size={20}
                      style={{ color: provider.color }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">
                    {isConnected ? `Reconnect ${provider.label}` : `Connect ${provider.label}`}
                  </p>
                  <p className="text-xs text-text-muted">{provider.description}</p>
                </div>
                {isConnected && (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] text-text-muted">
                    Connected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Callback handling indicator */}
      {handleCallbackMutation.isPending && (
        <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
          <Loader2 size={20} className="animate-spin text-accent" aria-hidden="true" />
          <p className="text-sm text-text">Connecting your calendar...</p>
        </div>
      )}

      {/* Bank Connections (Plaid) */}
      <div>
        <p className="orbyt-label">Connected Banks</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Connect your bank accounts via Plaid to automatically import transactions and track balances.
        </p>
      </div>

      <ConnectedBanks />

      <div>
        <p className="orbyt-label">Add a Bank Account</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Securely connect a new bank or credit card account.
        </p>
        <PlaidLinkButton />
      </div>

      {/* Sandbox Tools */}
      <div>
        <p className="orbyt-label">Sandbox Tools</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Test tools for Plaid sandbox environment.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => testTxnMutation.mutate()}
            disabled={testTxnMutation.isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface/50 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testTxnMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <FlaskConical size={16} aria-hidden="true" />
            )}
            {testTxnMutation.isPending ? "Creating..." : "Create Test Transactions"}
          </button>
          <button
            type="button"
            onClick={() => wipePlaidMutation.mutate()}
            disabled={wipePlaidMutation.isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface/50 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {wipePlaidMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 size={16} aria-hidden="true" />
            )}
            {wipePlaidMutation.isPending ? "Resetting..." : "Reset Transactions"}
          </button>
        </div>
      </div>
    </div>
  );
}
