# HeyMax! — Felhasználói kézikönyv

> **Plan. Forecast. Maximize.**

---

## Mi ez és mire jó?

A **HeyMax!** egy szállodai profittervező SaaS eszköz, amelyet kifejezetten revenue management tanácsadók és szállodavezetők számára fejlesztettünk. Egyetlen, jól összerakott felületen teszi lehetővé az éves profit megtervezését, a „mi lenne, ha" szimulációkat, és az eredmények professzionális, interaktív bemutatását az ügyfélnek.

Nem egy újabb táblázat: a számítási logika a háttérben fut, a bevételek, kiadások, adók és margin automatikusan frissülnek, ahogy változtatod az adatokat. Az ügyfél pedig nem egy statikus PDF-et kap, hanem egy élő oldalt, ahol maga fedezi fel, mit jelent +5% kihasználtság a profitjára nézve.

### Kinek szól?

- Revenue management tanácsadóknak, akik ügyfeleiknek profittervet készítenek
- Szállodavezetőknek, akik saját maguk terveznek és prezentálnak
- Értékesítési csapatoknak, akik az ügyféllel közösen akarják végigvezetni a számokat

### Miben különbözik az Exceltől?

| Excel | HeyMax! |
|---|---|
| Kézi képletek, könnyen elromlik | Számítási logika a háttérben, mindig helyes |
| Nem megosztható biztonságosan | Interaktív link, jelszóval és lejárattal |
| Statikus, nincs „mi lenne, ha" | Valós idejű szimulátor csúszkával |
| Csak te érted | Az ügyfél is tud vele dolgozni |

---

## A Simple Planner — lépésről lépésre

A Simple Planner a HeyMax! fő modulja: ADR + kihasználtság alapú, havi bontású profitterv, kiadásmodellel, szimulátorral és megosztható interaktív riporttal.

---

## 1. Beállítások

A beállítások **szálloda-szintűek**: egyszer kell megadni, és minden tervre érvényesek. A `Simple Planner → Beállítások` menüpontban találod.

---

### 1.1 TFH (Turizmusfejlesztési hozzájárulás)

| Mező | Leírás | Alapértelmezett |
|---|---|---|
| TFH bekapcsolva | Be/ki kapcsoló | Bekapcsolva |
| TFH kulcs (%) | A bevétel hány százalékát vonja le a TFH | 4% |

A TFH a bevételből kerül levonásra, a profit kiszámítása előtt:

```
Profit = Bevétel − Kiadás − TFH
```

Ha a szálloda nem alanya a TFH-nak (pl. nem szálláshely-szolgáltatás), kapcsold ki — a mező ekkor nem szerepel a számításban és a riporton sem.

---

### 1.2 Fix éves költségek

Ez a szekció a szálloda **kihasználtságtól független**, fix terheinek felvételére szolgál. Minden tételt külön sorban adsz meg, éves összegben (Ft). A sorok szabadon bővíthetők, törölhetők és átrendezhetők.

**Tipikus tételek:**

- Bérköltség és járulékok
- Rezsi (villany, gáz, víz)
- Bérleti díj / törlesztő
- Biztosítás
- Marketing éves keret
- Szoftver, könyvelés, adminisztráció

A rendszer az összes tétel éves összegét összeadja, és ezt egyenlő arányban osztja el 12 hónapra:

```
Fix havi kiadás = Éves fix összeg ÷ 12
```

Ez az összeg minden hónap kiadásában megjelenik, függetlenül a kihasználtságtól.

---

### 1.3 F&B (Étkezési) bevételek

Ha a szállodában van étkeztetés, ebben a szekcióban adod meg az árakat és az alapértelmezett arányokat.

| Mező | Leírás |
|---|---|
| F&B bekapcsolva | Be/ki kapcsoló |
| Reggeli ára (Ft/fő/éj) | A reggeli ellátás nettó ára fejenként |
| Félpanzió ára (Ft/fő/éj) | A félpanzió nettó ára fejenként |
| Átlagos vendégszám szobánként | Hány fő tartózkodik átlagosan egy szobában (pl. 1,8) |
| Alapértelmezett reggeli arány (%) | Ha a havi kártyán nem adod meg, ez az érték kerül alkalmazásra |
| Alapértelmezett félpanzió arány (%) | Ugyanez félpanzióra |

**Számítás:**

```
F&B bevétel/szoba/éj = Vendégszám × (Reggeli arány × Reggeli ára + Félpanzió arány × Félpanzió ára)
```

