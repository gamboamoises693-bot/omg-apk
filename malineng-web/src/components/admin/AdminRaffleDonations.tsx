"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { formatPeso, friendlyError, sortNewest, timeAgo } from "@/lib/format";
import { DONATION_STATUS_LABEL, markReceived, type Donation, type Sponsor } from "@/lib/raffleDonations";
import { Badge, Button, Card, EmptyState, FilterTabs, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { serverTimestamp, setDoc } from "firebase/firestore";

type Tab = "pangako" | "sponsor";
const donationsCol = collection(db, "raffleDonations");
const sponsorsCol = collection(db, "raffleSponsors");

const tone = (s: Donation["status"]) => (s === "received" ? "green" : s === "declined" ? "red" : "gold");

/** Admin: pledges of raffle donations (accept, mark received with a receipt) and the public sponsor list. */
export function AdminRaffleDonations() {
  const [tab, setTab] = useState<Tab>("pangako");
  const donations = useCollection<Donation>(donationsCol);
  const sponsors = useCollection<Sponsor>(sponsorsCol);
  const newCount = donations.data.filter((d) => d.status === "new").length;

  if (donations.loading || sponsors.loading) return <Spinner />;
  return (
    <div className="space-y-3">
      <FilterTabs<Tab>
        label="Donasyon sa raffle"
        value={tab}
        onChange={setTab}
        options={[
          { value: "pangako", label: "Mga pangako", count: newCount, tone: newCount ? "alert" : "neutral" },
          { value: "sponsor", label: "Mga sponsor", count: sponsors.data.length, tone: "neutral" },
        ]}
      />
      {tab === "pangako" ? <Pledges list={sortNewest(donations.data)} /> : <Sponsors list={sponsors.data} />}
    </div>
  );
}

function Pledges({ list }: { list: Donation[] }) {
  if (list.length === 0) return <EmptyState title="Wala pang pangako ng donasyon" />;
  return (
    <>
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        <b className="text-gold">Tinanggap</b> = tatawagan ang donor at ihahatid sa Barangay Hall. <b className="text-gold">Natanggap na</b> = gagawa ng <b>resibo</b> para sa donor at ilalagay siya sa listahan ng sponsor (kasama ang halaga).
      </p>
      {list.map((d) => (
        <PledgeCard key={d.id} d={d} />
      ))}
    </>
  );
}

function PledgeCard({ d }: { d: Donation }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [amount, setAmount] = useState(String(d.amount || ""));
  const [what, setWhat] = useState(d.what);

  const run = async (fn: () => Promise<void>, ok: string, log: string) => {
    setBusy(true);
    try {
      await fn();
      logActivity("Raffle", log, d.id);
      toast(ok);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{d.name}{d.anon ? " (Hindi nagpakilala)" : ""}</p>
          <p className="text-sm text-gray-600">{d.kind} · <b>{d.what}</b>{d.amount ? ` · ${formatPeso(d.amount).replace(".00", "")}` : ""}</p>
          <p className="text-xs text-gray-500">☎ {d.contact} · {timeAgo(d.createdAt)}</p>
          {d.message && <p className="mt-1 text-sm text-gray-700">&ldquo;{d.message}&rdquo;</p>}
        </div>
        <Badge color={tone(d.status)}>{DONATION_STATUS_LABEL[d.status].split(",")[0]}</Badge>
      </div>

      {d.status === "new" && (
        <div className="grid grid-cols-2 gap-2">
          <Button loading={busy} onClick={() => run(() => updateDoc(doc(db, "raffleDonations", d.id), { status: "accepted" }), "Tinanggap. Tawagan ang donor.", `Tinanggap ang pangako ni ${d.name}`)}>Tanggapin</Button>
          <Button variant="danger" loading={busy} onClick={() => confirm("Hindi tatanggapin ang pangakong ito?") && run(() => updateDoc(doc(db, "raffleDonations", d.id), { status: "declined" }), "Hindi tinanggap.", `Hindi tinanggap ang pangako ni ${d.name}`)}>Hindi tinanggap</Button>
        </div>
      )}

      {d.status === "accepted" &&
        (receiving ? (
          <div className="space-y-2 rounded-xl bg-gold-light p-3">
            <p className="text-sm font-bold">Natanggap na ang donasyon</p>
            <Input label="Ano ang natanggap" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={120} />
            <Input label="Halaga (₱)" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} hint="Ito ang ipapakita sa publiko at sa resibo." />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setReceiving(false)}>Bumalik</Button>
              <Button
                loading={busy}
                onClick={() => user && profile && run(async () => { await markReceived(d, { uid: user.uid, name: profile.fullName }, Number(amount) || 0, what); setReceiving(false); }, "Natanggap na. Gumawa ng resibo at nailagay sa sponsor.", `Natanggap ang donasyon ni ${d.name}: ${what}`)}
              >
                Gumawa ng resibo
              </Button>
            </div>
          </div>
        ) : (
          <Button full onClick={() => setReceiving(true)}>Natanggap na · gumawa ng resibo</Button>
        ))}

      {d.status === "received" && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 p-2.5 text-sm text-green-900">
          <span>Resibo {d.receiptNo} · tinanggap ni {d.receivedByName}</span>
          <Link href={`/raffle/resibo/?id=${d.id}`} className="flex shrink-0 items-center gap-1 font-bold underline"><Receipt className="h-4 w-4" aria-hidden /> Tingnan</Link>
        </div>
      )}
    </Card>
  );
}

