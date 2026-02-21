---
name: orbyt-ui-pattern
description: Orbyt UI component patterns — glass cards, drawers, buttons, form inputs
---

# UI Patterns

## Glass card
```tsx
<div className="glass-card rounded-2xl p-6">
  {/* Card content */}
</div>
```
Variants: `.glass-card` (standard), `.glass-card-elevated` (dropdowns), `.glass-card-subtle` (inputs), `.glass-card-active` (selected state).

## Drawer
```tsx
import { Drawer } from "@/components/ui/drawer";

<Drawer open={isOpen} onClose={() => setIsOpen(false)} title="Drawer Title">
  {/* Drawer content */}
</Drawer>
```

## Buttons
```tsx
// Primary action
<button className="orbyt-button-accent">Add Task</button>
// Secondary action
<button className="orbyt-button-ghost">Cancel</button>
```

## Form inputs
```tsx
<label className="orbyt-label">Field Name</label>
<input className="orbyt-input" />
```

## Confirm dialog
```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

<ConfirmDialog
  open={showConfirm}
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
  title="Delete this item?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
/>
```

## Page layout pattern
```tsx
<div className="space-y-6">
  {/* Page header */}
  <div className="flex items-center justify-between">
    <h1 className="text-[28px] font-bold text-text">Page Title</h1>
    <button className="orbyt-button-accent">Action</button>
  </div>

  {/* Content */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* Cards */}
  </div>
</div>
```
