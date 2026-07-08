import type { CategoryKey } from './categories';

// A single recipe ingredient. `amount` is the human-readable cooking amount
// shown in the recipe (e.g. "500 g"); `name` + `category` are what get added
// to the shopping list, so the list stays clean and groups by aisle.
export interface RecipeIngredient {
  name: string;
  amount: string;
  category: CategoryKey;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  servings: number;
  minutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export const RECIPES: Recipe[] = [
  {
    id: 'spaghetti-bolognese',
    name: 'Spaghetti Bolognese',
    emoji: '🍝',
    blurb: 'A rich, comforting classic the whole family loves.',
    servings: 4,
    minutes: 40,
    ingredients: [
      { name: 'Spaghetti', amount: '400 g', category: 'Pantry' },
      { name: 'Ground beef', amount: '500 g', category: 'Meat' },
      { name: 'Onion', amount: '1', category: 'Produce' },
      { name: 'Garlic', amount: '2 cloves', category: 'Produce' },
      { name: 'Chopped tomatoes', amount: '2 cans', category: 'Pantry' },
      { name: 'Tomato paste', amount: '2 tbsp', category: 'Pantry' },
      { name: 'Olive oil', amount: '2 tbsp', category: 'Pantry' },
      { name: 'Parmesan', amount: 'to serve', category: 'Dairy' },
    ],
    steps: [
      'Fry the chopped onion and garlic in olive oil until soft.',
      'Add the beef and brown it, breaking it up as it cooks.',
      'Stir in the tomatoes and tomato paste; simmer 20 minutes.',
      'Meanwhile boil the spaghetti until just tender.',
      'Serve the sauce over the pasta with grated parmesan.',
    ],
  },
  {
    id: 'chicken-stir-fry',
    name: 'Chicken Stir-Fry',
    emoji: '🥘',
    blurb: 'Fast, colourful, and endlessly flexible with veg.',
    servings: 3,
    minutes: 25,
    ingredients: [
      { name: 'Chicken breast', amount: '2', category: 'Meat' },
      { name: 'Stir-fry vegetables', amount: '400 g', category: 'Produce' },
      { name: 'Soy sauce', amount: '3 tbsp', category: 'Pantry' },
      { name: 'Garlic', amount: '2 cloves', category: 'Produce' },
      { name: 'Ginger', amount: '1 thumb', category: 'Produce' },
      { name: 'Rice', amount: '2 cups', category: 'Pantry' },
      { name: 'Vegetable oil', amount: '1 tbsp', category: 'Pantry' },
    ],
    steps: [
      'Cook the rice according to the packet.',
      'Slice the chicken and fry in hot oil until golden.',
      'Add garlic, ginger and vegetables; stir-fry 4–5 minutes.',
      'Pour in the soy sauce and toss to coat.',
      'Serve over the rice.',
    ],
  },
  {
    id: 'fluffy-pancakes',
    name: 'Fluffy Pancakes',
    emoji: '🥞',
    blurb: 'Weekend breakfast that comes together in minutes.',
    servings: 4,
    minutes: 20,
    ingredients: [
      { name: 'Flour', amount: '200 g', category: 'Pantry' },
      { name: 'Milk', amount: '300 ml', category: 'Dairy' },
      { name: 'Eggs', amount: '2', category: 'Dairy' },
      { name: 'Baking powder', amount: '2 tsp', category: 'Pantry' },
      { name: 'Sugar', amount: '2 tbsp', category: 'Pantry' },
      { name: 'Butter', amount: 'for cooking', category: 'Dairy' },
      { name: 'Maple syrup', amount: 'to serve', category: 'Pantry' },
    ],
    steps: [
      'Whisk flour, baking powder and sugar in a bowl.',
      'Beat in the eggs and milk until smooth.',
      'Melt a little butter in a pan over medium heat.',
      'Pour in small rounds; flip when bubbles appear on top.',
      'Serve warm with maple syrup.',
    ],
  },
  {
    id: 'grilled-cheese-soup',
    name: 'Grilled Cheese & Tomato Soup',
    emoji: '🧀',
    blurb: 'The ultimate cosy lunch for a cold day.',
    servings: 2,
    minutes: 15,
    ingredients: [
      { name: 'Bread', amount: '4 slices', category: 'Bakery' },
      { name: 'Cheddar cheese', amount: '100 g', category: 'Dairy' },
      { name: 'Butter', amount: '2 tbsp', category: 'Dairy' },
      { name: 'Tomato soup', amount: '1 can', category: 'Pantry' },
    ],
    steps: [
      'Butter the bread on the outside and fill with cheese.',
      'Fry in a pan until golden and the cheese melts.',
      'Warm the tomato soup in a small pot.',
      'Cut the sandwiches in half and serve with the soup.',
    ],
  },
  {
    id: 'beef-tacos',
    name: 'Beef Tacos',
    emoji: '🌮',
    blurb: 'A fun, build-your-own taco night everyone enjoys.',
    servings: 4,
    minutes: 25,
    ingredients: [
      { name: 'Ground beef', amount: '500 g', category: 'Meat' },
      { name: 'Taco shells', amount: '8', category: 'Pantry' },
      { name: 'Lettuce', amount: '1', category: 'Produce' },
      { name: 'Tomato', amount: '2', category: 'Produce' },
      { name: 'Cheddar cheese', amount: '100 g', category: 'Dairy' },
      { name: 'Taco seasoning', amount: '1 packet', category: 'Pantry' },
      { name: 'Sour cream', amount: 'to serve', category: 'Dairy' },
    ],
    steps: [
      'Brown the beef in a pan, then stir in the taco seasoning and a splash of water.',
      'Simmer until thickened.',
      'Warm the taco shells and shred the lettuce; dice the tomato.',
      'Fill the shells with beef and top with lettuce, tomato, cheese and sour cream.',
    ],
  },
  {
    id: 'veggie-omelette',
    name: 'Veggie Omelette',
    emoji: '🍳',
    blurb: 'A protein-packed breakfast in under ten minutes.',
    servings: 1,
    minutes: 10,
    ingredients: [
      { name: 'Eggs', amount: '3', category: 'Dairy' },
      { name: 'Bell pepper', amount: '1', category: 'Produce' },
      { name: 'Onion', amount: '1/2', category: 'Produce' },
      { name: 'Cheese', amount: '50 g', category: 'Dairy' },
      { name: 'Butter', amount: '1 tbsp', category: 'Dairy' },
    ],
    steps: [
      'Beat the eggs with a pinch of salt.',
      'Soften the diced pepper and onion in butter.',
      'Pour in the eggs and cook until almost set.',
      'Add the cheese, fold over, and serve.',
    ],
  },
  {
    id: 'chicken-caesar-salad',
    name: 'Chicken Caesar Salad',
    emoji: '🥗',
    blurb: 'Crisp, fresh, and satisfying — great for lunch.',
    servings: 2,
    minutes: 20,
    ingredients: [
      { name: 'Chicken breast', amount: '2', category: 'Meat' },
      { name: 'Romaine lettuce', amount: '1', category: 'Produce' },
      { name: 'Caesar dressing', amount: '1 bottle', category: 'Pantry' },
      { name: 'Croutons', amount: '1 bag', category: 'Bakery' },
      { name: 'Parmesan', amount: '50 g', category: 'Dairy' },
    ],
    steps: [
      'Season and pan-fry the chicken until cooked through, then slice.',
      'Chop the lettuce and place in a bowl.',
      'Toss with dressing, croutons and parmesan.',
      'Top with the sliced chicken.',
    ],
  },
  {
    id: 'beef-chili',
    name: 'Beef Chili',
    emoji: '🌶️',
    blurb: 'A hearty one-pot meal that tastes even better the next day.',
    servings: 5,
    minutes: 45,
    ingredients: [
      { name: 'Ground beef', amount: '500 g', category: 'Meat' },
      { name: 'Kidney beans', amount: '2 cans', category: 'Pantry' },
      { name: 'Chopped tomatoes', amount: '2 cans', category: 'Pantry' },
      { name: 'Onion', amount: '1', category: 'Produce' },
      { name: 'Chili powder', amount: '2 tbsp', category: 'Pantry' },
      { name: 'Garlic', amount: '2 cloves', category: 'Produce' },
    ],
    steps: [
      'Fry the onion and garlic, then brown the beef.',
      'Stir in the chili powder.',
      'Add the tomatoes and drained beans.',
      'Simmer gently for 30 minutes, stirring now and then.',
    ],
  },
  {
    id: 'overnight-oats',
    name: 'Overnight Oats',
    emoji: '🥣',
    blurb: 'Prep tonight, grab-and-go breakfast tomorrow.',
    servings: 1,
    minutes: 5,
    ingredients: [
      { name: 'Rolled oats', amount: '1 cup', category: 'Pantry' },
      { name: 'Milk', amount: '1 cup', category: 'Dairy' },
      { name: 'Yogurt', amount: '1/2 cup', category: 'Dairy' },
      { name: 'Honey', amount: '1 tbsp', category: 'Pantry' },
      { name: 'Berries', amount: '1 cup', category: 'Produce' },
    ],
    steps: [
      'Stir the oats, milk, yogurt and honey together in a jar.',
      'Cover and refrigerate overnight.',
      'In the morning, top with berries and enjoy.',
    ],
  },
  {
    id: 'tuna-pasta-salad',
    name: 'Tuna Pasta Salad',
    emoji: '🐟',
    blurb: 'A no-fuss cold lunch that keeps well in the fridge.',
    servings: 3,
    minutes: 20,
    ingredients: [
      { name: 'Pasta', amount: '300 g', category: 'Pantry' },
      { name: 'Canned tuna', amount: '2 cans', category: 'Pantry' },
      { name: 'Mayonnaise', amount: '3 tbsp', category: 'Pantry' },
      { name: 'Sweetcorn', amount: '1 can', category: 'Pantry' },
      { name: 'Cucumber', amount: '1/2', category: 'Produce' },
    ],
    steps: [
      'Boil the pasta, then drain and cool under cold water.',
      'Drain the tuna and sweetcorn; dice the cucumber.',
      'Mix everything with the mayonnaise.',
      'Season to taste and chill until serving.',
    ],
  },
  {
    id: 'banana-smoothie',
    name: 'Banana Smoothie',
    emoji: '🥤',
    blurb: 'A quick, filling drink for busy mornings.',
    servings: 2,
    minutes: 5,
    ingredients: [
      { name: 'Banana', amount: '2', category: 'Produce' },
      { name: 'Milk', amount: '1 cup', category: 'Dairy' },
      { name: 'Yogurt', amount: '1/2 cup', category: 'Dairy' },
      { name: 'Honey', amount: '1 tbsp', category: 'Pantry' },
    ],
    steps: [
      'Peel the bananas and add everything to a blender.',
      'Blend until smooth.',
      'Pour into glasses and serve cold.',
    ],
  },
  {
    id: 'egg-fried-rice',
    name: 'Egg Fried Rice',
    emoji: '🍚',
    blurb: 'A great way to use up leftover rice.',
    servings: 3,
    minutes: 20,
    ingredients: [
      { name: 'Rice', amount: '2 cups cooked', category: 'Pantry' },
      { name: 'Eggs', amount: '2', category: 'Dairy' },
      { name: 'Frozen peas and carrots', amount: '1 cup', category: 'Frozen' },
      { name: 'Soy sauce', amount: '3 tbsp', category: 'Pantry' },
      { name: 'Green onion', amount: '2', category: 'Produce' },
      { name: 'Vegetable oil', amount: '1 tbsp', category: 'Pantry' },
    ],
    steps: [
      'Scramble the eggs in hot oil, then set aside.',
      'Fry the peas and carrots for a couple of minutes.',
      'Add the rice and soy sauce; stir-fry until hot.',
      'Return the eggs, stir through the green onion, and serve.',
    ],
  },
  {
    id: 'margherita-pizza',
    name: 'Margherita Pizza',
    emoji: '🍕',
    blurb: 'Simple homemade pizza on a ready-made base.',
    servings: 2,
    minutes: 20,
    ingredients: [
      { name: 'Pizza base', amount: '1', category: 'Bakery' },
      { name: 'Mozzarella', amount: '150 g', category: 'Dairy' },
      { name: 'Passata', amount: '1/2 cup', category: 'Pantry' },
      { name: 'Fresh basil', amount: 'a few leaves', category: 'Produce' },
      { name: 'Olive oil', amount: '1 tbsp', category: 'Pantry' },
    ],
    steps: [
      'Heat the oven as hot as it goes.',
      'Spread passata over the base and add torn mozzarella.',
      'Bake until the crust is golden and the cheese bubbles.',
      'Finish with fresh basil and a drizzle of olive oil.',
    ],
  },
  {
    id: 'roast-chicken-dinner',
    name: 'Roast Chicken Dinner',
    emoji: '🍗',
    blurb: 'A proper Sunday roast with crispy potatoes.',
    servings: 4,
    minutes: 90,
    ingredients: [
      { name: 'Whole chicken', amount: '1', category: 'Meat' },
      { name: 'Potatoes', amount: '1 kg', category: 'Produce' },
      { name: 'Carrots', amount: '4', category: 'Produce' },
      { name: 'Onion', amount: '1', category: 'Produce' },
      { name: 'Olive oil', amount: '2 tbsp', category: 'Pantry' },
    ],
    steps: [
      'Heat the oven to 200°C (400°F).',
      'Rub the chicken with oil and salt; place in a roasting tin on the onion.',
      'Add the peeled potatoes and carrots around it with a little oil.',
      'Roast about 1 hour 20 minutes, until the juices run clear.',
      'Rest the chicken 10 minutes before carving.',
    ],
  },
];

// Fisher–Yates shuffle to pick a few random suggestions.
export function suggestRecipes(count = 3, exclude: string[] = []): Recipe[] {
  const pool = RECIPES.filter((r) => !exclude.includes(r.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function searchRecipes(query: string): Recipe[] {
  const q = query.trim().toLowerCase();
  if (!q) return RECIPES;
  return RECIPES.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.blurb.toLowerCase().includes(q) ||
      r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
  );
}
