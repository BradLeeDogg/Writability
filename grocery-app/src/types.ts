import type { CategoryKey } from './categories';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  category: CategoryKey;
  checked: boolean;
  createdAt: number;
}