Ez az érték az ADR-re kerül rá, ha ADR alapon tervez a terv. Ha szobaárbevétel-sort töltesz ki, a rendszer azt veszi figyelembe.

---

### 1.4 Egyéb bevételek (ADR %-ában)

Ha a szállodának van spa, éttermi bevétel (nem ellátás), fizetős parkoló, bankett vagy egyéb bevétele, ezeket az ADR százalékában veheted fel.

| Kapcsoló | Leírás |
|---|---|
| Egyéb F&B (%) | Étterem, bár forgalma — az ADR X%-a |
| Spa (%) | Wellness, masszázs — az ADR X%-a |
| Egyéb bevétel (%) | Minden más — az ADR X%-a |

> **Fontos:** ezek csak az ADR-alapú számításhoz adódnak hozzá. Ha szobaárbevétel-sorral (room revenue) dolgozol, ezek nem kerülnek rá automatikusan — a sor már tartalmaz mindent.

---

### 1.5 F&B önköltség (kiadás oldal)

A bevételek mellé az étkeztetés saját önköltségét is megadhatod, hogy valós profit jelenjen meg.

| Mező | Leírás |
|---|---|
| Reggeli önköltség (Ft/fő/éj) | Egy reggeli előállítási/nyersanyag-költsége fejenként |
| Félpanzió önköltség (Ft/fő/éj) | Félpanzió önköltsége fejenként |

**Számítás:**

```
F&B kiadás/szoba/éj = Vendégszám × (Reggeli arány × Reggeli önköltség + Félpanzió arány × Félpanzió önköltség)
```

---

### 1.6 Mosatás

| Mező | Leírás |
|---|---|
| Mosatás bekapcsolva | Be/ki kapcsoló |
| Mosatás költsége (Ft/szoba/éj) | Kiadott szobaéjszakánként felszámított mosatási díj |

A mosatás **változó kiadás**: szorzódik a kiadott szobaéjszakák számával, tehát annál több, minél nagyobb a kihasználtság. Ez pontosan tükrözi a valóságot.

---

### 1.7 Jutalék

| Mező | Leírás |
|---|---|
| Jutalék bekapcsolva | Be/ki kapcsoló |
| Átlagos jutalék mértéke (%) | Az OTA / ügynöki jutalék átlagos százaléka |
| Jutalékos foglalások aránya (%) | A foglalások hány százaléka érkezik jutalékos csatornán |

A jutalék alapja az **ADR + ellátás ára** — a spa és egyéb extra bevételek nem részei az alapnak, mert azok után jellemzően nem fizetsz OTA-jutalékot.

**Számítás:**

```
Jutalék/szoba/éj = (ADR + Ellátás bevétele) × Jutalék% × Jutalékos arány%
```

**Példa:** ADR 30 000 Ft, reggeli ára 2 000 Ft/szoba/éj, 15% jutalék, foglalások 60%-a OTA-ról érkezik:

```
Jutalék = 32 000 × 0,15 × 0,60 = 2 880 Ft/szoba/éj
```

Gyorsgombok az arányhoz: 20% / 40% / 60% / 80% / 100%.

---

### A teljes kiadásképlet összefoglalva

```
Havi kiadás = (Éves fix ÷ 12) + (F&B önköltség + Mosatás + Jutalék) × Kiadott szobaéjszakák
```

Ez a modell helyesen tükrözi a szállodai gazdaságtant: a fix rész állandó (kihasználtságtól független), a változó rész arányosan nő a forgalommal.

---

## 2. Terv létrehozása és kitöltése

### 2.1 Új terv

A Simple Planner főoldalán az **Új terv** gombbal hozz létre tervet. Adj meg:

- **Nevet** (pl. „2025 – Alapterv" vagy „2025 – Optimista")
- **Évet** — az évet a napok számának kiszámításához használja a rendszer (február 28 vs. 29 nap stb.)

Egy szállodához több tervet is létrehozhatsz — alapterv, optimista, pesszimista, különböző árazási stratégiák.

---

### 2.2 Havi kártyák kitöltése

Minden hónaphoz egy kártya tartozik. A kitölthető mezők:

