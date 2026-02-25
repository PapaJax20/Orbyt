import { router } from "./trpc";
import { householdRouter } from "./routers/household";
import { calendarRouter } from "./routers/calendar";
import { tasksRouter } from "./routers/tasks";
import { financesRouter } from "./routers/finances";
import { shoppingRouter } from "./routers/shopping";
import { contactsRouter } from "./routers/contacts";
import { notificationsRouter } from "./routers/notifications";
import { integrationsRouter } from "./routers/integrations";
import { plaidRouter } from "./routers/plaid";

/**
 * The root tRPC router. This is the single AppRouter consumed by
 * both the Next.js web app and the Expo mobile app.
 */
export const appRouter = router({
  household: householdRouter,
  calendar: calendarRouter,
  tasks: tasksRouter,
  finances: financesRouter,
  shopping: shoppingRouter,
  contacts: contactsRouter,
  notifications: notificationsRouter,
  integrations: integrationsRouter,
  plaid: plaidRouter,
  // ai: aiRouter, — activated in Phase 2
});

export type AppRouter = typeof appRouter;

export { createCallerFactory } from "./trpc";
