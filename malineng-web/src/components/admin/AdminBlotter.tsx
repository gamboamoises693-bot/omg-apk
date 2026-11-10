"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp, arrayUnion, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { Phone, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError, telHref, timeAgo, tsToMillis } from "@/lib/format";
import { BLOTTER_STATUS, type Blotter, type BlotterStatus } from "@/lib/blotter";
import { Badge, Button, EmptyState, FilterTabs, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { BlotterTimeline } from "@/components/BlotterTimeline";
import { useToast } from "@/components/Toast";

const blottersCol = collection(db, "blotters");
type Tab = "bukas" | "naayos" | "lahat";

function EvidencePhoto({ id }: { id: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    getDoc(doc(db, "blotterPhotos", id))
      .then((s) => setPhoto((s.data()?.photo as string) ?? ""))
      .catch(() => setPhoto(""));
  }, [id]);
  if (photo === null) return <Spinner label="Kinukuha ang litrato..." />;
  // eslint-disable-next-line @next/next/no-img-element
  return photo ? <img src={photo} alt="Ebidensya" className="w-full rounded-xl" /> : null;
}

function CaseDetail({ b }: { b: Blotter }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [hearingAt, setHearingAt] = useState(b.hearingAt ?? "");
  const [busy, setBusy] = useState(false);

  const move = async (status: BlotterStatus) => {
    if (status === "ipinatawag" && !hearingAt) return toast("Ilagay muna ang petsa at oras ng pagdinig.", "error");
    setBusy(true);
    try {
      await updateDoc(doc(db, "blotters", b.id), {
        status,
        ...(status === "ipinatawag" ? { hearingAt } : {}),
        history: arrayUnion({ status, note: note.trim().slice(0, 500), at: Timestamp.now(), by: profile?.fullName ?? "" }),
      });
      logActivity("Blotter", `${b.caseNo}: ${BLOTTER_STATUS[status].label}`, b.id);
      toast(`Na-update: ${BLOTTER_STATUS[status].label}`);
      setNote("");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm">
        <p className="text-lg font-extrabold">{b.caseNo}</p>
        <p><b>Uri:</b> {b.type}</p>
        <p><b>Nagrereklamo:</b> {b.complainantName} ({b.purok || "—"}){b.contact ? ` · ${b.contact}` : ""}</p>
        {b.respondent && <p><b>Inirereklamo:</b> {b.respondent}</p>}
        <p><b>Na-file:</b> {b.createdAt?.toDate().toLocaleString("fil-PH")}</p>
        <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 text-gray-800">{b.description}</p>
      </div>
      {b.hasPhoto && <EvidencePhoto id={b.id} />}
      <BlotterTimeline b={b} />

      {b.status !== "naayos" && b.status !== "isinara" && (
        <div className="space-y-2 rounded-xl bg-brand-light/60 p-3">
          <Textarea label="Tala (makikita ng nagreklamo)" placeholder="hal. Ipinatawag si Pedro Cruz sa pamamagitan ng tanod" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          {b.status === "natanggap" && <Input label="Petsa at oras ng pagdinig" type="datetime-local" value={hearingAt} onChange={(e) => setHearingAt(e.target.value)} />}
          <div className="grid grid-cols-2 gap-2">
            {b.status === "natanggap" ? (
              <Button loading={busy} onClick={() => move("ipinatawag")}>Ipatawag</Button>
            ) : (
              <Button loading={busy} onClick={() => move("naayos")}>Naayos na</Button>
            )}
            <Button variant="outline" loading={busy} onClick={() => confirm("Isara ang kaso (hindi naayos / in-refer)?") && move("isinara")}>Isara</Button>
          </div>
        </div>
      )}

      {b.contact && (
        <a href={telHref(b.contact)} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-light py-2.5 text-sm font-bold text-brand">
          <Phone className="h-4 w-4" /> Tawagan ang nagreklamo
        </a>
      )}
    </div>
  );
}

/** Officers: every complaint, newest open cases first. */
export function AdminBlotter() {
  const { data, loading, error } = useCollection<Blotter>(blottersCol);
  const [tab, setTab] = useState<Tab>("bukas");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const isOpen = (b: Blotter) => b.status === "natanggap" || b.status === "ipinatawag";
  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return data
      .filter((b) => (tab === "bukas" ? isOpen(b) : tab === "naayos" ? !isOpen(b) : true))
      .filter((b) => !t || `${b.caseNo} ${b.complainantName} ${b.respondent} ${b.type} ${b.purok}`.toLowerCase().includes(t))
      .sort((a, b) => Number(b.status === "natanggap") - Number(a.status === "natanggap") || tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
  }, [data, tab, search]);
  const open = data.find((b) => b.id === openId) ?? null;
  const newCount = data.filter((b) => b.status === "natanggap").length;

  if (loading) return <Spinner />;
  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <div>
      <FilterTabs
        label="Blotter"
        value={tab}
        onChange={setTab}
        options={[
          { value: "bukas", label: "Bukas", count: newCount },
          { value: "naayos", label: "Tapos na" },
          { value: "lahat", label: "Lahat", count: data.length, tone: "neutral" },
        ]}
      />
      <label className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Case no., pangalan, purok..." aria-label="Hanapin" className="w-full bg-transparent py-2.5 outline-none" />
      </label>
      {list.length === 0 ? (
        <EmptyState title={tab === "bukas" ? "Walang bukas na reklamo" : "Wala dito"} />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((b) => (
            <li key={b.id}>
              <button onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{b.caseNo} · {b.type}</p>
                  <p className="truncate text-xs text-gray-500">{b.complainantName} ({b.purok || "—"}){b.respondent ? ` vs ${b.respondent}` : ""} · {timeAgo(b.createdAt)}</p>
                </div>
                <Badge color={BLOTTER_STATUS[b.status].badge}>{BLOTTER_STATUS[b.status].label}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!open} onClose={() => setOpenId(null)} title="Kaso">
        {open && <CaseDetail key={open.id} b={open} />}
      </Modal>
    </div>
  );
}