| Mező | Leírás |
|---|---|
| Kihasználtság (%) | Tervezett foglaltság az adott hónapra |
| ADR (Ft) | Átlagos szobai díj (Average Daily Rate) |
| Szobaárbevétel (Ft/szoba/éj) | Opcionális: ha PMS-ből jövő összbevételt adsz meg |
| Reggeli arány (%) | A vendégek hány %-a veszi igénybe a reggelit |
| Félpanzió arány (%) | A vendégek hány %-a veszi igénybe a félpanziót |

A mezők **fókuszvesztéskor automatikusan mentődnek** — nincs külön Mentés gomb, csak egy diszkrét visszajelzés.

Minden kártyán megjelenik egy **olvasható kiadás/éj érték** (kiadás/szoba/éj az aktuális kihasználtságon), amely automatikusan frissül, ha változtatod a kihasználtságot vagy a beállításokat. Ez a mező nem szerkeszthető.

---

### 2.3 Board mix gyors kitöltő

Ha a legtöbb hónapra azonos ellátási arány érvényes, az **Alapértelmezett arányok alkalmazása mind a 12 hónapra** gombbal egy mozdulattal kitölthető az összes hónap. Ez az ajánlott első lépés minden új tervnél.

---

### 2.4 ADR vs. szobaárbevétel — melyiket válassza?

| Módszer | Mikor használd |
|---|---|
| **ADR** | Ha az F&B-t és egyéb bevételeket külön kezeled, és az ADR csak a szobadíjat tartalmazza |
| **Szobaárbevétel (room revenue)** | Ha a PMS-ből jövő összes szobai bevételt (szoba + étkezés + extras) egy sorban kezeled |

Ha szobaárbevétel-sort töltesz ki, az ADR mező és az F&B beállítások figyelmen kívül maradnak az adott hónapnál.

---

## 3. Eredmények értelmezése

### 3.1 KPI kártyák

A terv tetején összesítő mutatók jelennek meg a kitöltött hónapokra:

| KPI | Leírás |
|---|---|
| Éves bevétel | Az összes hónap nettó bevételének összege |
| Éves kiadás | Fix + változó kiadások összege |
| TFH összesen | Ha engedélyezve van |
| Éves profit | Bevétel − Kiadás − TFH |
| Átlagos kihasználtság | A kitöltött hónapok foglaltságának átlaga |
| Súlyozott átlag ADR | Eladott szobaéjszakával súlyozott átlag |
| Fedezeti pont | Az a kihasználtsági szint, ahol a profit éppen nulla |
| Profit margin | Profit / Bevétel × 100 |

### 3.2 Havi táblázat

A részletes táblázat hónapokra bontva mutatja:

- Bevétel (Ft)
- Kiadás (Ft)
- TFH (Ft)
- Profit (Ft)
- Profit margin (%)
- Fedezeti pont (%)
- Kiadás / szoba / éj (Ft)

---

## 4. Szimulátor

A szimulátor lehetővé teszi a terv valós idejű érzékenységvizsgálatát anélkül, hogy a havi adatokat módosítanád. Az alapterv érintetlen marad.

### 4.1 Kihasználtság csúszka

- **Tartomány:** −30 pp … +30 pp az alaptervhez képest
- **Szín:** zöld
- Minden hónap kihasználtságát arányosan módosítja
- A KPI-ok és a táblázat azonnal frissülnek

### 4.2 ADR korrekció csúszka

- **Tartomány:** −30% … +30% az alaptervhez képest
- **Szín:** indigó
- Az összes hónap ADR-jét és szobaárbevételét arányosan módosítja
- Megmutatja az árszint érzékenységét

Mindkét csúszka egyszerre aktív lehet, és a hatásuk összeadódik. A **Visszaállítás** gomb egyszerre nullázza mindkettőt.

**Tipikus használat bemutatónál:** „Nézzük meg, mi történik, ha az ADR 10%-kal csökken és a kihasználtság 5 pp-tal esik" — a szimulátor valós időben mutatja az éves profit változását.

---

## 5. Ügyfélmegosztás (Riport)

A HeyMax! legerősebb funkciója, hogy a kész tervet **interaktív riportként** adhatod át az ügyfélnek. Nem egy statikus PDF, hanem egy élő oldal.

### 5.1 Link generálása

A terv jobb felső sarkában a **Megosztás** gombbal hozol létre publikus linket.

| Beállítás | Leírás |
|---|---|
| Megosztás engedélyezve | A link aktív legyen-e (bármikor kikapcsolható) |
| Jelszóvédelem | Opcionális belépési jelszó a megtekintőnek |
| Lejárati dátum | A link eddig az időpontig érvényes, utána automatikusan letiltódik |

