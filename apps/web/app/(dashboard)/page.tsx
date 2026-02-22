// This file is at the route group root (URL: /).
// app/page.tsx takes precedence and redirects / → /dashboard.
// The actual dashboard page is at app/(dashboard)/dashboard/page.tsx (URL: /dashboard).
import { redirect } from 'next/navigation';

export default function DashboardGroupRootPage() {
  redirect('/dashboard');
}
