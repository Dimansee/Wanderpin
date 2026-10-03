# Wanderpin

Travel app (PWA): search any place, see its live animated scene, weather and local time, a suggested itinerary, famous food, cafes, couple spots, family dining, popular and crowded places, stays, and scams to watch for. Users can save places, dishes and notes, build their own trips, and turn Instagram reels (or any travel link or caption) into an itinerary.

Everything runs on free tiers. It works without login: data is saved on the device until the user signs in with Google.

## What powers it (all free)

| Feature | Source |
| --- | --- |
| Weather, local time, city search | Open-Meteo (no key) |
| Place search, reverse geocoding | OpenStreetMap Nominatim |
| Cafes, restaurants, viewpoints, sights, stays | OpenStreetMap Overpass |
| Guide text, itinerary ideas, famous food, scams | Wikivoyage |
| Login + saved data + reports + crowd check-ins | Firebase Spark plan (free) |
| Reading reels → itinerary | Gemini API free tier, called from `/api/reel` |
| Hosting + the `/api/reel` function | Vercel Hobby (free) |

## 1. Run it on your computer

```bash
npm install
npm run dev
```

Open the link it prints. Everything works except "Plan from a reel" (that needs the server function, see step 4).

## 2. Firebase (login + saved data), about 10 minutes

1. Go to https://console.firebase.google.com and create a project (no billing needed; you stay on the free Spark plan).
2. **Build → Authentication → Get started → Google → Enable.**
3. **Build → Firestore Database → Create database** (production mode, region `asia-south1` for India).
4. In Firestore → **Rules**, paste the contents of `firestore.rules` from this project and **Publish**.
5. **Project settings → Your apps → Web (</>)**, register an app, then copy the config values.
6. Create a file named `.env` in the project folder (copy `.env.example`) and fill in the four `VITE_FIREBASE_*` values.
7. After deploying (step 4), add your Vercel domain under **Authentication → Settings → Authorized domains**.

Where things are stored:
- `users/{uid}/saves`, `users/{uid}/trips`, `users/{uid}/notes`: private to each user.
- `reports`: "couldn't read this reel" and "wrong info" reports. Read them in the Firebase console.
- `crowd`: anonymous "how busy is it" check-ins (used for the next 3 hours).

## 3. Gemini key (reel reading), 2 minutes

1. Go to https://aistudio.google.com/apikey and create a free API key.
2. It is only used on the server (`/api/reel`), never shipped to the browser.

Without a key the app still tries a simple fallback (it picks up 📍/numbered lists in captions), but the AI is far better.

## 4. Deploy to Vercel (free)

1. Push this folder to a new GitHub repo.
2. On https://vercel.com, **Add New → Project**, import the repo. Framework: **Vite** (auto-detected).
3. In **Settings → Environment Variables**, add:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
   - `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-2.5-flash`)
4. Deploy. To test the reel function locally use `npx vercel dev` instead of `npm run dev`.

Note: Vercel's Hobby plan is for non-commercial use. If Wanderpin starts earning money, you'll need Pro, or you can move hosting to Cloudflare Pages/Netlify.

## 5. "App" phase, still free

- **Installable app (now):** the site is a PWA. On Android, Chrome shows "Install app"; on iPhone, Safari → Share → Add to Home Screen. The Profile tab has an install button.
- **Share reels from Instagram:** once installed on Android, Wanderpin appears in Instagram's Share sheet (Share → Wanderpin) and opens straight into the reel importer. iOS doesn't allow this for web apps, so iPhone users paste the link.
- **Real Android APK later:** wrap this same code with Capacitor (`npx cap add android`) or use PWABuilder (pwabuilder.com) to generate an APK for free. Sideloading the APK is free. A Play Store listing has a one-time $25 fee; the App Store costs $99 per year.

## Honest limits

- **Instagram** has no free official API. The function reads the public caption via Instagram's embed page and link-preview tags. When Instagram hides it, the app asks the user to paste the caption. If nothing useful is found, the user can report it.
- **Crowd levels** are estimates from place type, local time and weekday, plus live check-ins from users. Real-time crowd data is paid (Google).
- **Hotel prices** aren't included. The Stays tab lists hotels from OpenStreetMap and Wikivoyage. Prices would need a booking affiliate account later.
- Open data quality varies by city: big tourist cities have rich info, small towns less.

## Project map

```
api/reel.js              Serverless: link/caption → Gemini → itinerary JSON
firestore.rules          Database security rules
src/App.jsx              Routes, globe loader, toast
src/components/Scene.jsx Live animated scene (time of day × weather × place type)
src/components/Globe.jsx Spinning brand globe
src/components/Loader.jsx Splash: globe spins, then flies to the top-right
src/lib/api.js           Weather, search, OSM places, Wikivoyage parsing, crowd estimate, itinerary builder
src/lib/store.js         Saves/trips/notes (Firestore when logged in, device otherwise), reports, crowd
src/pages/*              Home, Place, Find, Import (reels), Saved, Trips, Packing, Profile
```
