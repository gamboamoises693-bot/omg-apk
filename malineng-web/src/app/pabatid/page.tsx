"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { BellRing, Megaphone, Send, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { notificationPermission, registerServiceWorker, requestNotificationPermission } from "@/lib/alerts";
import { friendlyError, timeAgo } from "@/lib/format";
import { ANNOUNCEMENT_CATEGORIES, categoryBadge, getSeenAt, isUrgent, markAllSeen, useAnnouncements, useMyAnnouncements, type Announcement } from "@/lib/pabatid";
import { Button, Card, EmptyState, ErrorText, FilterTabs, Input, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/** Officers: write a new notice for everyone or chosen puroks. */
function ComposeForm() {
  const { profile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(ANNOUNCEMENT_CATEGORIES[4].name);
  const [target, setTarget] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (p: string) => setTarget((t) => (t.includes(p) ? t.filter((x) => x !== p) : [...t, p]));

  const send = async () => {
    setError("");
    if (!title.trim()) return setError("Ilagay ang pamagat.");
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "announcements"), {
        title: title.trim().slice(0, 120),
        body: body.trim().slice(0, 2000),
        category,
        puroks: target,
        createdAt: serverTimestamp(),
        createdByName: profile?.fullName ?? "",
      });
      logActivity("Pabatid", `Nagpadala ng ${category}: ${title.trim()}${target.length ? ` (${target.join(", ")})` : " (lahat)"}`, ref.id);
      toast("Naipadala ang pabatid.");
      setTitle("");
      setBody("");
      setTarget([]);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 space-y-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        <Megaphone className="h-4 w-4" /> Bagong pabatid
      </p>
      <Input label="Pamagat" placeholder="hal. Walang kuryente bukas 8AM–5PM" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <Textarea label="Detalye" placeholder="Sino ang apektado, kailan, ano ang gagawin..." value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      <Select label="Uri" options={ANNOUNCEMENT_CATEGORIES.map((c) => c.name)} value={category} onChange={(e) => setCategory(e.target.value)} hint="Urgent at Kalamidad: lalabas agad bilang pop-up" />
      <div>
        <p className="mb-1 text-[0.85rem] font-semibold text-gray-700">Para kanino</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTarget([])} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${target.length === 0 ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`} aria-pressed={target.length === 0}>
            Lahat ng purok
          </button>
          {puroks.map((p) => (
            <button key={p} type="button" onClick={() => toggle(p)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${target.includes(p) ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`} aria-pressed={target.includes(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={send}>
        <Send className="h-4 w-4" /> Ipadala
      </Button>
    </Card>
  );
}

function NotificationToggle() {
  const toast = useToast();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => setPerm(notificationPermission()), []);
  if (perm === "granted" || perm === "unsupported") return null;
  return (
    <button
      onClick={async () => {
        await registerServiceWorker();
        const p = await requestNotificationPermission();
        setPerm(p);
        toast(p === "granted" ? "Naka-on na. Tutunog ang phone kapag may bagong pabatid habang bukas ang website." : "Hindi pinayagan. Pwedeng i-on sa settings ng browser.", p === "granted" ? "success" : "error");
      }}
      className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-brand-light p-3 text-left text-sm text-brand-deep"
    >
      <BellRing className="h-5 w-5 shrink-0 text-brand" />
      <span><b>I-on ang notification</b> para tumunog ang phone kapag may bagong pabatid (habang bukas ang website).</span>
    </button>
  );
}

function AnnouncementCard({ a, isNew, canDelete }: { a: Announcement; isNew: boolean; canDelete: boolean }) {
  const toast = useToast();
  const remove = async () => {
    if (!confirm(`Burahin ang "${a.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "announcements", a.id));
      logActivity("Pabatid", `Binura ang pabatid: ${a.title}`, a.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  return (
    <article className={`rounded-2xl p-3.5 shadow-card ${isUrgent(a) ? "border-[1.5px] border-red-300 bg-red-50" : "bg-white"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase ${categoryBadge(a.category)}`}>{a.category}</span>
        {isNew && <span className="rounded-full bg-brand px-2 py-0.5 text-[0.65rem] font-black text-white">BAGO</span>}
        <span className="text-xs text-gray-500">{timeAgo(a.createdAt)}</span>
        {a.puroks.length > 0 && <span className="text-xs text-gray-500">· {a.puroks.join(", ")}</span>}
      </div>
      <h2 className="font-extrabold">{a.title}</h2>
      {a.body && <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{a.body}</p>}
      {canDelete && (
        <button onClick={remove} className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-700">
          <Trash2 className="h-3.5 w-3.5" /> Burahin
        </button>
      )}
    </article>
  );
}

export default function PabatidPage() {
  const { isOfficer } = useAuth();
  const { mine, loading } = useMyAnnouncements();
  const { all } = useAnnouncements();
  const [tab, setTab] = useState<"akin" | "lahat">("akin");
  // Snapshot of "seen" when the page opened, so the BAGO labels stay visible while reading.
  const [openedSeenAt] = useState(() => getSeenAt());

  useEffect(() => {
    markAllSeen();
  }, [mine.length]);

  const list = tab === "akin" ? mine : all;

  return (
    <div>
      <PageHeader title="Pabatid" subtitle="Mga abiso mula sa Barangay Malineng" />
      {isOfficer && <ComposeForm />}
      <NotificationToggle />
      <FilterTabs
        label="Pabatid"
        value={tab}
        onChange={setTab}
        options={[
          { value: "akin", label: "Para sa akin", count: mine.length, tone: "neutral" },
          { value: "lahat", label: "Lahat ng purok", count: all.length, tone: "neutral" },
        ]}
      />
      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="Wala pang pabatid" />
      ) : (
        <div className="space-y-2.5">
          {list.map((a) => (
            <AnnouncementCard key={a.id} a={a} isNew={(a.createdAt?.toMillis() ?? Date.now()) > openedSeenAt} canDelete={isOfficer} />
          ))}
        </div>
      )}
    </div>
  );
}
