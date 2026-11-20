import { collection, doc, getCountFromServer, getDoc, getDocs, limit, query, where, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import { childSummary, type Child } from "./kalusugan";
import type { Txn } from "./transactions";

/**
 * Numbers for the executive tabs (Kalusugan, Proyekto, Ayuda, Buod).
 * Every loader reads only what its tab needs, prefers count queries, and remembers the answer for two minutes,
 * so the free daily reads of the Spark plan are not wasted.
 */

const TTL = 2 * 60_000;
const memo = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, force: boolean, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  return value;
}

const DAY = 86_400_000;
const count = async (q: ReturnType<typeof query> | ReturnType<typeof collection>): Promise<number> => (await getCountFromServer(q)).data().count;

/* ---------------- Kalusugan at emergency ---------------- */

export interface HealthData {
  ambulance: {
    trips: number;
    emergency: number;
    scheduled: number;
    /** Average minutes from request to "papunta na"; null when no trip had both times. */
    avgRespMin: number | null;
    waiting: number;
    reasons: { reason: string; count: number }[];
  };
  botika: {
    given: number;
    low: { name: string; stock: number; min: number }[];
    expiring: { name: string; expiry: string; days: number }[];
  };
  vaccine: { children: number; completePct: number | null; childrenDelayed: number };
  pregnancy: { active: number; checkupSoon: number };
  sectors: { senior: number; pwd: number; solo: number };
}

export async function loadHealth(txns: Txn[], force = false): Promise<HealthData> {
  const amb = txns.filter((t) => t.service === "Ambulansya");
  const resp = amb.map((t) => t.meta?.respMin).filter((n): n is number => typeof n === "number");
  const reasons = new Map<string, number>();
  amb.forEach((t) => t.meta?.reason && reasons.set(t.meta.reason, (reasons.get(t.meta.reason) ?? 0) + 1));

  const body = await cached("health", force, async () => {
    const [meds, kids, preg, senior, pwd, solo] = await Promise.all([
      getDocs(collection(db, "medicines")),
      getDocs(query(collection(db, "children"), limit(2000))),
      getDocs(query(collection(db, "pregnancies"), where("status", "==", "active"))),
      count(query(collection(db, "sectorMembers"), where("sectors", "array-contains", "Senior"))),
      count(query(collection(db, "sectorMembers"), where("sectors", "array-contains", "PWD"))),
      count(query(collection(db, "sectorMembers"), where("sectors", "array-contains", "Solo Parent"))),
    ]);
    const now = Date.now();
    const low: HealthData["botika"]["low"] = [];
    const expiring: HealthData["botika"]["expiring"] = [];
    meds.docs.forEach((d) => {
      const m = d.data();
      const stock = Number(m.stock ?? 0);
      const min = Number(m.minStock ?? 0);
      if (stock <= min) low.push({ name: String(m.name ?? ""), stock, min });
      const exp = String(m.expiry ?? "");
      if (exp) {
        const days = Math.floor((new Date(`${exp}T00:00:00`).getTime() - now) / DAY);
        if (days <= 30 && stock > 0) expiring.push({ name: String(m.name ?? ""), expiry: exp, days });
      }
    });
    low.sort((a, b) => a.stock - b.stock);
    expiring.sort((a, b) => a.days - b.days);

    // Share of babies whose every dose that is already due has been given.
    let upToDate = 0;
    let delayed = 0;
    kids.docs.forEach((d) => {
      const sum = childSummary({ id: d.id, ...d.data() } as Child);
      if (sum.overdue.length === 0) upToDate += 1;
      else delayed += 1;
    });
    const soon = preg.docs.filter((d) => {
      const next = String(d.data().nextCheckup ?? "");
      if (!next) return false;
      const t = new Date(`${next}T00:00:00`).getTime();
      return t >= now - DAY && t <= now + 7 * DAY;
    }).length;

    return {
      low,
      expiring,
      children: kids.size,
      upToDate,
      delayed,
      pregActive: preg.size,
      pregSoon: soon,
      senior,
      pwd,
      solo,
    };
  });

  return {
    ambulance: {
      trips: amb.length,
      emergency: amb.filter((t) => t.meta?.kind === "emergency").length,
      scheduled: amb.filter((t) => t.meta?.kind === "schedule").length,
      avgRespMin: resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null,
      waiting: amb.filter((t) => t.status === "pending").length,
      reasons: [...reasons.entries()].map(([reason, c]) => ({ reason, count: c })).sort((a, b) => b.count - a.count).slice(0, 3),
    },
    botika: { given: txns.filter((t) => t.service === "Botika").length, low: body.low, expiring: body.expiring },
    vaccine: { children: body.children, completePct: body.children ? Math.round((body.upToDate / body.children) * 100) : null, childrenDelayed: body.delayed },
    pregnancy: { active: body.pregActive, checkupSoon: body.pregSoon },
    sectors: { senior: body.senior, pwd: body.pwd, solo: body.solo },
  };
}

