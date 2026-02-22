# Lauren's 50 Before 30

A mobile-first interactive map tracking Lauren's quest to visit all 50 US states before she turns 30.

## Tech Stack

- **Next.js** (App Router)
- **MapLibre GL JS** for map rendering
- **Mapbox Dark** tile style
- **Supabase** for state tracking (visited/notes)
- **Tailwind CSS**

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file (see `.env.local.example`) with:

   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token_here
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

   - Get a Mapbox token at [mapbox.com](https://account.mapbox.com/access-tokens/)
   - Get Supabase credentials by creating a project at [supabase.com](https://supabase.com)

3. Set up the Supabase database:

   - Go to the **SQL Editor** in your Supabase dashboard
   - Paste and run the contents of `supabase/migration.sql`
   - This creates the `states` table and seeds all 50 states + DC

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

## Usage

- Tap any state on the map to open its detail panel
- Toggle the visited status — the map updates immediately
- Add notes about your visit — saved automatically when you tap away
