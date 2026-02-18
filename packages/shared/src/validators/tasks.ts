import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);
export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).nullable().optional(),
  status: TaskStatusSchema.default("todo"),
  priority: TaskPrioritySchema.default("medium"),
  dueAt: z.string().datetime().nullable().optional(),
  rrule: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).default([]),
  assigneeIds: z.array(z.string().uuid()).default([]),
  parentTaskId: z.string().uuid().nullable().optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const UpdateTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: TaskStatusSchema,
});

export const AddTaskCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export const ListTasksSchema = z.object({
  status: z.array(TaskStatusSchema).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  priority: z.array(TaskPrioritySchema).optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  includeSubtasks: z.boolean().default(false),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type ListTasksInput = z.infer<typeof ListTasksSchema>;
