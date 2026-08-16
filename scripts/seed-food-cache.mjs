/**
 * Seeds the shared food cache in Realtime Database.
 *
 * Run with:  node scripts/seed-food-cache.mjs
 *
 * Optional but useful: it gives the app working nutrition data before any USDA
 * call is made, and keeps it usable if the USDA API is unreachable. It also
 * covers South Asian staples that the Food-101 recognition model does not know.
 *
 * Values are per 100 g and come from USDA FoodData Central SR Legacy entries.
 * They are reference estimates, not exact values for any specific product.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY and NEXT_PUBLIC_FIREBASE_DATABASE_URL
 * in .env.local. Writing the same data twice is harmless.
 */

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Minimal .env.local loader so this script needs no extra dependency.
function loadEnv() {
  try {
    const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Fall back to the ambient environment.
  }
}

loadEnv();

// name, kcal, protein, carbs, fat  (per 100 g)
const FOODS = [
  ['chicken breast', 165, 31.0, 0.0, 3.6],
  ['white rice cooked', 130, 2.7, 28.2, 0.3],
  ['brown rice cooked', 123, 2.7, 25.6, 1.0],
  ['whole wheat roti', 297, 11.0, 51.0, 7.0],
  ['chapati', 297, 11.0, 51.0, 7.0],
  ['boiled egg', 155, 12.6, 1.1, 10.6],
  ['paneer', 265, 18.3, 1.2, 20.8],
  ['tofu', 76, 8.1, 1.9, 4.8],
  ['lentils cooked', 116, 9.0, 20.1, 0.4],
  ['chickpeas cooked', 164, 8.9, 27.4, 2.6],
  ['rajma cooked', 127, 8.7, 22.8, 0.5],
  ['greek yogurt', 59, 10.0, 3.6, 0.4],
  ['milk whole', 61, 3.2, 4.8, 3.3],
  ['oats dry', 389, 16.9, 66.3, 6.9],
  ['banana', 89, 1.1, 22.8, 0.3],
  ['apple', 52, 0.3, 13.8, 0.2],
  ['almonds', 579, 21.2, 21.6, 49.9],
  ['peanut butter', 588, 25.1, 19.6, 50.4],
  ['olive oil', 884, 0.0, 0.0, 100.0],
  ['ghee', 900, 0.0, 0.0, 100.0],
  ['broccoli', 34, 2.8, 6.6, 0.4],
  ['spinach', 23, 2.9, 3.6, 0.4],
  ['mixed vegetables', 65, 2.6, 13.1, 0.4],
  ['potato boiled', 87, 1.9, 20.1, 0.1],
  ['sweet potato', 86, 1.6, 20.1, 0.1],
  ['salmon', 208, 20.4, 0.0, 13.4],
  ['tuna canned', 116, 25.5, 0.0, 0.8],
  ['whole wheat bread', 247, 13.0, 41.0, 3.4],
  ['idli', 156, 4.0, 32.0, 0.4],
  ['dosa', 168, 3.9, 28.0, 4.4],
  ['poha', 130, 2.5, 27.0, 1.5],
  ['upma', 140, 3.5, 22.0, 4.5],
  ['dal tadka', 120, 6.0, 16.0, 3.5],
  ['chicken curry', 150, 14.0, 5.0, 8.0],
  ['vegetable curry', 110, 3.0, 10.0, 6.5],
  ['curd', 62, 3.4, 4.7, 3.3],
  ['cucumber salad', 16, 0.7, 3.6, 0.1],
  ['sprouts', 100, 10.0, 18.0, 0.6],
  ['cottage cheese low fat', 72, 12.4, 2.7, 1.0],
  ['whey protein powder', 400, 80.0, 10.0, 5.0],
];

/** Must match encodeKey() in lib/firebase/admin.ts. */
function encodeKey(key) {
  return key.replace(/[.$#[\]/ -]/g, '_');
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Add it to .env.local first.',
    );
    process.exit(1);
  }

  let json = raw.trim();
  if (!json.startsWith('{')) json = Buffer.from(json, 'base64').toString('utf8');

  const parsed = JSON.parse(json);
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
  };
}

async function main() {
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    console.error(
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set. Create the Realtime Database first.',
    );
    process.exit(1);
  }

  initializeApp({ credential: cert(loadServiceAccount()), databaseURL });

  const now = Date.now();
  const updates = {};

  for (const [name, calories, protein, carbs, fat] of FOODS) {
    updates[encodeKey(name)] = {
      query_key: name,
      name,
      calories_per_100g: calories,
      protein_per_100g: protein,
      carbs_per_100g: carbs,
      fat_per_100g: fat,
      source: 'seed',
      hit_count: 0,
      created_at: now,
      updated_at: now,
    };
  }

  await getDatabase().ref('food_cache').update(updates);

  console.log(`Seeded ${FOODS.length} foods into food_cache.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
