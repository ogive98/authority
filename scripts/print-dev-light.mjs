#!/usr/bin/env node
/** Prints D115 dev-light .env snippet (no file writes). */
console.log(`
AUTHORITY — Dev light (RAM)

1. Ajoute dans .env (ne pas committer .env) :

THUNDER_WORKERS_ENABLED=false
THUNDER_EVENTS_ENABLED=false
NEXT_PUBLIC_AUTHORITY_SHELL_LIGHT=true

2. Redémarre :
   npm run dev:api
   npm run dev:web

3. Docs : docs/LOCAL_SETUP.md § Dev light
`);
