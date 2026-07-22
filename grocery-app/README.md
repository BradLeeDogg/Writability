# 🛒 Grocery List

A simple, fast grocery-shopping app for **Android and iPhone**, built with
[Expo](https://expo.dev) + React Native. One codebase runs on both phones.

Your list is saved **on your phone** — no account, no internet needed after the
app loads.

## What it does

Two tabs at the bottom: **🛒 List** and **🍳 Recipes**.

**Shopping list**

- **Add items** — type a name and tap **Add**. The app guesses the aisle
  (Produce, Dairy, Meat, Bakery, Frozen, Pantry, Drinks, Household), and you can
  tap a chip to change it.
- **Grouped by aisle** — items are organised into sections so you can shop in
  order.
- **Quantities** — tap **+ / −** on any item.
- **Check things off** — tap an item to move it into the **In cart** section
  with a line through it.
- **Clear cart / Clear all** — tidy up when you're done.
- **Saved automatically** — close the app and your list is still there.

**Recipes**

- **Suggestions** — the Recipes tab suggests meals; tap **🎲 Shuffle** for
  different ideas, or search by name or ingredient.
- **See the recipe** — tap a recipe for its ingredients (with amounts) and a
  simple step-by-step method.
- **Add ingredients to your list** — every ingredient is ticked by default;
  untick anything you already have, then tap **Add … items to list**. They drop
  straight onto your shopping list, grouped by aisle. All recipes are built in,
  so this works with no internet.

---

## Get it running on your phone (easiest way)

You do **not** need Android Studio or Xcode to start. You'll use **Expo Go**,
a free app that runs your project by scanning a QR code.

### 1. Install the tools on your computer (one time)

- Install [Node.js](https://nodejs.org) (the LTS version).
- Open a terminal in this `grocery-app` folder.

### 2. Install the project's packages (one time)

```bash
npm install
```

### 3. Install "Expo Go" on your phone

- **Android:** get **Expo Go** from the Google Play Store.
- **iPhone:** get **Expo Go** from the App Store.

### 4. Start the app

```bash
npm start
```

A QR code appears in your terminal.

- **Android:** open **Expo Go** → **Scan QR code** → point it at the QR code.
- **iPhone:** open the **Camera** app → point it at the QR code → tap the banner
  that appears.

Your phone and computer need to be on the **same Wi-Fi**. If the QR code won't
connect (common on public/office networks), run `npx expo start --tunnel`
instead — it works across networks (install the `@expo/ngrok` package if it
prompts you).

The app loads on your phone. Edit the code and it reloads instantly.

---

## Installing it as a real app (no Expo Go)

Expo Go is only for development. To get a standalone app you install like any
other, use **EAS Build** — it compiles in the cloud, so you still don't need
Android Studio or a Mac. A **free Expo account** is required (sign up at
<https://expo.dev>).

One-time setup:

```bash
npm install -g eas-cli
eas login          # or `eas register` to make a free account
eas build:configure
```

### Android — install directly (free, easy)

This produces an **`.apk`** file you can install straight onto the phone — no
Play Store needed.

```bash
eas build --platform android --profile preview
```

When it finishes (a few minutes), EAS gives you a link with a QR code.

1. On the Android phone, open that link and download the `.apk`.
2. Tap it to install. Android will ask permission to "install unknown apps" the
   first time — allow it, then tap install again.
3. The Grocery List app is now on the home screen, running on its own.

### iPhone — a bit more involved (Apple's rules)

Apple doesn't allow installing a raw app file the way Android does. Your options:

- **TestFlight (recommended):** requires an **Apple Developer account
  ($99/year)**. Then `eas build --platform ios` builds it and
  `eas submit --platform ios` uploads it; the user installs Apple's free
  **TestFlight** app and opens your invite link. Each build lasts 90 days.
- **App Store:** same $99/year account, plus Apple's review process — best if
  you ever want to share it beyond family.
- **Free, but clunky:** with a Mac and Xcode you can install it on your own
  iPhone for 7 days at a time before it needs re-signing.

Full guide: <https://docs.expo.dev/build/setup/>

> Tip: before a real build, change `"com.example.grocerylist"` in `app.json`
> (the `ios.bundleIdentifier` and `android.package`) to something of your own,
> e.g. `com.yourname.grocerylist`.

---

## Project layout

```
grocery-app/
  App.tsx                 App shell: state, persistence, tab switching
  index.ts                Entry point (registers App)
  app.json                Expo configuration (name, platforms, ids)
  eas.json                Cloud build profiles (APK / store builds)
  src/
    categories.ts         Aisle definitions + "guess the aisle" logic
    recipes.ts            Built-in recipe collection + suggest/search
    storage.ts            Load/save the list to the phone (AsyncStorage)
    theme.ts              Colors & spacing
    types.ts              The GroceryItem shape
    screens/
      ListScreen.tsx      The shopping list (header, aisles, add bar)
      RecipesScreen.tsx   Suggestions, search, recipe browsing
    components/
      Header.tsx          Title, counts, clear buttons
      AddItemBar.tsx      Text input + aisle chips + Add button
      ItemRow.tsx         One item: checkbox, name, quantity, delete
      EmptyState.tsx      Friendly message when the list is empty
      TabBar.tsx          Bottom List / Recipes tabs
      RecipeCard.tsx      One recipe in the list
      RecipeDetailModal.tsx  Ingredients + method + add-to-list
```

## Handy commands

```bash
npm start          # start the dev server + QR code
npm run android    # open on an Android emulator (if you have one)
npm run ios        # open on an iOS simulator (Mac only)
npm run typecheck  # check the TypeScript types
```
