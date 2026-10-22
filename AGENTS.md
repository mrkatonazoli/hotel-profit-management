<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


## DataHeaven-integráció

A Simple Planner alatti „DataHeaven" menü élő PMS-riportokat jelenít meg a
data.katonazoli.hu API-jából. Részletek és kontraktus:
`docs/dataheaven-integracio.md`. A `src/modules/dataheaven/` nézet-komponensek
forrása a DataHeaven repo — ott a source of truth.

## Vercel-régió

A `vercel.json` `"regions": ["fra1"]` a függvényeket a frankfurti Supabase
(`aws-1-eu-central-1`) mellé szögezi. E nélkül iad1-ben (USA) futnak, és minden
DB-lekérdezés ~100 ms óceáni kört fizet — ez okozta a platform lassúságát
(2026-10-22). Ellenőrzés: `curl -sI https://profit.katonazoli.hu/` →
`x-vercel-id: fra1::fra1::…` legyen (a `fra1::iad1::…` = rossz).

## Dokumentációs fegyelem

Minden érdemi változás után frissítsd a README.md-t / releváns docs/*.md-t —
a felhasználó folyamatosan karbantartott markdown-dokumentációt vár.
