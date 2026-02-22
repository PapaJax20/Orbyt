import { EmptyState } from "@/components/ui/empty-state";

export function NotificationsTab() {
  return (
    <EmptyState
      character="rosie"
      expression="thinking"
      title="Notifications coming soon"
      description="We're working on notification preferences. You'll be able to customize alerts for tasks, bills, and events here."
    />
  );
}
