"use client";

import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 18, marginBottom: 28 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg,#7C3AED,#5B21B6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 800, color: "white",
        boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
        marginTop: 2,
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>{title}</h3>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.75 }}>{children}</div>
      </div>
    </div>
  );
}

function Section({ emoji, title, subtitle, children }: { emoji: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
      padding: "28px 32px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: subtitle ? 6 : 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: "linear-gradient(135deg,#F5F3FF,#EDE9FE)",
          border: "1px solid #DDD6FE",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>{emoji}</div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 13, color: "#64748B", margin: "3px 0 0" }}>{subtitle}</p>}
        </div>
      </div>
      {subtitle && <div style={{ marginBottom: 24 }} />}
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12,
      padding: "12px 16px", marginTop: 12, marginBottom: 4,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
      <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12,
      padding: "12px 16px", marginTop: 12,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
      <div style={{ fontSize: 12, color: "#0C4A6E", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Badge({ children, color = "#7C3AED", bg = "#EDE9FE" }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 8px",
      borderRadius: 6, background: bg, color, letterSpacing: "0.02em",
    }}>{children}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManualPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#F1F5F9",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 32px 80px" }}>

        {/* Back link */}
        <Link href="/simple-planner" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "#7C3AED",
          textDecoration: "none", marginBottom: 28,
        }}>
          ← Vissza a Simple Plannerhez
        </Link>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
          borderRadius: 20, padding: "36px 40px", marginBottom: 28,
          position: "relative", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(124,58,237,0.25)",
        }}>
          <div style={{ position: "absolute", right: -30, top: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 80, bottom: -50, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 32 }}>📖</span>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>Simple Planner</p>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: "white", margin: 0, letterSpacing: "-0.02em" }}>Felhasználói kézikönyv</h1>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.7, maxWidth: 560 }}>
              Ez az útmutató lépésről lépésre vezet végig a Simple Planner beállításán és napi használatán —
              az első konfigurációtól az ügyfélriport megosztásáig.
            </p>
          </div>
        </div>

        {/* Tartalomjegyzék */}
        <div style={{
          background: "white", border: "1px solid #E2E8F0", borderRadius: 16,
          padding: "20px 28px", marginBottom: 24,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Tartalomjegyzék</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 32px" }}>
            {[
              ["1", "Mi a Simple Planner?"],
              ["2", "Beállítások — TFH"],
              ["3", "Beállítások — Kiadás sávok"],
              ["4", "Beállítások — Étkezési bevételek (F&B)"],
              ["5", "Beállítások — Board mix alapértékek"],
              ["6", "Beállítások — Egyéb bevételek"],
              ["7", "Terv létrehozása"],
              ["8", "Havi adatok megadása"],
              ["9", "Board mix gyors kitöltő"],
              ["10", "Eredmények értelmezése"],
              ["11", "Terv megosztása ügyféllel"],
              ["12", "Tippek & GYIK"],
            ].map(([n, label]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 6, background: "#F5F3FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800, color: "#7C3AED", flexShrink: 0,
                }}>{n}</span>
                <span style={{ fontSize: 13, color: "#334155" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 1. Mi a Simple Planner ─────────────────────────────────────────── */}
        <Section emoji="⚡" title="1. Mi a Simple Planner?" subtitle="Éves profittervező szállodák számára">
          <p style={{ margin: "0 0 16px" }}>
            A Simple Planner egy könnyen kezelhető éves profitkalkulátor, amivel hónapról hónapra tervezheted a szálloda bevételeit és kiadásait.
            Az eredményt egyetlen kattintással megoszthatod az ügyféllel egy interaktív riport formájában.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              ["📊", "Éves terv", "ADR + kihasználtság alapján kiszámolja a havi és éves profitot, TFH-t, fedezeti pontot."],
              ["🍽️", "F&B bevételek", "Reggeli és félpanzió arányok alapján automatikusan hozzáadja az étkezési bevételeket az ADR-hez."],
              ["🔗", "Ügyfél megosztás", "Jelszóval védett, lejárati dátummal ellátott link — az ügyfél saját maga szimulálhatja a foglaltságot."],
            ].map(([icon, title, desc]) => (
              <div key={title as string} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px" }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: "8px 0 4px" }}>{title}</p>
                <p style={{ fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
          <Note>A beállítások szálloda-szintűek — egyszerre kell elvégezni, és utána minden tervben érvényesek.</Note>
        </Section>

        {/* ─── 2. TFH ────────────────────────────────────────────────────────── */}
        <Section emoji="🏛️" title="2. TFH — Turizmus fejlesztési hozzájárulás" subtitle="Beállítások → TFH szekció">
          <Step n={1} title="Nyisd meg a Beállítások oldalt">
            A bal oldali menüben a <Badge>Simple Planner</Badge> alatt kattints a <Badge>Beállítások</Badge> almenüre.
          </Step>
          <Step n={2} title="Kapcsold be a TFH-t (ha szükséges)">
            A <strong>TFH (Turizmus fejlesztési hozzájárulás)</strong> szekció tetején találsz egy be/ki kapcsolót.
            Ha a szálloda fizet TFH-t, kapcsold be.
          </Step>
          <Step n={3} title="Add meg a TFH kulcsot">
            Az alapértelmezett érték <strong>4%</strong>. A mező mellett közvetlenül beírhatod az érvényes kulcsot.
          </Step>
          <Note>A TFH a számított bevételből kerül levonásra, mielőtt a profitot kiszámolja a rendszer. Az ügyfélriporton külön sorban jelenik meg.</Note>
        </Section>

        {/* ─── 3. Kiadás sávok ─────────────────────────────────────────────── */}
        <Section emoji="📉" title="3. Kiadás sávok" subtitle="Beállítások → Kiadás sávok kihasználtság szerint">
          <p style={{ margin: "0 0 20px" }}>
            A kiadás sávokkal meghatározod, hogy az egyes kihasználtsági szinteken mennyi a szoba/éjszaka kiadás.
            A rendszer minden hónapban automatikusan a megfelelő sávból veszi a kiadást.
          </p>
          <Step n={1} title='Kattints a "Sáv hozzáadása" gombra'>
            Minden sáv egy kihasználtsági tartomány (<strong>tól%–ig%</strong>) és egy hozzá tartozó kiadás értékből áll.
          </Step>
          <Step n={2} title="Töltsd ki a tartományokat">
            Adj meg <strong>kihasználtság % (tól)</strong> és <strong>kihasználtság % (ig)</strong> értékeket.
            Például: 0–40%, 40–65%, 65–85%, 85–100%.
          </Step>
          <Step n={3} title="Add meg a kiadást (Ft/szoba/éj)">
            A <strong>Kiadás</strong> mezőbe írd be, mennyi az adott foglaltság esetén a szoba/éjszaka működési kiadás forintban.
          </Step>
          <Step n={4} title="Megnevezés (opcionális)">
            A <strong>Megnevezés</strong> mező szabad szöveges — pl. "Alacsony szezon", "Főszezon". Nem kötelező.
          </Step>
          <Tip>
            <strong>Lefedd az egész 0–100% tartományt!</strong> Ha egy hónap kihasználtsága kiesik a sávok közül,
            a rendszer nem tud automatikus kiadást rendelni hozzá — ekkor manuálisan kell megadni a havi kiadást.
          </Tip>
          <Note>
            Ha egy hónaphoz manuálisan adsz meg kiadást (a havi input kártyában), az felülírja a sáv alapján számolt értéket.
          </Note>
        </Section>

        {/* ─── 4. F&B ──────────────────────────────────────────────────────── */}
        <Section emoji="🍽️" title="4. Étkezési bevételek (F&B)" subtitle="Beállítások → Étkezési bevételek szekció">
          <Step n={1} title="Kapcsold be az F&B modult">
            Az <strong>Étkezési bevételek (F&B)</strong> szekció tetején találod a be/ki kapcsolót. Kapcsold be, ha a szálloda étkezést is kínál.
          </Step>
          <Step n={2} title="Add meg a reggeli árát">
            <strong>Reggeli ára (Ft/fő/éj)</strong> — az egy vendégre jutó reggeli bruttó ára.
          </Step>
          <Step n={3} title="Add meg a félpanzió árát">
            <strong>Félpanzió ára (Ft/fő/éj)</strong> — reggeli + vacsora ára vendégenként.
          </Step>
          <Step n={4} title="Átlagos vendégszám szobánként">
            <strong>Átlag vendég/szoba</strong> — hány főre tervezzük átlagosan a szobákat. Az alapértelmezett érték <strong>1,8</strong>.
            Ez a szám szorzódik az étkezési árakkal a bevétel kiszámításakor.
          </Step>
          <Tip>
            A bevételi képlet: <strong>(reggeli% × reggeli ár + félpanzió% × félpanzió ár) × átlag vendég/szoba</strong> = F&B felár/szoba/éj.
            Ez automatikusan hozzáadódik az ADR-hez.
          </Tip>
        </Section>

        {/* ─── 5. Board mix alapértékek ────────────────────────────────────── */}
        <Section emoji="🎚️" title="5. Board mix alapértékek" subtitle="Beállítások → Étkezési bevételek → Board mix csúszkák">
          <p style={{ margin: "0 0 20px" }}>
            A board mix megmutatja, hogy a szobák hány százalékában foglaltak reggeli / félpanzió vendégek.
            Az alapértékek azokra a hónapokra érvényesek, ahol nincs egyedi beállítás.
          </p>
          <Step n={1} title="Reggeli arány csúszka">
            Húzd a <strong>Reggeli %</strong> csúszkát, vagy kattints az előre beállított gombokra (0%, 10%, 25% stb.).
            Ez azt jelenti, a szobák hány %-ában foglal reggeli vendég.
          </Step>
          <Step n={2} title="Félpanzió arány csúszka">
            Húzd a <strong>Félpanzió %</strong> csúszkát. A reggeli + félpanzió együtt nem haladhatja meg a 100%-ot —
            a különbség automatikusan "csak szoba" vendég.
          </Step>
          <Step n={3} title="Háromrészes megoszlás sáv">
            A csúszkák felett egy vizuális sáv mutatja a <strong>csak szoba / reggeli / félpanzió</strong> arányt valós időben.
          </Step>
          <Note>
            Ezek az <strong>alapértékek</strong> — a Simple Planner tervlapon havonként felülírhatod őket.
            Ha egy hónaphoz nincs külön board mix megadva, az alapértékek érvényesülnek.
          </Note>
        </Section>

        {/* ─── 6. Egyéb bevételek ──────────────────────────────────────────── */}
        <Section emoji="💰" title="6. Egyéb bevételek" subtitle="Beállítások → Egyéb bevételi kategóriák">
          <p style={{ margin: "0 0 20px" }}>
            Ha a szállodának van spa-, egyéb F&B- vagy más bevétele, ezeket az ADR százalékaként adhatod meg.
            A rendszer minden szobaéjszakára arányosan hozzáadja a bevételhez.
          </p>
          {[
            ["Egyéb F&B", "Éttermi forgalom, bár, room service — az ADR %-a."],
            ["Spa & wellness", "Kezelések, belépők — az ADR %-a."],
            ["Egyéb bevétel", "Parkoló, konferenciaterem, egyéb — az ADR %-a."],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>▸</span>
              <div>
                <strong style={{ fontSize: 13, color: "#0F172A" }}>{title}:</strong>{" "}
                <span style={{ fontSize: 13, color: "#475569" }}>{desc}</span>
              </div>
            </div>
          ))}
          <Tip>
            Minden kategóriánál van egy be/ki kapcsoló. Csak a bekapcsolt kategóriák kerülnek bele a számításba.
            Ha nem releváns a szálloda számára, hagyd kikapcsolva.
          </Tip>
        </Section>

        {/* ─── 7. Terv létrehozása ─────────────────────────────────────────── */}
        <Section emoji="📋" title="7. Terv létrehozása" subtitle="Simple Planner főoldal">
          <Step n={1} title='Menj a Simple Planner főoldalra'>
            A bal menüben kattints a <Badge>Simple Planner</Badge> menüpontra (lila, villámos ikon).
          </Step>
          <Step n={2} title='"Új terv" gomb'>
            A jobb felső sarokban kattints az <Badge bg="#DCFCE7" color="#059669">+ Új terv</Badge> gombra.
          </Step>
          <Step n={3} title="Adj nevet és évet a tervnek">
            A terv neve legyen egyértelmű (pl. <em>"2025 alapterv"</em>, <em>"2025 optimista"</em>).
            Válaszd ki az évet — ez meghatározza az egyes hónapok napjainak számát.
          </Step>
          <Step n={4} title="Terv megnyitása">
            A lista rácsában kattints bármelyik tervre a megnyitáshoz.
          </Step>
        </Section>

        {/* ─── 8. Havi adatok ──────────────────────────────────────────────── */}
        <Section emoji="🗓️" title="8. Havi adatok megadása" subtitle="Simple Planner tervlap — Havi input adatok">
          <p style={{ margin: "0 0 20px" }}>
            A tervlapon 12 havi kártyát találsz. Minden kártyán a következő mezők érhetők el:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {[
              ["ADR (Ft)", "Átlagos szobai díj forintban. Ez az alap a bevételi számításhoz."],
              ["Kihasználtság (%)", "Tervezett foglaltság százalékban. A szobaeladott éjszakák ebből számolódnak."],
              ["Szobaárbevétel (Ft/szoba/éj)", "Ha megadsz értéket, ez felülírja az ADR + F&B számítást. Csak akkor töltsd ki, ha konkrét árbevétel adatod van."],
              ["Kiadás (Ft/szoba/éj)", "Ha megadsz értéket, ez felülírja a kiadás sávból automatikusan behúzott értéket."],
              ["Reggeli (%)", "Havi reggeli arány — felülírja az alapértéket ennél a hónapnál."],
              ["Félpanzió (%)", "Havi félpanzió arány — felülírja az alapértéket ennél a hónapnál."],
            ].map(([field, desc]) => (
              <div key={field as string} style={{
                display: "flex", gap: 12, background: "#F8FAFC",
                border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px",
              }}>
                <strong style={{ fontSize: 12, color: "#7C3AED", minWidth: 180, flexShrink: 0 }}>{field}</strong>
                <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{desc}</span>
              </div>
            ))}
          </div>
          <Note>
            Az értékeket <strong>fókuszvesztéskor (onBlur)</strong> menti el a rendszer automatikusan — nem kell külön mentés gomb.
            A mentés sikerességét a jobb felső sarokban megjelenő <Badge bg="#DCFCE7" color="#059669">✓ Mentve</Badge> jelzi.
          </Note>
        </Section>

        {/* ─── 9. Board mix gyors kitöltő ─────────────────────────────────── */}
        <Section emoji="🎛️" title="9. Board mix gyors kitöltő" subtitle="Simple Planner tervlap — Étkezési vendégmix szekció">
          <p style={{ margin: "0 0 20px" }}>
            Az <strong>Étkezési vendégmix — gyors kitöltő</strong> blokk (csak ha az F&B engedélyezve van) egy helyen
            kezeli a board mix arányokat és az összes hónapos rögzítést.
          </p>
          <Step n={1} title="Állítsd be a reggeli és félpanzió arányt">
            Húzd a csúszkákat, vagy kattints a preset gombokra (0%, 10%, 25%, 50% stb.).
            Valós időben látod az F&B hozzájárulást (Ft/szoba/éj).
          </Step>
          <Step n={2} title='"✓ Alkalmazás mind a 12 hónapra" gomb'>
            Ez a gomb <strong>egyszerre</strong> elvégzi a következőket:
            <ul style={{ margin: "8px 0 0 20px", lineHeight: 2 }}>
              <li>Beállítja a reggeli/félpanzió %-ot mind a 12 hónapban</li>
              <li>Kiszámolja a szobaárbevételt (ADR + F&B + egyéb bevételek) minden hónapra</li>
              <li>Elmenti az adatbázisba</li>
            </ul>
            <Tip>
              <strong>Ez az ajánlott első lépés</strong> minden új tervnél — miután megadtad az ADR és kihasználtság értékeket,
              nyomd meg ezt a gombot, és a rendszer mindent kiszámol.
            </Tip>
          </Step>
          <Step n={3} title='"Rögzítés a tervbe" gomb'>
            Ha csak a csúszkát módosítottad (de nem akarod az összes hónapra alkalmazni),
            ezzel a gombbal rögzítheted az aktuális slider értékekből számolt szobaárbevételeket.
            <br /><br />
            A gomb <strong>csak akkor aktív</strong>, ha módosítottad valamelyik csúszkát — ezzel megakadályozza a véletlen felülírást.
          </Step>
        </Section>

        {/* ─── 10. Eredmények ──────────────────────────────────────────────── */}
        <Section emoji="📊" title="10. Eredmények értelmezése" subtitle="Simple Planner tervlap — KPI kártyák és táblázat">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              ["💰 Éves bevétel", "Az összes hónap tervezett bevételének összege."],
              ["🏛️ TFH", "Az idegenforgalmi adó összege — csak ha a TFH be van kapcsolva."],
              ["📈 Éves profit", "Bevétel − kiadás − TFH. Pozitív = nyereség, negatív = veszteség."],
              ["🏨 Átl. kihasználtság", "A kitöltött hónapok kihasználtságának egyszerű átlaga."],
              ["📉 Átl. margin", "Profit / Bevétel arány %-ban, hónapok átlaga."],
              ["💵 Átlag ADR", "Szobaeladott éjszakával súlyozott átlagos szobai díj."],
              ["🏷️ Szobaárbev./szoba/éj", "Összes bevétel / összes eladott éjszaka. ADR + F&B + egyéb bevételek."],
            ].map(([kpi, desc]) => (
              <div key={kpi as string} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>{kpi}</p>
                <p style={{ fontSize: 11, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
          <p style={{ margin: "0 0 12px" }}>
            A <strong>havi eredmények táblázat</strong> minden hónaphoz mutatja: szobaeladott éjszakák száma, bevétel, kiadás, TFH, profit, margin és fedezeti pont.
          </p>
          <p style={{ margin: "0 0 12px" }}>
            A <strong>foglaltsági szimulátor csúszkával</strong> megnézheted, hogy ±1–30 százalékpontnyi foglaltság-változás milyen hatással lenne az éves bevételre és profitura.
          </p>
        </Section>

        {/* ─── 11. Megosztás ───────────────────────────────────────────────── */}
        <Section emoji="🔗" title="11. Terv megosztása ügyféllel" subtitle="Simple Planner tervlap — Megosztás szekció">
          <Step n={1} title="Nyisd meg a Megosztás szekciót">
            A tervlapon görgess le a <strong>Megosztás</strong> blokkig (lánc ikon), vagy kattints a fejlécben a <Badge>🔗 Megosztás</Badge> gombra.
          </Step>
          <Step n={2} title="Kapcsold be a megosztást">
            A <strong>Megosztás engedélyezése</strong> kapcsolóval aktiválod a nyilvános linket.
          </Step>
          <Step n={3} title="Lejárati dátum (opcionális)">
            Beállíthatsz egy dátumot, ami után a link automatikusan érvénytelenné válik.
            Ajánlott: a tárgyalás utáni 2–4 hét.
          </Step>
          <Step n={4} title="Jelszavas védelem (opcionális)">
            Ha jelszót adsz meg, az ügyfélnek be kell gépelnie azt a link megnyitásakor.
            A jelszó titkosítva tárolódik.
          </Step>
          <Step n={5} title="AI összefoglaló (opcionális)">
            Az <strong>AI összefoglaló</strong> mező szabad szöveges bevezető, amit az ügyfél a riport tetején lát.
            Ide írhatsz kontextust, kulcsüzenetet, ajánlást — akár AI-jal is generáltathatod a beépített gombbal.
          </Step>
          <Step n={6} title="Link másolása és küldése">
            Kattints a <Badge bg="#EDE9FE" color="#7C3AED">🔗 Link másolása</Badge> gombra, majd küldd el az ügyfélnek emailben vagy chatben.
          </Step>
          <Note>
            <strong>Mit lát az ügyfél a riporton?</strong><br />
            A megosztott oldalon az ügyfél látja a KPI kártyákat (bevétel, profit, ADR, szobaárbevétel, kihasználtság),
            az interaktív foglaltsági szimulátort — ahol ő maga állíthatja a kihasználtság változást —,
            az étkezési bevételi struktúrát (ha F&B engedélyezve), a havi bontás táblázatot és a grafikonokat.
          </Note>
        </Section>

        {/* ─── 12. Tippek & GYIK ───────────────────────────────────────────── */}
        <Section emoji="💡" title="12. Tippek & GYIK">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              [
                "Mikor írjam felül a Szobaárbevétel mezőt manuálisan?",
                "Ha van konkrét, megállapodott ár arra a hónapra (pl. csoportos foglalás fix árral), add meg közvetlenül. Ha üresen hagyod, a rendszer ADR + F&B + egyéb bevételekből számol.",
              ],
              [
                "Mikor érdemes több tervet létrehozni?",
                "Tipikusan: egy 'alapterv' (realisztikus), egy 'pesszimista' (alacsonyabb kihasználtság) és egy 'optimista'. A szimulátorral is megnézheted a különböző szcenáriókat egy tervből.",
              ],
              [
                "Ha megváltoztatom a beállításokat, frissülnek-e a régi tervek?",
                "A beállítások azonnal érvényesek az új tervekre. A régi tervekben a havi breakfastPct/halfboardPct értékek és a manuálisan rögzített szobaárbevételek megmaradnak — ezeket az 'Alkalmazás mind a 12 hónapra' gombbal frissítheted.",
              ],
              [
                "Miért nem aktív a 'Rögzítés a tervbe' gomb?",
                "A gomb csak akkor aktív, ha módosítottad valamelyik board mix csúszkát az oldal betöltése óta — ez megakadályozza a véletlen felülírást. Egyszerűen mozdítsd meg a csúszkát, és aktívvá válik.",
              ],
              [
                "Mi a különbség az ADR és a Szobaárbevétel/szoba/éj KPI között?",
                "Az ADR a tervezett szobai díj (amit a vendég fizet a szobáért). A Szobaárbevétel/szoba/éj ennél több: tartalmazza az F&B felárat és az egyéb bevételeket is — ez mutatja a valós, teljes bevételt szobaéjszakánként.",
              ],
            ].map(([q, a]) => (
              <div key={q as string} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 18px" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>❓ {q}</p>
                <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.7 }}>{a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <p style={{ fontSize: 12, color: "#94A3B8" }}>Hotel Profit · Simple Planner kézikönyv</p>
          <Link href="/simple-planner" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginTop: 8, fontSize: 13, fontWeight: 600, color: "#7C3AED", textDecoration: "none",
          }}>
            ← Vissza a Simple Plannerhez
          </Link>
        </div>

      </div>
    </div>
  );
}
