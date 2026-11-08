"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, type Timestamp } from "firebase/firestore";
import { RefreshCw, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { roleLabel } from "@/lib/activity";
import type { UserProfile } from "@/lib/types";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { FilterTabs, Spinner } from "./ui";

const ONLINE_MS = 5 * 60_000;
const ACTIVE_MS = 7 * 86_400_000;

type Status = "online" | "active" | "inactive" | "suspended";
type Filter = "lahat" | Status | "unverified";

interface Member {
  id: string;
  profile: UserProfile;
  lastSeen: number; // 0 = never seen since the online tracker started
  status: Status;
  verified: boolean;
  staff: boolean;
}

const STATUS_STYLE: Record<Status, { label: string; dot: string; text: string }> = {
  online: { label: "Online", dot: "bg-emerald-500", text: "text-emerald-700" },
  active: { label: "Active", dot: "bg-blue-500", text: "text-blue-700" },
  inactive: { label: "Inactive", dot: "bg-gray-300", text: "text-gray-500" },
  suspended: { label: "Suspended", dot: "bg-red-500", text: "text-red-700" },
};

function lastSeenText(ms: number, now: number): string {
  if (!ms) return "Hindi pa nakikita";
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return "Ngayon lang";
  if (min < 60) return `${min} min ang nakaraan`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} oras ang nakaraan`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} araw ang nakaraan`;
  return new Date(ms).toLocaleDateString("fil-PH", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Super Admin only: every member with their status.
 * Online = seen in the last 5 minutes, Active = last 7 days, Inactive = longer / never,
 * Suspended overrides the rest. "Last seen" comes from presenceUsers (written while logged in).
 */
export function MembersList({ initialFilter = "lahat" }: { initialFilter?: Filter }) {
  const verified = useVerifiedSet();
  const [raw, setRaw] = useState<{ users: (UserProfile & { id: string })[]; seen: Map<string, number> } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [usersSnap, seenSnap] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "presenceUsers"))]);
      const seen = new Map(seenSnap.docs.map((d) => [d.id, (d.data().lastSeen as Timestamp | undefined)?.toMillis() ?? 0]));
      setRaw({ users: usersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as UserProfile) })), seen });
      setNow(Date.now());
    } catch (err) {
      console.warn("[members] load failed:", err);
      setError("Hindi ma-load ang mga miyembro. Subukan ulit.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const members = useMemo<Member[]>(() => {
    if (!raw) return [];
    return raw.users.map((u) => {
      const lastSeen = raw.seen.get(u.id) ?? 0;
      const staff = u.role === "admin" || u.role === "superadmin";
      const status: Status = u.suspended ? "suspended" : lastSeen && now - lastSeen <= ONLINE_MS ? "online" : lastSeen && now - lastSeen <= ACTIVE_MS ? "active" : "inactive";
      return { id: u.id, profile: u, lastSeen, status, verified: staff || verified.has(u.id), staff };
    });
  }, [raw, verified, now]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { lahat: members.length, online: 0, active: 0, inactive: 0, suspended: 0, unverified: 0 };
    for (const m of members) {
      c[m.status] += 1;
      if (!m.verified) c.unverified += 1;
    }
    return c;
  }, [members]);

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    const order: Record<Status, number> = { online: 0, active: 1, suspended: 2, inactive: 3 };
    return members
      .filter((m) => (filter === "lahat" ? true : filter === "unverified" ? !m.verified : m.status === filter))
      .filter((m) => !t || `${m.profile.fullName} ${m.profile.purok ?? ""} ${m.profile.email ?? ""}`.toLowerCase().includes(t))
      .sort((a, b) => order[a.status] - order[b.status] || b.lastSeen - a.lastSeen || a.profile.fullName.localeCompare(b.profile.fullName));
  }, [members, filter, search]);

  if (!raw && !error) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {(["online", "active", "inactive", "suspended"] as Status[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-xl p-2 ${filter === s ? "bg-brand-light ring-1 ring-brand" : "bg-gray-50"}`}>
            <p className={`text-lg font-extrabold tabular-nums ${STATUS_STYLE[s].text}`}>{counts[s]}</p>
            <p className="flex items-center justify-center gap-1 text-[0.68rem] font-semibold text-gray-600">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLE[s].dot}`} aria-hidden />
              {STATUS_STYLE[s].label}
            </p>
          </button>
        ))}
      </div>

      <FilterTabs
        label="Filter ng miyembro"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "lahat", label: "Lahat", count: counts.lahat, tone: "neutral" },
          { value: "online", label: "Online", count: counts.online, tone: "neutral" },
          { value: "active", label: "Active", count: counts.active, tone: "neutral" },
          { value: "inactive", label: "Inactive", count: counts.inactive, tone: "neutral" },
          { value: "suspended", label: "Suspended", count: counts.suspended },
          { value: "unverified", label: "Hindi verified", count: counts.unverified, tone: "neutral" },
        ]}
      />

      <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin ang pangalan, purok o email..." aria-label="Hanapin ang miyembro" className="w-full bg-transparent py-2.5 outline-none" />
      </label>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Walang miyembro dito.</p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
          {list.map((m) => {
            const st = STATUS_STYLE[m.status];
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="relative shrink-0">
                  <Avatar
                    name={m.profile.fullName}
                    photo={m.staff ? m.profile.photoURL : undefined}
                    size="h-9 w-9"
                    textClass="text-xs"
                    fallbackClass={m.staff ? "bg-brand text-gold" : "bg-brand-light text-brand"}
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${st.dot}`} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {m.profile.fullName} <VerifiedBadge show={m.verified && !m.staff} />
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {roleLabel(m.profile.role, m.profile.position)}
                    {m.profile.purok ? ` · ${m.profile.purok}` : ""}
                    {!m.verified ? " · hindi verified" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-[0.72rem] font-bold ${st.text}`}>{st.label}</p>
                  <p className="text-[0.65rem] text-gray-500">{m.status === "online" ? "Ngayon" : lastSeenText(m.lastSeen, now)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <button onClick={load} disabled={busy} className="flex items-center gap-1.5 text-sm font-semibold text-brand disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> I-refresh
        </button>
        <Link href="/admin/#users" className="text-sm font-semibold text-brand">Pamahalaan sa Users at Roles →</Link>
      </div>
      <p className="text-[0.7rem] text-gray-400">
        Online = bukas ang website ngayon. Active = nag-login sa nakaraang 7 araw. Inactive = mas matagal o hindi pa nakikita mula nang idagdag ang feature na ito.
      </p>
    </div>
  );
}
