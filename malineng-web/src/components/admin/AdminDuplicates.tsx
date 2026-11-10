"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { CheckCircle2, RefreshCw, Smartphone, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity, roleLabel } from "@/lib/activity";
import { formatDate, friendlyError } from "@/lib/format";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { Badge, Button, EmptyState, FilterTabs, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { UserDetail, type UserRow } from "./AdminUsers";

type Kind = "phone" | "nameBirthday" | "device" | "name";
type Strength = "malakas" | "katamtaman" | "mahina";

interface Group {
  key: string;
  kind: Kind;
  strength: Strength;
  reason: string;
  members: UserRow[];
}

const KIND_LABEL: Record<Kind, string> = {
  phone: "Parehong contact number",
  nameBirthday: "Parehong pangalan at birthday",
  device: "Iisang phone ang ginamit",
  name: "Halos parehong pangalan",
};
const STRENGTH: Record<Kind, Strength> = { phone: "malakas", nameBirthday: "malakas", device: "katamtaman", name: "mahina" };
const STRENGTH_BADGE: Record<Strength, "red" | "gold" | "gray"> = { malakas: "red", katamtaman: "gold", mahina: "gray" };

/** "Ma. Dela Cruz-Santos" → "maria delacruzsantos": ignores dots, dashes, spaces and common abbreviations. */
function looseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bma\.?\s/g, "maria ")
    .replace(/\bsto\.?\s/g, "santo ")
    .replace(/\bsta\.?\s/g, "santa ")
    .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, "")
    .replace(/[^a-zñ ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .replace(/\s(de|dela|del|delos|san)\s/g, " $1")
    .trim();
}

/** Builds every suspicious group; a pair already caught by a stronger signal is not repeated weaker. */
function buildGroups(users: UserRow[], devices: Map<string, string[]>): Group[] {
  const out: Group[] = [];
  const strongPairs = new Set<string>();
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");

  const add = (kind: Kind, value: string, members: UserRow[]) => {
    const uniq = [...new Map(members.map((m) => [m.id, m])).values()];
    if (uniq.length < 2) return;
    if (kind === "name") {
      // Skip weak name matches already explained by a strong signal.
      const allCovered = uniq.every((a) => uniq.every((b) => a.id === b.id || strongPairs.has(pairKey(a.id, b.id))));
      if (allCovered) return;
    }
    if (STRENGTH[kind] === "malakas") for (const a of uniq) for (const b of uniq) if (a.id !== b.id) strongPairs.add(pairKey(a.id, b.id));
    const ids = uniq.map((m) => m.id).sort();
    out.push({ key: `${kind}_${ids.join("_")}`.slice(0, 1400), kind, strength: STRENGTH[kind], reason: value, members: uniq });
  };

  const groupBy = (keyOf: (u: UserRow) => string) => {
    const m = new Map<string, UserRow[]>();
    for (const u of users) {
      const k = keyOf(u);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), u]);
    }
    return m;
  };

  for (const [phone, list] of groupBy((u) => normalizePhone(u.contact ?? ""))) add("phone", maskPhone(phone), list);
  for (const [k, list] of groupBy((u) => (u.birthday ? `${looseName(u.fullName)}#${u.birthday}` : ""))) add("nameBirthday", `${list[0].fullName} · ${formatDate(k.split("#")[1])}`, list);

  const byId = new Map(users.map((u) => [u.id, u]));
  const byDevice = new Map<string, UserRow[]>();
  for (const [uid, ids] of devices) {
    const u = byId.get(uid);
    if (!u) continue;
    for (const d of ids) byDevice.set(d, [...(byDevice.get(d) ?? []), u]);
  }
  for (const [, list] of byDevice) add("device", `${list.length} account sa iisang phone`, list);

  for (const [, list] of groupBy((u) => looseName(u.fullName))) add("name", list[0].fullName, list);

  const order: Record<Strength, number> = { malakas: 0, katamtaman: 1, mahina: 2 };
  return out.sort((a, b) => order[a.strength] - order[b.strength] || b.members.length - a.members.length);
}

