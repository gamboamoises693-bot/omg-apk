"use client";

import { useMemo, useState } from "react";
import { Timestamp, collection, doc, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { Camera, FileWarning, Lock, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError, sortNewest } from "@/lib/format";
import { BLOTTER_STATUS, BLOTTER_TYPES, newCaseNo, type Blotter } from "@/lib/blotter";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Modal, PageHeader, Select, Spinner, Textarea, SelectOther } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { BlotterTimeline } from "@/components/BlotterTimeline";
import { useToast } from "@/components/Toast";

function FileForm({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [type, setType] = useState<string>(BLOTTER_TYPES[0]);
  const [description, setDescription] = useState("");
  const [respondent, setRespondent] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await compressToDataUrl(file, 1100, 0.7, 380_000));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const submit = async () => {
    if (!user || !profile) return;
    setError("");
    if (description.trim().length < 10) return setError("Ikuwento nang mas detalyado ang nangyari (kahit 1–2 pangungusap).");
    setBusy(true);
    try {
      const ref = doc(collection(db, "blotters"));
      const caseNo = newCaseNo();
      const batch = writeBatch(db);
      batch.set(ref, {
        caseNo,
        complainantId: user.uid,
        complainantName: profile.fullName,
        purok: profile.purok ?? "",
        contact: profile.contact ?? "",
        type,
        description: description.trim().slice(0, 2000),
        respondent: respondent.trim().slice(0, 120),
        hasPhoto: !!photo,
        status: "natanggap",
        history: [{ status: "natanggap", note: "", at: Timestamp.now() }],
        createdAt: serverTimestamp(),
      });
      if (photo) batch.set(doc(db, "blotterPhotos", ref.id), { photo });
      await batch.commit();
      // Only the case number goes to the activity log: details stay private.
      logActivity("Blotter", `Nag-file ng reklamo ${caseNo}`, ref.id);
      toast(`Naipadala. Case no. ${caseNo}`);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl bg-brand-light p-3 text-[0.82rem] text-brand-deep">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" /> Pribado ito: ikaw, si Kapitan at ang Secretary lang ang makakakita.
      </p>
      <SelectOther label="Uri ng reklamo" options={BLOTTER_TYPES} value={type} onChange={setType} />
      <Textarea label="Ano ang nangyari" placeholder="Kailan, saan, at ano ang nangyari..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      <Input label="Inirereklamo (optional)" placeholder="Pangalan at purok, kung alam" value={respondent} onChange={(e) => setRespondent(e.target.value)} maxLength={120} />
      <label className="block cursor-pointer">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Ebidensya" className="max-h-56 w-full rounded-xl object-contain" />
        ) : (
          <span className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand-light py-3 text-sm font-bold text-brand">
            <Camera className="h-4 w-4" /> Litrato bilang ebidensya (optional)
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {photo && <button onClick={() => setPhoto("")} className="text-xs font-semibold text-red-700">Alisin ang litrato</button>}
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={submit}>Ipadala sa Barangay</Button>
    </div>
  );
}

function MyCases() {
  const { user } = useAuth();
  const [filing, setFiling] = useState(false);
  const q = useMemo(() => (user ? query(collection(db, "blotters"), where("complainantId", "==", user.uid)) : null), [user]);
  const { data, loading } = useCollection<Blotter>(q);

  return (
    <div>
      <Button full className="mb-4" onClick={() => setFiling(true)}>
        <Plus className="h-4 w-4" /> Mag-file ng reklamo
      </Button>
      {loading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon={<FileWarning />} title="Wala kang reklamo" />
      ) : (
        <div className="space-y-3">
          {sortNewest(data).map((b) => (
            <Card key={b.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold">{b.caseNo} · {b.type}</p>
                <Badge color={BLOTTER_STATUS[b.status].badge}>{BLOTTER_STATUS[b.status].label}</Badge>
              </div>
              <p className="text-sm text-gray-700">{b.description}</p>
              <BlotterTimeline b={b} />
            </Card>
          ))}
        </div>
      )}
      <Modal open={filing} onClose={() => setFiling(false)} title="Bagong reklamo">
        {filing && <FileForm onDone={() => setFiling(false)} />}
      </Modal>
    </div>
  );
}

export default function ReklamoPage() {
  return (
    <div>
      <PageHeader title="Reklamo at Blotter" subtitle="Ipaalam sa Barangay at subaybayan ang kaso" />
      <RequireVerified feature="mag-file ng reklamo">
        <MyCases />
      </RequireVerified>
    </div>
  );
}
