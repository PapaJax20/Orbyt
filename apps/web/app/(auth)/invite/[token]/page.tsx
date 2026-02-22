import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Join Household" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <InviteForm token={token} isLoggedIn={!!user} />;
}
