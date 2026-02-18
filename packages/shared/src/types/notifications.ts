export type NotificationType =
  | "event_reminder"
  | "bill_due"
  | "task_assigned"
  | "task_completed"
  | "member_joined"
  | "shopping_item_added"
  | "birthday_reminder"
  | "system";

export type NotificationChannel = "push" | "email" | "in_app";

export interface Notification {
  id: string;
  userId: string;
  householdId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: NotificationData;
  readAt: Date | null;
  sentAt: Date | null;
  channels: NotificationChannel[];
  createdAt: Date;
}

export interface NotificationData {
  route?: string; // deep link route e.g. "/calendar", "/tasks/[id]"
  entityId?: string;
  entityType?: "event" | "task" | "bill" | "contact" | "shopping_list";
}
