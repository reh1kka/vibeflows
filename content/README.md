# Local staging (not published)

Wikipedia / description collection writes JSON here:

```bash
npm run wiki:collect
```

JSON under `content/` stays **local / gitignored**. Ship to the app with:

```bash
npm run wiki:sync
```

(`wiki:collect` already syncs into `public/` when finished.)
