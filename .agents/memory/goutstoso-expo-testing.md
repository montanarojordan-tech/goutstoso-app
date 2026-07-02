---
name: Goutstoso Expo testing
description: How to reach and e2e-test the Goutstoso app during dev (avoid the shared proxy path prefix)
---

Goutstoso's artifact.toml sets `router = "expo-domain"`. Requesting the app through the shared reverse-proxy path prefix (e.g. `localhost:80/goutstoso/` or `$REPLIT_DEV_DOMAIN/goutstoso/`) returns the initial HTML shell (200) but the JS bundle/assets 404, producing a blank page.

**Why:** Expo web dev server assets aren't served correctly under a path-prefixed proxy route; the app must be reached at the Expo dev domain root instead.

**How to apply:** For manual checks or `runTest()` e2e testing of Goutstoso, navigate to `https://$REPLIT_EXPO_DEV_DOMAIN/` (root, no `/goutstoso` prefix), not the shared-proxy path.

Also: Goutstoso is a private single-admin-user app. On load it calls `GET /api/goutstoso/auto-token`, which auto-issues/reuses a valid token for the single seeded user (`u1` / `jordan`) — no login form/credentials needed for testing.
