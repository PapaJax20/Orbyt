"use client";

import { useState, useCallback } from "react";
import {
  Building2,
  RefreshCw,
  Unlink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

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

export function ConnectedBanks() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.plaid.listItems.useQuery();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const syncMutation = trpc.plaid.syncTransactions.useMutation({
    onSuccess: (data) => {
      utils.plaid.listItems.invalidate();
      utils.plaid.listAccounts.invalidate();
      utils.finances.listTransactions.invalidate();
      toast.success(`Synced: ${data.added} added, ${data.modified} updated, ${data.removed} removed`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to sync transactions");
    },
  });

  const balanceMutation = trpc.plaid.refreshBalances.useMutation({
    onSuccess: (data) => {
      utils.plaid.listItems.invalidate();
      utils.plaid.listAccounts.invalidate();
      utils.finances.listAccounts.invalidate();
      toast.success(`Updated ${data.updated} account balances`);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to refresh balances");
    },
  });

  const disconnectMutation = trpc.plaid.disconnectItem.useMutation({
    onSuccess: () => {
      utils.plaid.listItems.invalidate();
      utils.plaid.listAccounts.invalidate();
      setDisconnectingId(null);
      toast.success("Bank disconnected");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to disconnect bank");
    },
  });

  const handleSync = useCallback(
    (itemId: string) => {
      syncMutation.mutate({ itemId });
    },
    [syncMutation]
  );

  const handleRefreshBalances = useCallback(
    (itemId: string) => {
      balanceMutation.mutate({ itemId });
    },
    [balanceMutation]
  );

  const handleDisconnect = useCallback(
    (itemId: string) => {
      disconnectMutation.mutate({ itemId });
    },
    [disconnectMutation]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const isSyncing =
          syncMutation.isPending && syncMutation.variables?.itemId === item.id;
        const isRefreshing =
          balanceMutation.isPending && balanceMutation.variables?.itemId === item.id;
        const isDisconnecting =
          disconnectMutation.isPending && disconnectMutation.variables?.itemId === item.id;
        const showDisconnectConfirm = disconnectingId === item.id;

        return (
          <div key={item.id} className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20">
                <Building2 size={20} className="text-green-500" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  {item.institutionName ?? "Connected Bank"}
                </p>
                <p className="truncate text-xs text-text-muted">
                  Item: {item.plaidItemId.slice(0, 8)}...
                </p>
              </div>
              {/* Status badge */}
              {item.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-500">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  Active
                </span>
              ) : item.status === "login_required" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-500">
                  <AlertCircle size={12} aria-hidden="true" />
                  Re-link Required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
                  <AlertCircle size={12} aria-hidden="true" />
                  Error
                </span>
              )}
            </div>

            {/* Sync status */}
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {item.syncError ? (
                <>
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <span className="text-red-400">Sync error</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  <span>Connected</span>
                </>
              )}
              <span className="ml-auto flex items-center gap-1">
                <Clock size={10} aria-hidden="true" />
                Last synced: {relativeTime(item.lastSyncAt)}
              </span>
            </div>

            {/* Error details */}
            {item.syncError && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {item.syncError}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSync(item.id)}
                disabled={isSyncing || item.status !== "active"}
                aria-label="Sync transactions"
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={14} aria-hidden="true" />
                )}
                {isSyncing ? "Syncing..." : "Sync Transactions"}
              </button>

              <button
                type="button"
                onClick={() => handleRefreshBalances(item.id)}
                disabled={isRefreshing || item.status !== "active"}
                aria-label="Refresh balances"
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
              >
                {isRefreshing ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw size={14} aria-hidden="true" />
                )}
                {isRefreshing ? "Refreshing..." : "Refresh Balances"}
              </button>

              {showDisconnectConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDisconnect(item.id)}
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
                  onClick={() => setDisconnectingId(item.id)}
                  aria-label="Disconnect bank"
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
  );
}
