# VibeFlows

Discover obscure music genres — swipe through ~6000 labels from [Every Noise at Once](https://everynoise.com/).

## Run

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

Open http://localhost:5173/

Catalog data is already in `public/`. Re-scraping is optional.

## Spotify (optional)

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add these **Redirect URIs** exactly (trailing slash matters):
   - `https://vibe-flows.vercel.app/`
   - `http://localhost:5173/`
3. Fill `.env` / Vercel env:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `VITE_SPOTIFY_CLIENT_ID` (same Client ID)
4. Restart `npm run dev` / redeploy → Settings → Log in with Spotify

Without keys, browsing and swipes still work.

## Layout

```
api/           # Vercel serverless
content/       # local wiki staging (json gitignored)
public/        # static assets + catalog JSON
scripts/       # scrape, descriptions, deploy
src/           # React app
vite/plugins/  # Vite Spotify / catalog plugins
prisma/        # optional Neon catalog schema
```

See [CHANGELOG.md](./CHANGELOG.md) for version history (1.0 → 1.1 → 1.2).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run scrape` | Genre catalog from Every Noise |
| `npm run scrape:enrich` | Playlists and artists |
| `npm run similarity` | Similarity index |
| `npm run wiki:gen:all` | Localized genre blurbs |
| `npm run build` | Production build |
| `npm run preview` | Preview the build |
| `npm run deploy:prod` | Production deploy (`scripts/deploy/deploy-prod.mjs`) |