### 5.2 AI összefoglaló

A riport tetején megjelenik egy szöveges összefoglaló mező. Ezt manuálisan írhatod, vagy a **Generálás** gombbal a HeyMax! AI-t hívja meg — a terv számaiból professzionális, magyar nyelvű összefoglalót ír, amelyet aztán személyre szabhatod.

### 5.3 Mit lát az ügyfél?

A megosztott riport teljes értékű interaktív oldal — ugyanolyan szimulátorral, mint a platform:

- KPI összesítő (bevétel, profit, kihasználtság, fedezeti pont)
- Kihasználtság csúszka (±30 pp) — valós idejű profit-frissítéssel
- ADR korrekció csúszka (±30%) — azonnal látható hatással
- Havi profit- és bevételi grafikon
- Részletes havi táblázat
- Tervezett árak táblázata (ADR / szobaárbevétel havi bontásban)

Az ügyfél **csak olvasni és szimulálni tud** — szerkeszteni nem.

> Az ügyfél maga fedezi fel, mit jelent +5% kihasználtság a profitjára nézve. Ez az a pont, ahol a HeyMax! átlép a belső tervezőeszköz kategóriájából az értékesítést támogató eszköz kategóriájába.

---

## 6. Gyors kezdési útmutató

Az alábbi sorrendet ajánljuk minden új szállodánál:

1. **Beállítások** — Add meg a TFH kulcsot, a fix éves kiadásokat tételenként, az F&B árakat és önköltséget, a mosatás és jutalék adatait. Ez egyszer elegendő.
2. **Új terv** — Adj nevet és évet.
3. **Board mix** — Állítsd be az alapértelmezett reggeli/félpanzió arányt, nyomd meg az „Alkalmazás 12 hónapra" gombot.
4. **Havi kártyák** — Töltsd ki a kihasználtságot és az ADR-t (vagy szobaárbevételt) minden hónapra.
5. **Ellenőrzés** — Nézd meg a KPI-okat és a havi táblázatot.
6. **Szimulátor** — Húzd el a csúszkákat, mutasd meg az érzékenységet.
7. **Megosztás** — Állítsd be a jelszót és a lejáratot, add át a linket az ügyfélnek.

---

## 7. Bevételi és kiadási logika — összefoglaló

### Bevétel

```
Ha ADR alapon tervez:
  Bevétel/szoba/éj = ADR + F&B bevétel + Egyéb bevételek (spa, parking stb.)

Ha szobaárbevétel-sort töltöttél ki:
  Bevétel/szoba/éj = Szobaárbevétel (mindent tartalmaz)

Havi bevétel = Bevétel/szoba/éj × Kihasználtság% × Szobák száma × Napok száma
```

### Kiadás

```
Változó kiadás/szoba/éj =
    F&B önköltség (vendégszám × ellátás önköltsége)
  + Mosatás (Ft/szoba/éj)
  + Jutalék ((ADR + Ellátás bevétele) × Jutalék% × Jutalékos arány%)

Havi kiadás =
    Fix/hó (éves fix ÷ 12)
  + Változó/szoba/éj × Kiadott szobaéjszakák
```

### Profit

```
TFH = Havi bevétel × TFH%
Havi profit = Havi bevétel − Havi kiadás − TFH
```

---

## 8. Tippek a hatékony használathoz

- **Több szcenárió** — Hozz létre alap-, optimista- és pesszimista tervet ugyanarra az évre. Megosztásnál mindig az alaptervet add az ügyfélnek, és ő maga állítja a szimulátort.
- **Jutalék kalibrálása** — Ha nem tudod pontosan a jutalékos arányt, kezdj 40%-kal, és finomhangold az év előrehaladtával.
- **Fix kiadások tételezése** — Minél részletesebben veszed fel a fix kiadásokat (pl. külön sor bérre, rezsire, bérletre), annál értékesebb a terv az ügyfél számára — látja, hol vannak a valódi fixek.
- **Lejárati dátum** — Mindig állíts be lejáratot a megosztott linkre. Egy tárgyalás utáni terv ne legyen örökre elérhető.
- **AI összefoglaló** — Generáltatás után olvasd át és egészítsd ki személyes kontextussal. Az AI a számokból indul ki, de a stratégiai ajánláshoz te kellesz.

---

*HeyMax! · Belső felhasználói kézikönyv*
*Legutóbb frissítve: 2026. június*