/* ---------------- Proyekto at pondo ---------------- */

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
  progress: number;
  budget: number;
  targetDate: string;
}

export interface ProjectData {
  total: number;
  planned: number;
  ongoing: number;
  completed: number;
  delayed: number;
  /** Delayed first, then ongoing by biggest budget. */
  top: ProjectRow[];
  year: number;
  budget: { total: number; spent: number } | null;
  spendByCategory: { name: string; amount: number }[];
}

export async function loadProjects(force = false): Promise<ProjectData> {
  return cached("projects", force, async () => {
    const year = new Date().getFullYear();
    const [proj, bud, exp] = await Promise.all([
      getDocs(collection(db, "projects")),
      getDoc(doc(db, "budgets", String(year))),
      getDocs(query(collection(db, "expenses"), where("year", "==", year), limit(2000))),
    ]);
    const rows: ProjectRow[] = proj.docs.map((d) => {
      const p = d.data() as DocumentData;
      return { id: d.id, name: String(p.name ?? ""), status: String(p.status ?? "planned"), progress: Number(p.progress ?? 0), budget: Number(p.budget ?? 0), targetDate: String(p.targetDate ?? "") };
    });
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    const spend = new Map<string, number>();
    let spent = 0;
    exp.docs.forEach((d) => {
      const e = d.data();
      const amt = Number(e.amount ?? 0);
      spent += amt;
      spend.set(String(e.category ?? "Iba pa"), (spend.get(String(e.category ?? "Iba pa")) ?? 0) + amt);
    });
    const order = (r: ProjectRow) => (r.status === "delayed" ? 0 : r.status === "ongoing" ? 1 : r.status === "planned" ? 2 : 3);
    return {
      total: rows.length,
      planned: by("planned"),
      ongoing: by("ongoing"),
      completed: by("completed"),
      delayed: by("delayed"),
      top: [...rows].sort((a, b) => order(a) - order(b) || b.budget - a.budget).slice(0, 4),
      year,
      budget: bud.exists() ? { total: Number(bud.data().total ?? 0), spent } : null,
      spendByCategory: [...spend.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
    };
  });
}

/* ---------------- Ayuda at residente ---------------- */

export interface AyudaData {
  qualified: number;
  scheduled: number;
  claimed: number;
  /** Share of everyone qualified (any step) who already claimed. */
  claimedPct: number | null;
  batches: number;
  residents: { total: number; verified: number; households: number };
  /** Accounts per purok (the ones that chose a purok). */
  puroks: { purok: string; members: number }[];
  complaints: { open: number; closed: number };
}

export async function loadAyuda(puroks: string[], force = false): Promise<AyudaData> {
  return cached(`ayuda:${puroks.join("|")}`, force, async () => {
    const [q, s, c, batches, users, verified, households, perPurok, open, closed] = await Promise.all([
      count(query(collection(db, "ayuda"), where("status", "==", "qualified"))),
      count(query(collection(db, "ayuda"), where("status", "==", "scheduled"))),
      count(query(collection(db, "ayuda"), where("status", "==", "claimed"))),
      count(collection(db, "ayudaBatches")),
      count(collection(db, "users")),
      count(collection(db, "verifiedUsers")),
      count(collection(db, "households")),
      Promise.all(puroks.map(async (purok) => ({ purok, members: await count(query(collection(db, "users"), where("purok", "==", purok))) }))),
      count(query(collection(db, "blotters"), where("status", "in", ["natanggap", "ipinatawag"]))),
      count(query(collection(db, "blotters"), where("status", "in", ["naayos", "isinara"]))),
    ]);
    const all = q + s + c;
    return { qualified: q, scheduled: s, claimed: c, claimedPct: all ? Math.round((c / all) * 100) : null, batches, residents: { total: users, verified, households }, puroks: perPurok, complaints: { open, closed } };
  });
}

/* ---------------- Scorecard (Buod) ---------------- */

/** g = maayos, y = bantayan, r = kritikal, n = walang datos. */
export type Rag = "g" | "y" | "r" | "n";
export const RAG_WORD: Record<Rag, string> = { g: "Maayos", y: "Bantayan", r: "Kritikal", n: "Walang datos" };

export interface ScoreItem {
  key: "kalusugan" | "emergency" | "proyekto" | "ayuda" | "pondo" | "reklamo";
  label: string;
  value: string;
  note: string;
  rag: Rag;
  /** How full the gauge ring is (0 to 1); how good the number is, not always a percent. */
  fill: number;
}

export interface AttentionItem {
  key: string;
  title: string;
  detail: string;
  /** Executive tab where it is explained. */
  tab: "kalusugan" | "proyekto" | "ayuda" | "transaksyon";
  tone: "r" | "y";
}

export interface Scorecard {
  items: ScoreItem[];
  attention: AttentionItem[];
}

/** The thresholds are written here once, and shown to the Kapitan under the scorecard. */
export const RAG_RULES: string[] = [
  "Kalusugan: bakunadong sanggol, 85% pataas ay maayos, 70% pataas ay bantayan.",
  "Emergency: sagot ng ambulansya, 5 minuto pababa ay maayos, 10 pababa ay bantayan.",
  "Proyekto: walang naantala ay maayos, 1 ay bantayan, 2 pataas ay kritikal.",
  "Ayuda: nakuha na ng qualified, 70% pataas ay maayos, 40% pataas ay bantayan.",
  "Pondo: nagamit na badyet kumpara sa lumipas na bahagi ng taon; lampas ng 10 puntos ay bantayan, lampas ng 25 ay kritikal.",
  "Reklamo: bukas pa, 5 pababa ay maayos, 10 pababa ay bantayan.",
];

export function buildScorecard(health: HealthData | null, projects: ProjectData | null, ayuda: AyudaData | null, txns: Txn[], now = new Date()): Scorecard {
  const items: ScoreItem[] = [];
  const attention: AttentionItem[] = [];

  // Kalusugan
  const vp = health?.vaccine.completePct ?? null;
  items.push({ key: "kalusugan", label: "Kalusugan", value: vp === null ? "—" : `${vp}%`, note: "Bakunadong sanggol", rag: vp === null ? "n" : vp >= 85 ? "g" : vp >= 70 ? "y" : "r", fill: (vp ?? 0) / 100 });
  if (health && health.vaccine.childrenDelayed > 0) attention.push({ key: "vax", title: `${health.vaccine.childrenDelayed} sanggol na delayed sa bakuna`, detail: "Buksan ang Kalusugan para sa detalye", tab: "kalusugan", tone: "y" });
  if (health && health.botika.low.length > 0) attention.push({ key: "low", title: `${health.botika.low.length} gamot na paubos na`, detail: health.botika.low.slice(0, 3).map((m) => m.name).join(" · "), tab: "kalusugan", tone: "y" });
  if (health && health.botika.expiring.length > 0) attention.push({ key: "exp", title: `${health.botika.expiring.length} gamot na malapit mag-expire`, detail: health.botika.expiring.slice(0, 3).map((m) => m.name).join(" · "), tab: "kalusugan", tone: "y" });

  // Emergency
  const resp = health?.ambulance.avgRespMin ?? null;
  items.push({ key: "emergency", label: "Emergency", value: resp === null ? "—" : `${resp} min`, note: "Karaniwang sagot ng ambulansya", rag: resp === null ? "n" : resp <= 5 ? "g" : resp <= 10 ? "y" : "r", fill: resp === null ? 0 : Math.max(0.08, 1 - resp / 12) });
  const waitingAmb = txns.filter((t) => t.service === "Ambulansya" && t.status === "pending" && t.statusLabel === "Naghihintay");
  if (waitingAmb.length > 0) attention.unshift({ key: "amb", title: `${waitingAmb.length} ambulansya na naghihintay`, detail: waitingAmb.slice(0, 2).map((t) => `${t.name} · ${t.meta?.reason || t.detail}`).join(" | "), tab: "kalusugan", tone: "r" });

  // Proyekto
  const delayed = projects?.delayed ?? 0;
  items.push({ key: "proyekto", label: "Proyekto", value: projects ? `${delayed} / ${projects.total}` : "—", note: "Naantalang proyekto", rag: !projects || projects.total === 0 ? "n" : delayed === 0 ? "g" : delayed === 1 ? "y" : "r", fill: projects && projects.total > 0 ? 1 - delayed / projects.total : 0 });
  if (projects && delayed > 0) attention.unshift({ key: "proj", title: `${delayed} proyektong naantala`, detail: projects.top.filter((p) => p.status === "delayed").map((p) => p.name).join(" · "), tab: "proyekto", tone: "r" });

  // Ayuda
  const ap = ayuda?.claimedPct ?? null;
  items.push({ key: "ayuda", label: "Ayuda", value: ap === null ? "—" : `${ap}%`, note: "Nakuha na ng qualified", rag: ap === null ? "n" : ap >= 70 ? "g" : ap >= 40 ? "y" : "r", fill: (ap ?? 0) / 100 });
  if (ayuda && ayuda.qualified + ayuda.scheduled > 0) attention.push({ key: "ayuda", title: `${ayuda.qualified + ayuda.scheduled} qualified na hindi pa nakukuha ang ayuda`, detail: `${ayuda.scheduled} naka-schedule na`, tab: "ayuda", tone: "y" });

  // Pondo: used share against how much of the year has passed.
  const b = projects?.budget;
  if (b && b.total > 0) {
    const used = Math.round((b.spent / b.total) * 100);
    const start = new Date(now.getFullYear(), 0, 1).getTime();
    const elapsed = Math.round(((now.getTime() - start) / (365 * DAY)) * 100);
    const over = used - elapsed;
    items.push({ key: "pondo", label: "Pondo", value: `${used}%`, note: "Nagamit sa taunang badyet", rag: over <= 10 ? "g" : over <= 25 ? "y" : "r", fill: Math.min(1, used / 100) });
  } else items.push({ key: "pondo", label: "Pondo", value: "—", note: "Wala pang badyet na naka-encode", rag: "n", fill: 0 });

  // Reklamo
  // All complaints still open (not only those of this period); falls back to this period while the numbers load.
  const open = ayuda?.complaints.open ?? txns.filter((t) => t.service === "Reklamo" && t.status === "pending").length;
  items.push({ key: "reklamo", label: "Reklamo", value: String(open), note: "Bukas pa", rag: open <= 5 ? "g" : open <= 10 ? "y" : "r", fill: Math.min(1, open / 10) });

  return { items, attention };
}