function MemberRow({ u, selfie, verified, onOpen }: { u: UserRow; selfie?: string; verified: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-2 text-left active:bg-gray-50">
      {selfie ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selfie} alt={`Selfie ni ${u.fullName}`} className="h-14 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400" title="Walang selfie">
          <UserRound className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{u.fullName}</p>
        <p className="truncate text-xs text-gray-500">
          {[u.purok, u.birthday ? formatDate(u.birthday) : "", u.contact ? maskPhone(u.contact) : ""].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="truncate text-[0.7rem] text-gray-400">
          {roleLabel(u.role, u.position)} · nag-register {u.createdAt ? (u.createdAt as Timestamp).toDate().toLocaleDateString("fil-PH") : "—"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {u.suspended ? <Badge color="red">Suspended</Badge> : verified ? <Badge color="blue">✓ Verified</Badge> : <Badge color="gray">Di verified</Badge>}
      </div>
    </button>
  );
}

/** Super Admin: groups of accounts that may belong to one person, with selfies side by side. */
export function AdminDuplicates() {
  const { user } = useAuth();
  const toast = useToast();
  const verified = useVerifiedSet();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [devices, setDevices] = useState<Map<string, string[]>>(new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selfies, setSelfies] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"suriin" | "ok">("suriin");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [u, p, d] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "presenceUsers")), getDocs(collection(db, "duplicateDismissed"))]);
      setUsers(u.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<UserRow, "id">) })));
      setDevices(new Map(p.docs.map((x) => [x.id, ((x.data().devices as string[] | undefined) ?? []).filter(Boolean)])));
      setDismissed(new Set(d.docs.map((x) => x.id)));
    } catch (err) {
      console.warn("[duplicates] load failed:", err);
      setError("Hindi ma-load. Subukan ulit.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => (users ? buildGroups(users, devices) : []), [users, devices]);
  const open = groups.filter((g) => !dismissed.has(g.key));
  const ok = groups.filter((g) => dismissed.has(g.key));
  const list = tab === "suriin" ? open : ok;

  // Load selfies only for accounts that appear in a group (one read each, cached).
  useEffect(() => {
    const need = [...new Set(list.flatMap((g) => g.members.map((m) => m.id)))].filter((id) => !(id in selfies));
    if (need.length === 0) return;
    let alive = true;
    Promise.all(need.map(async (id) => [id, ((await getDoc(doc(db, "verifications", id)).catch(() => null))?.data()?.selfie as string | undefined) ?? ""] as const)).then(
      (pairs) => alive && setSelfies((s) => ({ ...s, ...Object.fromEntries(pairs) })),
    );
    return () => {
      alive = false;
    };
  }, [list, selfies]);

  const markOk = async (g: Group, value: boolean) => {
    try {
      if (value) await setDoc(doc(db, "duplicateDismissed", g.key), { by: user?.uid ?? "", at: serverTimestamp(), names: g.members.map((m) => m.fullName).join(", ").slice(0, 500) });
      else await deleteDoc(doc(db, "duplicateDismissed", g.key));
      setDismissed((s) => {
        const n = new Set(s);
        if (value) n.add(g.key);
        else n.delete(g.key);
        return n;
      });
      logActivity("Roles", `${value ? "Minarkahang hindi doble" : "Ibinalik sa sinusuri"}: ${g.members.map((m) => m.fullName).join(", ")}`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const openUser = users?.find((u) => u.id === openId) ?? null;

  if (!users && !error) return <Spinner />;

  return (
    <div>
      <p className="mb-3 rounded-2xl bg-brand-light p-3 text-[0.82rem] text-brand-deep">
        Hindi na pwedeng gamitin ang <b>iisang contact number</b> sa dalawang account. Dito lalabas ang mga dati nang doble at iba pang kahina-hinala. Pindutin ang account para i-suspend o burahin.
      </p>
      <FilterTabs
        label="Posibleng doble"
        value={tab}
        onChange={setTab}
        options={[
          { value: "suriin", label: "Susuriin", count: open.length },
          { value: "ok", label: "Hindi doble", count: ok.length, tone: "neutral" },
        ]}
      />
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {list.length === 0 ? (
        <EmptyState icon={<CheckCircle2 />} title={tab === "suriin" ? "Walang nakitang posibleng doble 🎉" : "Wala pang minarkahang hindi doble"} />
      ) : (
        <div className="space-y-3">
          {list.map((g) => (
            <div key={g.key} className="space-y-2 rounded-2xl bg-white p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    {g.kind === "device" && <Smartphone className="h-4 w-4 text-gray-500" aria-hidden />}
                    {KIND_LABEL[g.kind]}
                  </p>
                  <p className="truncate text-xs text-gray-500">{g.reason}</p>
                </div>
                <Badge color={STRENGTH_BADGE[g.strength]}>{g.strength}</Badge>
              </div>
              <div className="space-y-1.5">
                {g.members.map((m) => (
                  <MemberRow key={m.id} u={m} selfie={selfies[m.id]} verified={verified.has(m.id) || m.role !== "resident"} onOpen={() => setOpenId(m.id)} />
                ))}
              </div>
              {g.kind === "device" && <p className="text-[0.7rem] text-gray-500">Pwedeng pamilyang naghihiraman ng phone. Tingnan ang selfie bago magdesisyon.</p>}
              {tab === "suriin" ? (
                <Button variant="outline" full onClick={() => markOk(g, true)}>
                  <CheckCircle2 className="h-4 w-4" /> Hindi doble (magkaibang tao)
                </Button>
              ) : (
                <button onClick={() => markOk(g, false)} className="w-full text-center text-xs font-semibold text-brand">Ibalik sa Susuriin</button>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={load} disabled={busy} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> I-refresh
      </button>

      <Modal
        open={!!openUser}
        onClose={() => {
          setOpenId(null);
          void load(); // reflect a suspension or deletion right away
        }}
        title="Account"
      >
        {openUser && <UserDetail key={openUser.id} u={openUser} verified={verified.has(openUser.id)} onClose={() => { setOpenId(null); void load(); }} />}
      </Modal>
    </div>
  );
}
