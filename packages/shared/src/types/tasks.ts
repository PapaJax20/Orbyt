export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  householdId: string;
  createdBy: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  completedAt: Date | null;
  rrule: string | null;
  tags: string[];
  assignees: TaskAssignee[];
  subtasks?: Task[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskAssignee {
  taskId: string;
  userId: string;
  assignedAt: Date;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    displayColor: string;
  };
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