function Sponsors({ list }: { list: Sponsor[] }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...list].sort((a, b) => Number(b.tier === "main") - Number(a.tier === "main")), [list]);
  const total = list.filter((s) => s.show).reduce((sum, s) => sum + (s.amount || 0), 0);

  const add = async () => {
    if (name.trim().length < 2 || !what.trim()) return toast("Ilagay ang pangalan at kung ano ang ibinigay.", "error");
    setBusy(true);
    try {
      await setDoc(doc(collection(db, "raffleSponsors")), { name: name.trim().slice(0, 120), what: what.trim().slice(0, 120), amount: Math.max(0, Math.round(Number(amount) || 0)), tier: "reg", show: true, createdAt: serverTimestamp() });
      logActivity("Raffle", `Nagdagdag ng sponsor: ${name.trim()}`);
      setName("");
      setWhat("");
      setAmount("");
      toast("Naidagdag ang sponsor.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (s: Sponsor, data: Partial<Sponsor>, log: string) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "raffleSponsors", s.id), data);
      await batch.commit();
      logActivity("Raffle", log, s.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <>
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">Kabuuang halaga ng mga sponsor na nakikita ng publiko: <b className="text-gold">{formatPeso(total).replace(".00", "")}</b></p>
      {sorted.length === 0 && <EmptyState title="Wala pang sponsor" />}
      {sorted.map((s) => (
        <Card key={s.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-gray-600">{s.what}{s.amount ? ` · ${formatPeso(s.amount).replace(".00", "")}` : ""}</p>
            </div>
            <Badge color={s.tier === "main" ? "gold" : "gray"}>{s.tier === "main" ? "Pangunahin" : "Sponsor"}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => patch(s, { tier: s.tier === "main" ? "reg" : "main" }, `Binago ang antas ng sponsor: ${s.name}`)}>{s.tier === "main" ? "Gawing karaniwan" : "Gawing pangunahin"}</Button>
            <Button variant="outline" onClick={() => patch(s, { show: !s.show }, `${s.show ? "Itinago" : "Ipinakita"} ang sponsor: ${s.name}`)}>{s.show ? "Itago" : "Ipakita"}</Button>
            <Button variant="outline" className="!text-red-700" onClick={() => confirm(`Burahin si ${s.name} sa listahan?`) && deleteDoc(doc(db, "raffleSponsors", s.id)).then(() => logActivity("Raffle", `Binura ang sponsor: ${s.name}`, s.id)).catch((e) => toast(friendlyError(e), "error"))}>Burahin</Button>
          </div>
        </Card>
      ))}
      <Card className="space-y-2">
        <h3 className="font-extrabold">Magdagdag ng sponsor</h3>
        <Input label="Pangalan o negosyo" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Input label="Ibinigay" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={120} placeholder="hal. Grocery package with rice" />
        <Input label="Halaga (₱)" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button full loading={busy} onClick={add}>Idagdag</Button>
      </Card>
    </>
  );
}
