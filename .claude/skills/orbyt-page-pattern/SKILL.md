---
name: orbyt-page-pattern
description: How to create a new feature page in Orbyt
---

# Feature Page Pattern

## Step 1: Server Component page
```tsx
// app/(protected)/[feature]/page.tsx
import { Metadata } from "next";
import { FeatureContent } from "@/components/[feature]/[feature]-content";

export const metadata: Metadata = {
  title: "Feature Name — Orbyt",
};

export default function FeaturePage() {
  return <FeatureContent />;
}
```

## Step 2: Client Component content
```tsx
// components/[feature]/[feature]-content.tsx
"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/ui/empty-state";

export function FeatureContent() {
  const { data, isLoading, error } = trpc.someRouter.someQuery.useQuery();

  if (isLoading) return <FeatureSkeleton />;
  if (error) return <FeatureError error={error} />;
  if (!data || data.length === 0) return (
    <EmptyState
      character="rosie" // or "eddie" based on user persona
      expression="happy"
      title="Empty state headline"
      description="Helpful subtext"
      actionLabel="CTA Button"
      onAction={() => setDrawerOpen(true)}
    />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Page content */}
    </motion.div>
  );
}
```

## Step 3: Loading skeleton
```tsx
// app/(protected)/[feature]/loading.tsx
export default function FeatureLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse bg-surface rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
```
