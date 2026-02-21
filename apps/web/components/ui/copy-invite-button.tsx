"use client";

import { useState } from "react";
import { Link, Check } from "lucide-react";
import { toast } from "sonner";
import { copyInviteLink } from "@/lib/utils/invite-link";

interface CopyInviteButtonProps {
  token: string;
  className?: string;
}

export function CopyInviteButton({ token, className = "" }: CopyInviteButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const success = await copyInviteLink(token);
    if (success) {
      setCopied(true);
      toast.success("Invite link copied! Share it with your family member.");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy to clipboard. Please copy the link manually.");
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy invite link"
      className={`inline-flex items-center gap-2 orbyt-button-ghost ${className}`}
    >
      {copied ? <Check size={16} className="text-green-500" /> : <Link size={16} />}
      {copied ? "Copied!" : "Copy Invite Link"}
    </button>
  );
}
