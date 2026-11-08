"use client";

import { useMemo, useState } from "react";
import { collection, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { CalendarClock, Phone, Siren } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/lib/useSettings";
import { useCollection } from "@/lib/useCollection";
import { AVAILABILITY_LABEL } from "@/lib/ambulance";
import { friendlyError, sortNewest, telHref } from "@/lib/format";
import type { AmbulanceRequest } from "@/lib/types";
import { Button, Card, EmptyState, Modal, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { AmbulanceForm } from "@/components/ambulance/AmbulanceForm";
import { AmbulanceTracker } from "@/components/ambulance/AmbulanceTracker";
import { useToast } from "@/components/Toast";

const AVAIL_STYLE = {
  available: "bg-brand-light text-brand",
  busy: "bg-gold-light text-yellow-800",
  maintenance: "bg-red-100 text-red-700",
} as const;

function MyRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const q = useMemo(() => (user ? query(collection(db, "ambulanceRequests"), where("userId", "==", user.uid)) : null), [user]);
  const { data, loading } = useCollection<AmbulanceRequest>(q);
  const items = useMemo(() => sortNewest(data), [data]);

  const cancel = async (id: string) => {
    if (!confirm("I-cancel ang request na ito?")) return;
    try {
      await updateDoc(doc(db, "ambulanceRequests", id), { status: "cancelled", updatedAt: serverTimestamp() });
      toast("Na-cancel na ang request.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (loading) return <Spinner />;
  if (items.length === 0) return <EmptyState title="Wala ka pang request" />;
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.id} className={r.status === "enroute" ? "ring-2 ring-blue-400" : ""}>
          <AmbulanceTracker req={r} />
          {r.status === "pending" && (
            <Button variant="outline" full className="mt-3 border-red-200 text-red-700" onClick={() => cancel(r.id)}>I-cancel ang request</Button>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function AmbulansyaPage() {
  const { settings, loading } = useSettings();
  const [formMode, setFormMode] = useState<"emergency" | "schedule" | null>(null);
  const amb = settings.ambulance;

  return (
    <div>
      <PageHeader title="🚑 Ambulansya" subtitle={`Serbisyo ng Barangay Malineng · ${amb.fee.trim() ? amb.fee : "Libre"}`} />

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <Card className="flex items-center justify-between gap-2">
            <span className="font-bold">Status ng ambulansya</span>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${AVAIL_STYLE[amb.status]}`}>● {AVAILABILITY_LABEL[amb.status]}</span>
          </Card>

          {amb.status === "maintenance" && (
            <p className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">
              Hindi magagamit ang ambulansya ngayon. Sa emergency, tumawag sa <a href="/emergency/" className="underline">Cuyapo MDRRMO o 911</a>.
            </p>
          )}

          {amb.phone ? (
            <a href={telHref(amb.phone)} className="block rounded-3xl bg-red-600 p-5 text-white shadow-lg active:bg-red-700">
              <span className="block text-xl font-black">EMERGENCY? TUMAWAG AGAD</span>
              <span className="mt-1 flex items-center gap-2 text-3xl font-black tabular-nums"><Phone className="h-7 w-7" /> {amb.phone}</span>
              <span className="block text-white/90">Pindutin para tumawag sa ambulansya</span>
            </a>
          ) : (
            <a href="/emergency/" className="block rounded-3xl bg-red-600 p-5 text-white shadow-lg">
              <span className="block text-xl font-black">EMERGENCY? TUMAWAG AGAD</span>
              <span className="block text-white/90">Wala pang naka-set na numero ng ambulansya. Pindutin para sa mga hotline.</span>
            </a>
          )}

          <Button variant="danger" full onClick={() => setFormMode("emergency")}><Siren className="h-5 w-5" /> Mag-request ng Emergency (online)</Button>

          <SectionTitle>Hindi emergency?</SectionTitle>
          <Card>
            <p className="font-bold">Mag-schedule ng sasakyan</p>
            <p className="mb-3 text-gray-600">Check-up, dialysis, therapy, panganganak, o paglipat ng ospital. Kahit anong oras, basta bakante ang ambulansya.</p>
            <Button full onClick={() => setFormMode("schedule")}><CalendarClock className="h-5 w-5" /> Mag-schedule</Button>
          </Card>

          <SectionTitle>Mga request ko</SectionTitle>
          <LoginGate message="Mag-login para makita at ma-track ang mga request mo.">
            <MyRequests />
          </LoginGate>
        </div>
      )}

      <Modal open={formMode !== null} onClose={() => setFormMode(null)} title="Request ng Ambulansya">
        <LoginGate message="Mag-login para makapag-request. Kung emergency, tumawag na lang agad.">
          {formMode && <AmbulanceForm initialMode={formMode} onDone={() => setFormMode(null)} />}
        </LoginGate>
      </Modal>
    </div>
  );
}
