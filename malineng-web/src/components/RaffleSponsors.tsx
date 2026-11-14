"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { HandHeart, Receipt } from "lucide-react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { formatPeso, friendlyError, sortNewest } from "@/lib/format";
import { DONATION_STATUS_LABEL, pledgeDonation, useSponsors, type Donation, type DonationKind } from "@/lib/raffleDonations";
import { Button, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Sponsors of the raffle (with the exact amounts, for transparency) and the way to pledge a donation. */
export function RaffleSponsors({ full = false }: { full?: boolean }) {
  const { user } = useAuth();
  const { sponsors } = useSponsors();
  const [donating, setDonating] = useState(false);
  const shown = useMemo(() => sponsors.filter((s) => s.show), [sponsors]);
  const main = shown.filter((s) => s.tier === "main");
  const others = shown.filter((s) => s.tier !== "main");
  const total = shown.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold"><HandHeart className="h-5 w-5 text-gold-dark" aria-hidden /> Mga sponsor at donor</h2>
        {total > 0 && <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-extrabold text-brand">Kabuuan: {formatPeso(total).replace(".00", "")}</span>}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-600">Wala pang sponsor. Maging una!</p>
      ) : (
        <>
          {main.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-gradient-to-b from-gold-light to-[#EAD27A] p-3 text-[#3B2E05]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-brand-deep">{initials(s.name)}</span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] font-extrabold tracking-wider">PANGUNAHING SPONSOR</span>
                <b className="block truncate">{s.name}</b>
                <span className="block text-xs">{s.what}{s.amount ? ` · ${formatPeso(s.amount).replace(".00", "")}` : ""}</span>
              </span>
            </div>
          ))}
          {(full ? others : others.slice(0, 4)).length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {(full ? others : others.slice(0, 4)).map((s) => (
                <li key={s.id} className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-2.5 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-base font-black text-brand-deep">{s.name === "Hindi nagpakilala" ? "♥" : initials(s.name)}</span>
                  <b className="line-clamp-1 text-sm">{s.name}</b>
                  <span className="line-clamp-1 text-xs text-gray-600">{s.what}</span>
                  {s.amount > 0 && <span className="text-xs font-bold text-brand">{formatPeso(s.amount).replace(".00", "")}</span>}
                </li>
              ))}
            </ul>
          )}
          {!full && others.length > 4 && <Link href="/raffle" className="block text-center text-sm font-bold text-brand">Tingnan ang lahat ({shown.length})</Link>}
        </>
      )}

      {user ? (
        <Button full variant="primary" onClick={() => setDonating(true)}>Magdonate o maging sponsor</Button>
      ) : (
        <Link href="/login" className="block rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white">Mag-login para magdonate</Link>
      )}
      <p className="text-center text-xs text-gray-500">Hindi dito kinukuha ang pera. Mangangako ka lang; ang Barangay ang tatawag at tatanggap sa Barangay Hall, at bibigyan ka ng resibo.</p>

      {full && user && <MyDonations uid={user.uid} />}
      <Modal open={donating} onClose={() => setDonating(false)} title="Magdonate o maging sponsor">
        {donating && user && <DonateForm uid={user.uid} onDone={() => setDonating(false)} />}
      </Modal>
    </section>
  );
}

function DonateForm({ uid, onDone }: { uid: string; onDone: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.fullName ?? "");
  const [kind, setKind] = useState<DonationKind>("Pera");
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [contact, setContact] = useState(profile?.contact ?? "");
  const [message, setMessage] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Math.round(Number(amount) || 0);
    if (name.trim().length < 2) return setError("Ilagay ang pangalan o negosyo.");
    if (kind === "Pera" && value <= 0) return setError("Ilagay ang halaga.");
    if (kind !== "Pera" && !what.trim()) return setError("Isulat kung ano ang ibibigay.");
    if (contact.trim().length < 7) return setError("Ilagay ang numero na pwedeng tawagan.");
    setBusy(true);
    setError("");
    try {
      await pledgeDonation(uid, { name, anon, kind, what: kind === "Pera" ? `₱${value.toLocaleString("en-PH")}` : what, amount: value, contact, message });
      toast("Salamat! Naipadala ang pangako mo. Makikipag-ugnayan ang Barangay.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Pangalan o negosyo" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <Select label="Uri" options={["Pera", "Gamit / premyo"]} value={kind} onChange={(e) => setKind(e.target.value as DonationKind)} />
      {kind !== "Pera" && <Input label="Ano ang ibibigay" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={120} placeholder="hal. Grocery package with rice" />}
      <Input label={kind === "Pera" ? "Halaga (₱)" : "Halaga ng gamit (₱, optional)"} type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} hint="Makikita ng lahat ang halaga, para sa transparency." />
      <Input label="Numero na pwedeng tawagan" type="tel" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={30} />
      <Input label="Mensahe (optional)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="mt-1" />
        <span>Huwag ilagay ang pangalan ko sa listahan (Hindi nagpakilala). Ilalagay pa rin ang halaga.</span>
      </label>
      <p className="rounded-xl bg-brand-light p-3 text-xs text-brand-deep"><b>Paano ibibigay:</b> tatawagan ka ng Barangay. Ihahatid ang pera o gamit sa <b>Barangay Hall</b> at bibigyan ka ng <b>resibo</b> na makikita mo rin dito sa app.</p>
      {error && <p className="rounded-xl bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" type="button" onClick={onDone}>Bumalik</Button>
        <Button type="submit" loading={busy}>Ipadala ang pangako</Button>
      </div>
    </form>
  );
}

/** The donor's own pledges, with the receipt once the Barangay received them. */
function MyDonations({ uid }: { uid: string }) {
  const q = useMemo(() => query(collection(db, "raffleDonations"), where("userId", "==", uid)), [uid]);
  const { data: unsorted } = useCollection<Donation>(q);
  const data = useMemo(() => sortNewest(unsorted), [unsorted]);
  if (data.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <h3 className="text-sm font-extrabold">Mga donasyon ko</h3>
      {data.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-bold">{d.what}</p>
            <p className="text-xs text-gray-500">{DONATION_STATUS_LABEL[d.status]}{d.receiptNo ? ` · ${d.receiptNo}` : ""}</p>
          </div>
          {d.status === "received" && (
            <Link href={`/raffle/resibo/?id=${d.id}`} className="flex shrink-0 items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white">
              <Receipt className="h-3.5 w-3.5" aria-hidden /> Resibo
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
