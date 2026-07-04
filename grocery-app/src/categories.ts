// Grocery categories drive the aisle-style grouping in the list and the
// "guess the category as you type" convenience when adding an item.

export const CATEGORIES = [
  {
    key: 'Produce',
    label: 'Produce',
    emoji: '🥬',
    color: '#43A047',
    keywords: [
      'apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion', 'potato',
      'carrot', 'spinach', 'pepper', 'cucumber', 'broccoli', 'avocado',
      'lemon', 'lime', 'grape', 'berry', 'berries', 'strawberr', 'fruit',
      'veg', 'salad', 'celery', 'garlic', 'mushroom', 'kale', 'herb',
      'cilantro', 'parsley', 'corn', 'peach', 'pear', 'melon',
    ],
  },
  {
    key: 'Dairy',
    label: 'Dairy & Eggs',
    emoji: '🥛',
    color: '#42A5F5',
    keywords: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg', 'sour cream'],
  },
  {
    key: 'Meat',
    label: 'Meat & Fish',
    emoji: '🍗',
    color: '#EF5350',
    keywords: [
      'chicken', 'beef', 'pork', 'bacon', 'sausage', 'turkey', 'fish',
      'salmon', 'tuna', 'shrimp', 'ham', 'steak', 'mince', 'ground',
    ],
  },
  {
    key: 'Bakery',
    label: 'Bakery',
    emoji: '🍞',
    color: '#D4A24C',
    keywords: ['bread', 'bagel', 'bun', 'roll', 'baguette', 'croissant', 'muffin', 'cake', 'tortilla', 'pita'],
  },
  {
    key: 'Frozen',
    label: 'Frozen',
    emoji: '🧊',
    color: '#26C6DA',
    keywords: ['frozen', 'ice cream', 'ice-cream', 'pizza', 'fries'],
  },
  {
    key: 'Pantry',
    label: 'Pantry',
    emoji: '🥫',
    color: '#FB8C00',
    keywords: [
      'rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'sauce', 'bean',
      'can', 'cereal', 'oats', 'honey', 'peanut butter', 'jam', 'spice',
      'vinegar', 'stock', 'noodle', 'soup', 'ketchup', 'mustard', 'mayo',
      'snack', 'chip', 'cracker', 'cookie', 'chocolate', 'nut',
    ],
  },
  {
    key: 'Drinks',
    label: 'Drinks',
    emoji: '🧃',
    color: '#AB47BC',
    keywords: ['water', 'juice', 'soda', 'cola', 'beer', 'wine', 'coffee', 'tea', 'drink', 'lemonade', 'smoothie'],
  },
  {
    key: 'Household',
    label: 'Household',
    emoji: '🧻',
    color: '#78909C',
    keywords: [
      'paper towel', 'toilet', 'tissue', 'soap', 'detergent', 'cleaner',
      'sponge', 'trash', 'foil', 'wrap', 'shampoo', 'toothpaste',
      'deodorant', 'battery', 'napkin', 'dish',
    ],
  },
  {
    key: 'Other',
    label: 'Other',
    emoji: '🛒',
    color: '#8D6E63',
    keywords: [],
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

export type CategoryMeta = (typeof CATEGORIES)[number];

const BY_KEY: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);

const FALLBACK = CATEGORIES[CATEGORIES.length - 1];

export function getCategory(key: CategoryKey): CategoryMeta {
  return BY_KEY[key] ?? FALLBACK;
}

// Best-effort guess of an item's category from its name. Returns 'Other'
// when nothing matches, so the user can always override with the chips.
export function guessCategory(name: string): CategoryKey {
  const n = name.trim().toLowerCase();
  if (!n) return 'Other';
  for (const c of CATEGORIES) {
    for (const kw of c.keywords) {
      if (n.includes(kw)) return c.key;
    }
  }
  return 'Other';
}
