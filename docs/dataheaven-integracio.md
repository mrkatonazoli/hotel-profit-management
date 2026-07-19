# DataHeaven-integráció (élő PMS-riportok)

> Frissítve: 2026-07-19. Ezt a dokumentumot minden integrációt érintő
> változásnál frissíteni kell.

A HeyMax „**DataHeaven**" menüpontja (Simple Planner alatt, D-lépcső logó,
LIVE badge) a **data.katonazoli.hu** riport-API-jából jelenít meg élő
PMS-/Channel Manager-adatokat. Az adatok kezelése (feltöltés, hotelek,
kulcsok) a DataHeaven Adminban történik: https://data.katonazoli.hu/admin

## Architektúra

Böngésző → HeyMax `/api/dataheaven/*` proxy (session-auth) → DataHeaven
`/api/v1/*` (Bearer API-kulcs, CSAK szerver-oldalon) → JSON riport-csomag.

- Az API-kulcs sosem jut a böngészőbe.
- 5 perces `revalidate` cache a proxyban → „friss" adat, felesleges hívások nélkül.

## Env (Vercel + .env.local)

| Változó | Érték |
| --- | --- |
| `DATAHEAVEN_API_URL` | `https://data.katonazoli.hu` |
| `DATAHEAVEN_API_KEY` | `dhk_…` — a DataHeaven Adminban generálható/visszavonható |

## Párosítás

`Hotel.dataheavenHotelId` (prisma, nullable) ↔ DataHeaven hotel id.
A `/dataheaven` oldal párosító UI-t mutat, amíg nincs beállítva; a
`POST /api/dataheaven/pair` állítja (null = szétkapcsolás).

## Fájlok

- `src/app/(app)/dataheaven/page.tsx` — oldal: párosítás + tabok
  (Szegmensek / Értékesítési csatornák / Nemzetiség / Channel Manager),
  évválasztó, Tól–Ig hónapszűrő, „vs előző év" összehasonlítás
- `src/app/api/dataheaven/{hotels,pair,metrics}/route.ts` — proxy végpontok
- `src/lib/dataheaven.ts` — szerver-oldali fetch-kliens
- `src/modules/dataheaven/` — DataHeaven-arculatú nézetek (types, dh.css
  scoped tokenek, Wordmark, Dashboard, NationalityView, ChannelPerformance,
  ChannelTrend) — **a DataHeaven repóból másolt, ott a forrás-igazság**
- `src/lib/module-access.ts` — `DATAHEAVEN` modul (jogosultság-kapcsoló)
- `src/components/layout/Sidebar.tsx` — menüpont a Simple Planner alatt

## DataHeaven API-kontraktus (amit fogyasztunk)

- `GET /api/v1/hotels` → `{hotels:[{id,name,pms,roomCount,domains,coverage}]}`
- `GET /api/v1/hotels/:id/metrics?year=&mfrom=&mto=&cmp=1` →
  `{hotel,years,year,segments,salesChannels,nationality,channel,
    segmentsCompare,salesChannelsCompare,nationalityCompare}`
  (a mezők null-ozhatók; `channel.period.summary` a pontos YoY-összesítő)

A kontraktus gazdája a DataHeaven repo — változásnál ott indul a munka, és ez
a doksi + a `src/modules/dataheaven/types.ts` frissítendő.

## Tervezett következő lépés

**Terv–tény nézet**: Simple Planner terv (ADR/kihasználtság/bevétel) vs
DataHeaven tényadatok, havi bontásban, egy nézetben.
