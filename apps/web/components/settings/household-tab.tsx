"use client";

import { useState, useEffect } from "react";
import { UserX, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { copyInviteLink } from "@/lib/utils/invite-link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type HouseholdData = RouterOutput["household"]["getCurrent"];
type Member = HouseholdData["members"][number];

// ── HouseholdTab ──────────────────────────────────────────────────────────────

export function HouseholdTab() {
  const utils = trpc.useUtils();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: household } = trpc.household.getCurrent.useQuery();
  const me = household?.members.find((m) => m.userId === userId);
  const isAdmin = me?.role === "admin";

  // ── Household name ────────────────────────────────────────────────────────

  const [householdName, setHouseholdName] = useState("");
  const [nameSynced, setNameSynced] = useState(false);

  useEffect(() => {
    if (household?.name && !nameSynced) {
      setHouseholdName(household.name);
      setNameSynced(true);
    }
  }, [household?.name, nameSynced]);

  const updateHousehold = trpc.household.update.useMutation({
    onSuccess: () => {
      utils.household.getCurrent.invalidate();
      toast.success("Household updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update household"),
  });

  // ── Remove member ─────────────────────────────────────────────────────────

  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const removeMember = trpc.household.removeMember.useMutation({
    onSuccess: () => {
      utils.household.getCurrent.invalidate();
      toast.success("Member removed");
      setMemberToRemove(null);
    },
    onError: (err) => toast.error(err.message ?? "Failed to remove member"),
  });

  function handleRemoveClick(member: Member) {
    const adminCount =
      household?.members.filter((m) => m.role === "admin").length ?? 0;
    if (member.role === "admin" && adminCount <= 1) {
      toast.error(
        "Cannot remove the last admin. Promote another member first."
      );
      return;
    }
    setMemberToRemove(member);
  }

  // ── Invite member ─────────────────────────────────────────────────────────

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "child">(
    "member"
  );
  const [copied, setCopied] = useState(false);

  const inviteMember = trpc.household.inviteMember.useMutation({
    onSuccess: async (invitation) => {
      if (!invitation) return;
      const ok = await copyInviteLink(invitation.token);
      if (ok) {
        toast.success("Invite link copied! Share it with your family member.");
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        toast.info(`Invite token: ${invitation.token}`);
      }
      setInviteEmail("");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create invite"),
  });

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (!household) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      {/* Household Name */}
      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateHousehold.mutate({ name: householdName.trim() });
          }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Household
          </h2>
          <div>
            <label className="orbyt-label" htmlFor="household-name">
              Name
            </label>
            <input
              id="household-name"
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="orbyt-input mt-1 w-full"
              maxLength={100}
              required
            />
          </div>
          <button
            type="submit"
            disabled={updateHousehold.isPending || !householdName.trim()}
            className="orbyt-button-accent self-start"
          >
            {updateHousehold.isPending ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {/* Members */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Members
        </h2>
        <div className="flex flex-col gap-2">
          {household.members.map((member) => {
            const label =
              member.profile?.displayName ??
              member.profile?.email ??
              "Unknown";
            return (
              <div
                key={member.userId}
                className="glass-card flex items-center justify-between rounded-xl px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: member.displayColor }}
                  >
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">
                      {label}
                      {member.userId === userId && (
                        <span className="ml-2 text-xs text-text-muted">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">
                      {member.profile?.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium capitalize text-text-muted">
                    {member.role}
                  </span>
                  {isAdmin && member.userId !== userId && (
                    <button
                      onClick={() => handleRemoveClick(member)}
                      aria-label={`Remove ${label}`}
                      className="orbyt-button-ghost p-1.5 text-red-400 hover:bg-red-500/10"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite */}
      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteMember.mutate({
              email: inviteEmail.trim(),
              role: inviteRole,
            });
          }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Invite Member
          </h2>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="orbyt-input"
              placeholder="family@example.com"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(
                  e.target.value as "admin" | "member" | "child"
                )
              }
              className="orbyt-input"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="child">Child</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteMember.isPending || !inviteEmail.trim()}
            className="orbyt-button-accent flex items-center gap-2 self-start"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {inviteMember.isPending
              ? "Creating…"
              : copied
                ? "Copied!"
                : "Create Invite Link"}
          </button>
          <p className="text-xs text-text-muted">
            An invite link will be copied to your clipboard.
          </p>
        </form>
      )}

      {/* Remove Confirm Dialog */}
      <ConfirmDialog
        open={!!memberToRemove}
        title="Remove member?"
        description={`${memberToRemove?.profile?.displayName ?? "This member"} will lose access to the household.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() =>
          memberToRemove &&
          removeMember.mutate({ userId: memberToRemove.userId })
        }
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
}
