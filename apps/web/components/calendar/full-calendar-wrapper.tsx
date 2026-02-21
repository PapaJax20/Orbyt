"use client";

import React from "react";
import FullCalendarImpl from "@fullcalendar/react";
import type { CalendarOptions } from "@fullcalendar/core";

/**
 * Wrapper that forwards a ref to FullCalendar, allowing the parent to call
 * `ref.current.getApi()` for imperative navigation. Imported via `dynamic()`
 * in calendar-content.tsx to avoid SSR.
 */
const FullCalendarWrapper = React.forwardRef<FullCalendarImpl, CalendarOptions>(
  (props, ref) => <FullCalendarImpl {...props} ref={ref} />,
);
FullCalendarWrapper.displayName = "FullCalendarWrapper";

export default FullCalendarWrapper;
