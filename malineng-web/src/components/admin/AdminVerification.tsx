"use client";

import { ensureVerifiedSet, verifiedSetAdd, verifiedSetRef, verifiedSetRemove } from "@/lib/verified";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { BadgeCheck, Phone, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { refreshPublicStatsQuietly } from "@/lib/stats";
import { REJECT_REASONS } from "@/lib/constants";
import { formatDate, friendlyError, telHref, timeAgo, tsToMillis } from "@/lib/format";
import type { Verification, VerificationStatus } from "@/lib/types";
import { Badge, Button, EmptyState, FilterTabs, Modal, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ChatWithButton } from "@/components/ChatWithButton";

const verificationsCollection = collection(db, "verifications");
const TABS: { key: VerificationStatus; label: string }[] = [
  { key: "pending", label: "Naghihintay" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

function age(birthday: string): string {
  if (!birthday) return "";
  const b = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a -= 1;
  return ` (${a})`;
}

function Review({ v, onClose }: { v: Verification; onClose: () => void }) {
  const { user, profile, isOfficer } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [busy, setBusy] = useState(false);

  /** Keeps verifications/{uid} (private) and verifiedUsers/{uid} (public badge flag) in sync. */
  const decide = async (status: "verified" | "rejected") => {
    if (!user || !profile) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "verifications", v.uid), {
        status,
        reason: status === "rejected" ? reason : "",
        reviewedBy: user.uid,
        reviewedByName: profile.fullName,
        reviewedAt: serverTimestamp(),
      });
      const flag = doc(db, "verifiedUsers", v.uid);
      if (status === "verified") batch.set(flag, { name: v.fullName, verifiedAt: serverTimestamp(), verifiedBy: profile.fullName });
      else batch.delete(flag);
      batch.set(verifiedSetRef(), status === "verified" ? verifiedSetAdd(v.uid) : verifiedSetRemove(v.uid), { merge: true });
      await batch.commit();
      refreshPublicStatsQuietly();
      logActivity("Verification", status === "verified" ? `Nag-verify ng account ni ${v.fullName} (${v.purok})` : `Nag-reject ng selfie ni ${v.fullName}: ${reason}`, v.uid);
      toast(status === "verified" ? `Na-verify si ${v.fullName}.` : `Na-reject. Makikita ni ${v.fullName} ang dahilan.`);
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  /** The Kapitan or Secretary approves (or refuses) the ID photo the person made; only an approved one is printed on the ID. */
  const decideIdPhoto = async (state: "approved" | "rejected") => {
    if (!user) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "verifications", v.uid), { idPhotoStatus: state, idPhotoBy: user.uid, idPhotoAt: serverTimestamp() });
      logActivity("Verification", state === "approved" ? `Inaprubahan ang larawan sa ID ni ${v.fullName}` : `Hindi inaprubahan ang larawan sa ID ni ${v.fullName}`, v.uid);
      toast(state === "approved" ? "Na-aprubahan. Ito na ang lalabas sa Barangay ID niya." : "Hindi inaprubahan. Ang orihinal na selfie ang gagamitin sa ID.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={v.idPhoto ? "grid grid-cols-2 gap-2" : ""}>
        <figure className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.selfie} alt={`Selfie ni ${v.fullName}`} className="mx-auto aspect-[3/4] w-full max-w-[15rem] rounded-2xl object-cover" />
          {v.idPhoto && <figcaption className="mt-1 text-xs font-bold text-gray-600">Orihinal na selfie (ito ang sinusuri)</figcaption>}
        </figure>
        {v.idPhoto && (
          <figure className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.idPhoto} alt={`Larawan sa ID ni ${v.fullName}`} className="mx-auto aspect-[4/5] w-full max-w-[15rem] rounded-2xl border border-line bg-white object-cover" />
            <figcaption className="mt-1 text-xs font-bold text-gray-600">Larawan sa ID ({v.idLook === "office" ? "pang-opisina" : "puting background"})</figcaption>
          </figure>
        )}
      </div>
      {v.idPhoto && (
        <div className="space-y-2 rounded-xl bg-brand-light p-3 text-sm">
          <p className="font-bold">
            Larawan para sa Barangay ID:{" "}
            {v.idPhotoStatus === "approved" ? <span className="text-emerald-700">Aprubado, ito ang nasa ID</span> : v.idPhotoStatus === "rejected" ? <span className="text-red-700">Hindi aprubado, selfie ang nasa ID</span> : <span className="text-yellow-900">Naghihintay ng approval</span>}
          </p>
          {isOfficer ? (
            <div className="grid grid-cols-2 gap-2">
              {v.idPhotoStatus !== "approved" && <Button loading={busy} onClick={() => decideIdPhoto("approved")}>Aprubahan sa ID</Button>}
              {v.idPhotoStatus !== "rejected" && <Button variant="outline" loading={busy} onClick={() => decideIdPhoto("rejected")}>Hindi aprubado</Button>}
            </div>
          ) : (
            <p className="text-xs text-gray-600">Ang Kapitan, Secretary o Developer ang aaprub nito.</p>
          )}
        </div>
      )}
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-500">Pangalan</dt><dd className="font-semibold">{v.fullName}</dd>
        <dt className="text-gray-500">Purok</dt><dd className="font-semibold">{v.purok || "—"}</dd>
        <dt className="text-gray-500">Birthday</dt><dd className="font-semibold">{v.birthday ? `${formatDate(v.birthday)}${age(v.birthday)}` : "—"}</dd>
        <dt className="text-gray-500">Contact</dt><dd className="font-semibold">{v.contact || "—"}</dd>
        <dt className="text-gray-500">Email</dt><dd className="break-all font-semibold">{v.email || "—"}</dd>
        <dt className="text-gray-500">Ipinadala</dt><dd>{timeAgo(v.submittedAt)}</dd>
        {v.reviewedByName && (<><dt className="text-gray-500">Sinuri ni</dt><dd>{v.reviewedByName} · {timeAgo(v.reviewedAt)}</dd></>)}
      </dl>
      {v.contact && (
        <a href={telHref(v.contact)} className="flex items-center justify-center gap-2 rounded-xl bg-brand-light py-2.5 text-sm font-bold text-brand">
          <Phone className="h-4 w-4" /> Tawagan para makumpirma
        </a>
      )}
      <ChatWithButton uid={v.uid} name={v.fullName} />
      <p className="text-xs text-gray-500">Tingnan kung kilala mo ang tao at kung tugma ang edad at purok. Kapag hindi sigurado, tawagan muna.</p>

      {v.status !== "verified" && (
        <Button full loading={busy} onClick={() => decide("verified")}><BadgeCheck className="h-4 w-4" /> I-verify</Button>
      )}
      {v.status !== "rejected" && (
        <div className="space-y-2 rounded-xl bg-red-50 p-3">
          <Select label="Dahilan ng pag-reject" options={REJECT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" full loading={busy} onClick={() => decide("rejected")}>
            <XCircle className="h-4 w-4" /> {v.status === "verified" ? "Bawiin ang verification" : "I-reject"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminVerification() {
  const { data, loading } = useCollection<Verification>(verificationsCollection);
  const [tab, setTab] = useState<VerificationStatus>("pending");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // One-time: build stats/verifiedSet (the single document every badge reads) if it does not exist yet.
  useEffect(() => {
    ensureVerifiedSet().catch((err) => console.warn("[verified] could not build the set:", err));
  }, []);

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return data
      .filter((v) => v.status === tab && (!t || `${v.fullName} ${v.purok}`.toLowerCase().includes(t)))
      .sort((a, b) => tsToMillis(a.submittedAt) - tsToMillis(b.submittedAt)); // oldest first = fair queue
  }, [data, tab, search]);
  const open = data.find((v) => v.id === openId) ?? null;

  if (loading) return <Spinner />;

  return (
    <div>
      <FilterTabs
        label="Status ng verification"
        value={tab}
        onChange={setTab}
        options={TABS.map((t) => ({ value: t.key, label: t.label, count: data.filter((v) => v.status === t.key).length, tone: t.key === "pending" ? "alert" : "neutral" }))}
      />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin ang pangalan o purok..." className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" aria-label="Hanapin" />

      {list.length === 0 ? (
        <EmptyState title={tab === "pending" ? "Walang naghihintay ng verification" : "Wala pa dito"} />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((v) => (
            <li key={v.id}>
              <button onClick={() => setOpenId(v.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.selfie} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{v.fullName}</p>
                  <p className="truncate text-xs text-gray-500">{v.purok || "Walang purok"} · {timeAgo(v.submittedAt)}</p>
                </div>
                {v.idPhoto && !v.idPhotoStatus && <Badge color="gold">Larawan sa ID</Badge>}
                <Badge color={v.status === "verified" ? "blue" : v.status === "rejected" ? "red" : "gold"}>
                  {v.status === "verified" ? "✓ Verified" : v.status === "rejected" ? "Rejected" : "Naghihintay"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} title="Verification">
        {open && <Review key={open.id} v={open} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
