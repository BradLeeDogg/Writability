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

## Turning it into a real installable app (later)

Expo Go is for development. To get a standalone app you can install directly
(or publish to the stores), use **EAS Build** — it builds in the cloud, so you
still don't need Android Studio or a Mac:

```bash
npm install -g eas-cli
eas login
eas build --platform android      # produces an .apk / .aab
eas build --platform ios          # produces an .ipa (needs an Apple Developer account)
```

The Android build gives you an `.apk` you can download and install straight
onto your phone. See <https://docs.expo.dev/build/setup/> for the full guide.

---

## Project layout

```
grocery-app/
  App.tsx                 App shell: state, persistence, the grouped list
  index.ts                Entry point (registers App)
  app.json                Expo configuration (name, icons, platforms)
  src/
    categories.ts         Aisle definitions + "guess the aisle" logic
    storage.ts            Load/save the list to the phone (AsyncStorage)
    theme.ts              Colors & spacing
    types.ts              The GroceryItem shape
    components/
      Header.tsx          Title, counts, clear buttons
      AddItemBar.tsx      Text input + aisle chips + Add button
      ItemRow.tsx         One item: checkbox, name, quantity, delete
      EmptyState.tsx      Friendly message when the list is empty
```

## Handy commands

```bash
npm start          # start the dev server + QR code
npm run android    # open on an Android emulator (if you have one)
npm run ios        # open on an iOS simulator (Mac only)
npm run typecheck  # check the TypeScript types
```
