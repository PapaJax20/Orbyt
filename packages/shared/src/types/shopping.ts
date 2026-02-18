export interface ShoppingList {
  id: string;
  householdId: string;
  createdBy: string;
  name: string;
  emoji: string;
  isDefault: boolean;
  archivedAt: Date | null;
  itemCount: number;
  checkedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  addedBy: string;
  checkedBy: string | null;
  name: string;
  quantity: string | null;
  category: string | null;
  notes: string | null;
  checked: boolean;
  checkedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
}
