"use client";

import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const utils = trpc.useUtils();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const createLinkToken = trpc.plaid.createLinkToken.useMutation({
    onSuccess: (data) => {
      setLinkToken(data.linkToken);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to initialize bank connection");
    },
  });

  const exchangeToken = trpc.plaid.exchangePublicToken.useMutation({
    onSuccess: (data) => {
      utils.plaid.listItems.invalidate();
      utils.plaid.listAccounts.invalidate();
      utils.finances.listAccounts.invalidate();
      toast.success(
        data.isRelink
          ? "Bank account re-linked successfully!"
          : "Bank account connected successfully!"
      );
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to connect bank account");
    },
  });

  const handleOnSuccess = useCallback(
    (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
      exchangeToken.mutate({
        publicToken,
        institutionId: metadata.institution?.institution_id ?? undefined,
        institutionName: metadata.institution?.name ?? undefined,
      });
    },
    [exchangeToken]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: (err) => {
      if (err) {
        toast.error("Bank connection was interrupted");
      }
      setLinkToken(null);
    },
  });

  const handleClick = useCallback(() => {
    if (linkToken && ready) {
      open();
    } else {
      createLinkToken.mutate();
    }
  }, [linkToken, ready, open, createLinkToken]);

  // Open Plaid Link automatically when token is ready
  if (linkToken && ready) {
    // Auto-open on next tick
    setTimeout(() => open(), 0);
  }

  const isLoading = createLinkToken.isPending || exchangeToken.isPending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="glass-card-subtle flex items-center gap-3 rounded-2xl p-4 text-left transition-all cursor-pointer hover:bg-surface/80 disabled:cursor-wait disabled:opacity-70 w-full"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20">
        {isLoading ? (
          <Loader2 size={20} className="animate-spin text-green-500" aria-hidden="true" />
        ) : (
          <Building2 size={20} className="text-green-500" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">
          {isLoading ? "Connecting..." : "Connect Bank Account"}
        </p>
        <p className="text-xs text-text-muted">
          Securely link your bank via Plaid to auto-import transactions
        </p>
      </div>
    </button>
  );
}
