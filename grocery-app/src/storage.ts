import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GroceryItem } from './types';
import type { CategoryKey } from './categories';
import { CATEGORIES } from './categories';

const STORAGE_KEY = 'grocery.items.v1';

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));

// Guard against corrupt or old-shape data so a single bad entry can never
// crash the app on launch.
function sanitize(raw: unknown): GroceryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: GroceryItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.name !== 'string') continue;
    const category: CategoryKey = VALID_CATEGORIES.has(e.category as string)
      ? (e.category as CategoryKey)
      : 'Other';
    items.push({
      id: e.id,
      name: e.name,
      quantity: typeof e.quantity === 'number' && e.quantity > 0 ? Math.floor(e.quantity) : 1,
      category,
      checked: Boolean(e.checked),
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
    });
  }
  return items;
}

export async function loadItems(): Promise<GroceryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveItems(items: GroceryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort persistence; a failed write should not surface as a crash.
  }
}
