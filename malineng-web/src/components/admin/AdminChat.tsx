"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { MessageCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useSettings } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError, timeAgo } from "@/lib/format";
import { CHAT_DAYS, MUTE_OPTIONS, ROOM_ALL, cutoffTimestamp, roomTitle } from "@/lib/chat";
import { Button, Card, EmptyState, ErrorText, FilterTabs, Spinner } from "@/components/ui";
import type { Timestamp as Ts } from "firebase/firestore";

interface Report {
  id: string;
  room: string;
  messageId: string;
  messageText: string;
  messageAuthorId: string;
  messageAuthorName: string;
  reporterId: string;
  reason: string;
  status: "open" | "removed" | "dismissed";
  createdAt?: Ts;
}
interface Mute {
  id: string;
  name: string;
  reason: string;
  until: Ts;
}

type Tab = "reports" | "mutes" | "settings";
const reportsQ = query(collection(db, "chatReports"), where("status", "==", "open"));
const mutesQ = query(collection(db, "chatMutes"));

/** Officers: handle reports, mutes, and the chat on/off switch (Super Admin). */
export function AdminChat() {
  const { user, isSuperAdmin } = useAuth();
  const { settings } = useSettings();
  const reports = useCollection<Report>(reportsQ);
  const mutes = useCollection<Mute>(mutesQ);
  const [tab, setTab] = useState<Tab>("reports");
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState({ enabled: true, photos: true });
  const [pruned, setPruned] = useState(0);

  // Open reports grouped by message, most reported first.
  const grouped = useMemo(() => {
    const map = new Map<string, Report[]>();
    reports.data.forEach((r) => map.set(`${r.room}/${r.messageId}`, [...(map.get(`${r.room}/${r.messageId}`) ?? []), r]));
    return [...map.values()].sort((a, b) => b.length - a.length);
  }, [reports.data]);
  const activeMutes = mutes.data.filter((m) => m.until.toMillis() > Date.now());

  // Chat settings (read once).
  useEffect(() => {
    getDoc(doc(db, "settings", "chat"))
      .then((s) => s.exists() && setCfg({ enabled: s.data().enabled !== false, photos: s.data().photos !== false }))
      .catch(() => {});
  }, []);

  // Housekeeping: there is no server, so officers clean messages older than 7 days when they open this page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let removed = 0;
      for (const room of [ROOM_ALL, ...settings.puroks]) {
        const snap = await getDocs(query(collection(db, "chatRooms", room, "messages"), where("createdAt", "<", cutoffTimestamp()), orderBy("createdAt"), limit(200)));
        if (snap.empty || cancelled) continue;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        removed += snap.size;
      }
      if (!cancelled) setPruned(removed);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.puroks]);

  async function removeMessage(g: Report[]) {
    setError("");
    const first = g[0];
    try {
      await deleteDoc(doc(db, "chatRooms", first.room, "messages", first.messageId)).catch(() => {});
      await Promise.all(g.map((r) => updateDoc(doc(db, "chatReports", r.id), { status: "removed" })));
      logActivity("Chat", `Binura ang mensahe ni ${first.messageAuthorName} (na-report)`, first.messageId);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function mute(g: Report[], ms: number, label: string) {
    setError("");
    const first = g[0];
    try {
      await setDoc(doc(db, "chatMutes", first.messageAuthorId), { until: Timestamp.fromMillis(Date.now() + ms), by: user?.uid ?? "", name: first.messageAuthorName, reason: first.reason });
      await deleteDoc(doc(db, "chatRooms", first.room, "messages", first.messageId)).catch(() => {});
      await Promise.all(g.map((r) => updateDoc(doc(db, "chatReports", r.id), { status: "removed" })));
      logActivity("Chat", `Na-mute si ${first.messageAuthorName} ng ${label} (report)`, first.messageAuthorId);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function dismiss(g: Report[]) {
    try {
      await Promise.all(g.map((r) => updateDoc(doc(db, "chatReports", r.id), { status: "dismissed" })));
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function saveSettings(next: { enabled: boolean; photos: boolean }) {
    setCfg(next);
    try {
      await setDoc(doc(db, "settings", "chat"), { ...next, updatedAt: serverTimestamp() });
      logActivity("Chat", `${next.enabled ? "Bukas" : "Sarado"} ang chat, larawan ${next.photos ? "bukas" : "sarado"}`);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <div className="space-y-3">
      <FilterTabs<Tab>
        label="Chat Moderation"
        value={tab}
        onChange={setTab}
        options={[
          { value: "reports", label: "Reports", count: grouped.length },
          { value: "mutes", label: "Naka-mute", count: activeMutes.length },
          ...(isSuperAdmin ? [{ value: "settings" as const, label: "Settings" }] : []),
        ]}
      />
      <ErrorText>{error}</ErrorText>

      {tab === "reports" &&
        (reports.loading ? (
          <Spinner />
        ) : grouped.length === 0 ? (
          <EmptyState icon={<MessageCircle />} title="Walang report">Walang mensaheng naghihintay ng aksyon.</EmptyState>
        ) : (
          grouped.map((g) => (
            <Card key={`${g[0].room}/${g[0].messageId}`} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold">{g[0].messageAuthorName} <span className="text-xs font-medium text-gray-500">· {roomTitle(g[0].room)}</span></p>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">{g.length} report</span>
              </div>
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm">{g[0].messageText}</p>
              <p className="text-xs text-gray-600">Dahilan: {[...new Set(g.map((r) => r.reason))].join(", ")} · {timeAgo(g[0].createdAt)}</p>
              <div className="grid grid-cols-3 gap-1.5">
                <Button variant="danger" className="!px-1 !text-xs" onClick={() => removeMessage(g)}>Burahin</Button>
                <Button variant="outline" className="!px-1 !text-xs" onClick={() => mute(g, MUTE_OPTIONS[1].ms, MUTE_OPTIONS[1].label)}>Burahin + mute 1 araw</Button>
                <Button variant="soft" className="!px-1 !text-xs" onClick={() => dismiss(g)}>Balewalain</Button>
              </div>
            </Card>
          ))
        ))}

      {tab === "mutes" &&
        (activeMutes.length === 0 ? (
          <EmptyState icon={<MessageCircle />} title="Walang naka-mute">Lalabas dito ang mga nilimitahan sa chat.</EmptyState>
        ) : (
          activeMutes.map((m) => (
            <Card key={m.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{m.name}</p>
                <p className="text-xs text-gray-600">Hanggang {m.until.toDate().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <Button variant="outline" onClick={() => deleteDoc(doc(db, "chatMutes", m.id)).catch((e) => setError(friendlyError(e)))}>Alisin ang mute</Button>
            </Card>
          ))
        ))}

      {tab === "settings" && isSuperAdmin && (
        <Card className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Bukas ang chat
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => saveSettings({ ...cfg, enabled: e.target.checked })} className="h-5 w-5 accent-brand" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Pwede ang larawan
            <input type="checkbox" checked={cfg.photos} onChange={(e) => saveSettings({ ...cfg, photos: e.target.checked })} className="h-5 w-5 accent-brand" />
          </label>
          <p className="text-xs text-gray-600">Kapag sarado, mababasa pa rin ang mga mensahe pero walang makakapag-type. Awtomatikong nabubura ang mga mensahe pagkatapos ng {CHAT_DAYS} araw.</p>
        </Card>
      )}
      {pruned > 0 && <p className="text-center text-xs text-gray-500">Nilinis ang {pruned} lumang mensahe.</p>}
    </div>
  );
}
