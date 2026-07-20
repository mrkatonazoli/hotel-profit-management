/** FRO-501a Manager jelentés — metric catalog (parser + views share this).
 * `no` is the Hostware line number ("N.)" prefix); unnumbered lines match by
 * normalized label substring. Order here = display order inside groups. */

export type ManagerKind = "count" | "money" | "pct";

export type ManagerDef = {
  key: string;
  no?: number;
  match: string; // normalized (lowercase, accent-stripped) label substring
  label: string;
  group: string;
  kind: ManagerKind;
};

export const MANAGER_GROUPS = [
  "Vendégéjszakák",
  "Szobakapacitás és foglaltság",
  "Nettó forgalom",
  "Bruttó számlaforgalom és fizetési módok",
  "Fajlagos mutatók",
] as const;

export const MANAGER_CATALOG: ManagerDef[] = [
  // ── Vendégéjszakák ──
  { key: "adult_nights", no: 1, match: "felnott vendegejszaka", label: "Felnőtt vendégéjszaka", group: "Vendégéjszakák", kind: "count" },
  { key: "child_nights", no: 2, match: "tini+gyerek+bebi", label: "Tini + gyerek + bébi vendégéjszaka", group: "Vendégéjszakák", kind: "count" },
  { key: "total_nights", no: 3, match: "osszesen vendegejszaka", label: "Összes vendégéjszaka", group: "Vendégéjszakák", kind: "count" },
  { key: "vip_nights", no: 4, match: "vip vendegejszaka", label: "VIP vendégéjszaka", group: "Vendégéjszakák", kind: "count" },
  // ── Szobakapacitás és foglaltság ──
  { key: "rooms_total", no: 5, match: "osszes szobaejszaka", label: "Összes szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "rooms_ooo", no: 6, match: "out of order", label: "Out of Order szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "rooms_available", no: 7, match: "kiadhato szobaejszaka", label: "Kiadható szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "rooms_sold", no: 8, match: "kiadott szobaejszaka", label: "Kiadott szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "rooms_free", no: 9, match: "szabad szobaejszaka", label: "Szabad szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "new_bookings", match: "uj foglalas szobaejszaka", label: "Új foglalás szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "cancellations", match: "lemondas (noshow nelkul)", label: "Lemondás szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "noshow", match: "noshow szobaejszaka", label: "No-show szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "occ_sum", no: 10, match: "foglaltsag % (sum)", label: "Foglaltság % (összes szobára)", group: "Szobakapacitás és foglaltság", kind: "pct" },
  { key: "occ_ooo", no: 11, match: "foglaltsag % (ooo)", label: "Foglaltság % (kiadhatóra)", group: "Szobakapacitás és foglaltság", kind: "pct" },
  { key: "single_sold", no: 12, match: "kiadott egyagyas szobaejszaka", label: "Kiadott egyágyas szobaéj", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "single_share", no: 13, match: "egyagyas szobaejszakak megoszlasa", label: "Egyágyas megoszlás %", group: "Szobakapacitás és foglaltság", kind: "pct" },
  { key: "multi_sold", no: 14, match: "kiadott tobbagyas szobaejszaka", label: "Kiadott többágyas szobaéj", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "multi_share", no: 15, match: "tobbagyas szobaejszakak megoszlasa", label: "Többágyas megoszlás %", group: "Szobakapacitás és foglaltság", kind: "pct" },
  { key: "walkin", no: 18, match: "walk-in szobaejszaka", label: "Walk-in szobaéjszaka", group: "Szobakapacitás és foglaltság", kind: "count" },
  { key: "dayuse", no: 19, match: "day use", label: "Day use szobák", group: "Szobakapacitás és foglaltság", kind: "count" },
  // ── Nettó forgalom ──
  { key: "rev_accommodation", no: 20, match: "fo/szallas netto forgalom", label: "Szállás nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_ifa", no: 21, match: "fo/ifa forgalom", label: "IFA forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_fb_fo", no: 22, match: "fo/vendeglatas netto forgalom", label: "FO vendéglátás nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_event", no: 23, match: "fo/rendezveny netto forgalom", label: "Rendezvény nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_spa_treat", no: 24, match: "fo/gyogyaszat netto forgalom", label: "Gyógyászat (FO) nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_bath", no: 25, match: "fo/furdo netto forgalom", label: "Fürdő nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_other", no: 26, match: "fo/egyeb netto forgalom", label: "Egyéb nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_advance", no: 29, match: "netto eloleg forgalom", label: "Nettó előleg forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_fo_total", no: 30, match: "front office netto forgalom", label: "Front Office nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_fb", no: 31, match: "vendeglatas netto forgalom", label: "Vendéglátás nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_medical", no: 32, match: "gyogyaszat netto forgalom", label: "Gyógyászat nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_total", no: 34, match: "osszes netto forgalom", label: "Összes nettó forgalom", group: "Nettó forgalom", kind: "money" },
  { key: "rev_fb_combined", no: 35, match: "osszevont vendeglatas", label: "Összevont vendéglátás nettó", group: "Nettó forgalom", kind: "money" },
  { key: "rev_medical_combined", no: 36, match: "osszevont gyogyaszat", label: "Összevont gyógyászat nettó", group: "Nettó forgalom", kind: "money" },
  // ── Bruttó számlaforgalom és fizetési módok ──
  { key: "gross_fo", no: 40, match: "front office brutto szamlaforgalom", label: "Front Office bruttó számlaforgalom", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "gross_fb", no: 41, match: "vendeglatas brutto szamlaforgalom", label: "Vendéglátás bruttó számlaforgalom", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "gross_medical", no: 42, match: "gyogyaszat brutto szamlaforgalom", label: "Gyógyászat bruttó számlaforgalom", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "gross_total", no: 44, match: "osszesen brutto szamlaforgalom", label: "Összes bruttó számlaforgalom", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "pay_cash", no: 45, match: "keszpenz", label: "— Készpénz", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "pay_card", no: 46, match: "keszpenz-helyettesito", label: "— Kártya / készpénz-helyettesítő", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "pay_transfer", no: 47, match: "atutalas", label: "— Átutalás", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  { key: "pay_other", no: 48, match: "egyeb", label: "— Egyéb fizetési mód", group: "Bruttó számlaforgalom és fizetési módok", kind: "money" },
  // ── Fajlagos mutatók ──
  { key: "ref_rev", no: 50, match: "netto referencia forgalom", label: "Nettó referencia forgalom", group: "Fajlagos mutatók", kind: "money" },
  { key: "ref_per_sold", no: 51, match: "szobaejszakara juto netto referencia", label: "Ref. forgalom / kiadott szobaéj", group: "Fajlagos mutatók", kind: "money" },
  { key: "ref_revpar", no: 52, match: "referencia revpar", label: "Referencia RevPAR", group: "Fajlagos mutatók", kind: "money" },
  { key: "trevpar", no: 53, match: "trevpar", label: "TRevPAR", group: "Fajlagos mutatók", kind: "money" },
  { key: "ref_per_guest", no: 54, match: "vendegejszakara juto netto referencia", label: "Ref. forgalom / vendégéj", group: "Fajlagos mutatók", kind: "money" },
  { key: "rate_rev", no: 55, match: "netto arkod forgalom", label: "Nettó árkód forgalom", group: "Fajlagos mutatók", kind: "money" },
  { key: "rate_adr", no: 56, match: "netto arkod atlagar", label: "Nettó árkód átlagár (ADR)", group: "Fajlagos mutatók", kind: "money" },
  { key: "rate_revpar", no: 57, match: "netto arkod revpar", label: "Nettó árkód RevPAR", group: "Fajlagos mutatók", kind: "money" },
  { key: "acc_rev", no: 60, match: "netto szallas forgalom", label: "Nettó szállás forgalom", group: "Fajlagos mutatók", kind: "money" },
  { key: "acc_adr", no: 61, match: "netto szallas atlagar", label: "Nettó szállás átlagár", group: "Fajlagos mutatók", kind: "money" },
  { key: "acc_revpar", no: 62, match: "netto szallas revpar", label: "Nettó szállás RevPAR", group: "Fajlagos mutatók", kind: "money" },
  { key: "bf_rev", no: 65, match: "netto reggeli forgalom", label: "Nettó reggeli forgalom", group: "Fajlagos mutatók", kind: "money" },
  { key: "bf_adr", no: 66, match: "netto reggeli atlagar", label: "Nettó reggeli átlagár", group: "Fajlagos mutatók", kind: "money" },
  { key: "szr_rev", no: 70, match: "netto sz+r forgalom", label: "Nettó szállás+reggeli forgalom", group: "Fajlagos mutatók", kind: "money" },
  { key: "szr_adr", no: 71, match: "netto sz+r atlagar", label: "Nettó szállás+reggeli átlagár", group: "Fajlagos mutatók", kind: "money" },
  { key: "szr_revpar", no: 72, match: "netto sz+r revpar", label: "Nettó szállás+reggeli RevPAR", group: "Fajlagos mutatók", kind: "money" },
];

export const managerDefByKey = new Map(MANAGER_CATALOG.map((d) => [d.key, d]));
export const managerDefByNo = new Map(MANAGER_CATALOG.filter((d) => d.no != null).map((d) => [d.no!, d]));
