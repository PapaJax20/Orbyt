import { z } from "zod";
import { eq, and, inArray, lte, gte, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { tasks, taskAssignees, taskComments } from "@orbyt/db/schema";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  ListTasksSchema,
  AddTaskCommentSchema,
} from "@orbyt/shared/validators";
import { router, householdProcedure } from "../trpc";

export const tasksRouter = router({
  /**
   * List tasks with flexible filtering.
   */
  list: householdProcedure.input(ListTasksSchema).query(async ({ ctx, input }) => {
    const conditions = [eq(tasks.householdId, ctx.householdId)];

    if (input.status?.length) {
      conditions.push(inArray(tasks.status, input.status));
    }
    if (input.priority?.length) {
      conditions.push(inArray(tasks.priority, input.priority));
    }
    if (input.dueBefore) {
      conditions.push(lte(tasks.dueAt, new Date(input.dueBefore)));
    }
    if (input.dueAfter) {
      conditions.push(gte(tasks.dueAt, new Date(input.dueAfter)));
    }
    if (input.parentTaskId !== undefined) {
      conditions.push(
        input.parentTaskId
          ? eq(tasks.parentTaskId, input.parentTaskId)
          : isNull(tasks.parentTaskId)
      );
    }

    const allTasks = await ctx.db.query.tasks.findMany({
      where: and(...conditions),
      with: {
        assignees: {
          with: { profile: true },
        },
      },
      orderBy: (t, { asc, desc }) => [asc(t.status), desc(t.priority), asc(t.dueAt)],
    });

    // Filter by assignee if requested
    if (input.assigneeIds?.length) {
      return allTasks.filter((t) =>
        t.assignees.some((a) => input.assigneeIds!.includes(a.userId))
      );
    }

    return allTasks;
  }),

  /**
   * Get a task with its subtasks and comments.
   */
  getById: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.householdId, ctx.householdId)),
        with: {
          assignees: { with: { profile: true } },
          subtasks: { with: { assignees: { with: { profile: true } } } },
          comments: { with: { profile: true } },
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  /**
   * Create a new task.
   */
  create: householdProcedure.input(CreateTaskSchema).mutation(async ({ ctx, input }) => {
    const { assigneeIds, ...taskData } = input;

    const [task] = await ctx.db
      .insert(tasks)
      .values({
        ...taskData,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
      })
      .returning();

    if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    if (assigneeIds.length > 0) {
      await ctx.db.insert(taskAssignees).values(
        assigneeIds.map((userId) => ({ taskId: task.id, userId }))
      );
    }

    return task;
  }),

  /**
   * Update task status (quick action, used in board drag-drop).
   */
  updateStatus: householdProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "done", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const completedAt = input.status === "done" ? new Date() : null;
      const [updated] = await ctx.db
        .update(tasks)
        .set({ status: input.status, completedAt, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.id), eq(tasks.householdId, ctx.householdId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Full task update.
   */
  update: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateTaskSchema }))
    .mutation(async ({ ctx, input }) => {
      const { assigneeIds, ...taskData } = input.data;

      const { dueAt: dueAtStr, ...restTaskData } = taskData;
      const setData = {
        ...restTaskData,
        ...(dueAtStr !== undefined ? { dueAt: dueAtStr !== null ? new Date(dueAtStr) : null } : {}),
        updatedAt: new Date(),
      };

      const [updated] = await ctx.db
        .update(tasks)
        .set(setData)
        .where(and(eq(tasks.id, input.id), eq(tasks.householdId, ctx.householdId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      if (assigneeIds !== undefined) {
        // Replace assignees
        await ctx.db.delete(taskAssignees).where(eq(taskAssignees.taskId, input.id));
        if (assigneeIds.length > 0) {
          await ctx.db.insert(taskAssignees).values(
            assigneeIds.map((userId) => ({ taskId: input.id, userId }))
          );
        }
      }

      return updated;
    }),

  /**
   * Delete a task (and its subtasks via CASCADE).
   */
  delete: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.householdId, ctx.householdId)));
      return { success: true };
    }),

  /**
   * Add a comment to a task.
   */
  addComment: householdProcedure
    .input(AddTaskCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify task belongs to household
      const task = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), eq(tasks.householdId, ctx.householdId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const [comment] = await ctx.db
        .insert(taskComments)
        .values({
          taskId: input.taskId,
          userId: ctx.user.id,
          content: input.content,
        })
        .returning();

      return comment;
    }),

  /**
   * List comments for a task.
   */
  listComments: householdProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify task belongs to household
      const task = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.taskId), eq(tasks.householdId, ctx.householdId)),
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.taskComments.findMany({
        where: eq(taskComments.taskId, input.taskId),
        with: { profile: true },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      });
    }),
});
