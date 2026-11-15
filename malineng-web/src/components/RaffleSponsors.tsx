"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, HandHeart, Receipt } from "lucide-react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { formatPeso, friendlyError, sortNewest } from "@/lib/format";
import { pledgeDonation, useSponsors, type Donation, type DonationKind } from "@/lib/raffleDonations";
import { Button, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { LogoPicker } from "@/components/LogoPicker";
import { useXmas } from "@/lib/raffle";
import { XmasGarland, XmasStar } from "@/components/Xmas";
import { linkHost } from "@/lib/raffleDonations";

/** What the donor reads about each step of their pledge. */
const DONOR_LABEL = {
  new: "Naipadala · hinihintay ang Barangay",
  accepted: "Natanggap ng Barangay · tatawagan ka",
  received: "Natanggap na ang donasyon",
  declined: "Hindi natanggap",
} as const;

/**
 * One sponsor: a plain box, or a link to their Facebook page or website when they gave one.
 * The link opens in a new tab, and the address is shown so people know where the tap goes.
 */
function SponsorBox({ s, className, children }: { s: { name: string; link?: string }; className: string; children: ReactNode }) {
  if (!s.link) return <div className={className}>{children}</div>;
  return (
    <a href={s.link} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Buksan ang ${s.name} (${linkHost(s.link)})`} className={`${className} block active:scale-[0.98]`}>
      {children}
    </a>
  );
}

/** Small "facebook.com ↗" hint under a sponsor that has a link. */
function LinkHint({ link, dark = false }: { link?: string; dark?: boolean }) {
  if (!link) return null;
  return (
    <span className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold ${dark ? "bg-[#0F4A36]/10 text-[#0F4A36]" : "bg-brand-light text-brand"}`}>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">{linkHost(link)}</span>
    </span>
  );
}

/** The business logo when there is one, otherwise the initials. */
function SponsorMark({ s, className, xmas = false }: { s: { name: string; logo?: string }; className: string; xmas?: boolean }) {
  // At Christmas the logo sits in a round gold-ringed badge, like an ornament.
  const ring = xmas ? "!rounded-full border-[3px] border-gold bg-white shadow-md" : "";
  if (s.logo) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ${className} ${ring}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.logo} alt={`Logo ng ${s.name}`} className="h-full w-full object-contain p-0.5" loading="lazy" />
      </span>
    );
  }
  return <span className={`flex shrink-0 items-center justify-center font-black text-brand-deep ${className} ${ring}`}>{s.name === "Hindi nagpakilala" ? "♥" : initials(s.name)}</span>;
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Sponsors of the raffle (with the exact amounts, for transparency) and the way to pledge a donation. */
export function RaffleSponsors({ full = false }: { full?: boolean }) {
  const { user } = useAuth();
  const xmas = useXmas();
  const { sponsors } = useSponsors();
  const [donating, setDonating] = useState(false);
  const shown = useMemo(() => sponsors.filter((s) => s.show), [sponsors]);
  const main = shown.filter((s) => s.tier === "main");
  const others = shown.filter((s) => s.tier !== "main");
  const total = shown.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <section className={`space-y-3 overflow-hidden rounded-2xl p-4 shadow-card ${xmas ? "bg-[#FFF8EA] pt-0" : "bg-white"}`}>
      {xmas && <div className="xmas-cane -mx-4" aria-hidden />}
      <div className={`flex items-center justify-between gap-2 ${xmas ? "pt-1" : ""}`}>
        <h2 className={`flex items-center gap-2 font-extrabold ${xmas ? "text-[#0F4A36]" : ""}`}>
          {xmas ? <XmasStar className="h-5 w-5 fill-[#B3202B]" /> : <HandHeart className="h-5 w-5 text-gold-dark" aria-hidden />} Mga sponsor at donor
        </h2>
        {total > 0 && <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${xmas ? "bg-[#0F4A36] text-white" : "bg-brand-light text-brand"}`}>Kabuuan: {formatPeso(total).replace(".00", "")}</span>}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-600">Wala pang sponsor. Maging una!</p>
      ) : (
        <>
          {main.map((s) => (
            <SponsorBox key={s.id} s={s} className={`relative flex items-center gap-3 rounded-2xl bg-gradient-to-b from-gold-light to-[#EAD27A] p-3 text-[#3B2E05] shadow-[0_8px_18px_-10px_rgba(120,80,0,.6)] ${xmas ? "mt-5 pt-8 ring-1 ring-[#E0B94A]" : ""}`}>
              {xmas && <XmasStar className="absolute -top-4 left-1/2 h-9 w-9 -translate-x-1/2 fill-[#B3202B] drop-shadow-[0_2px_0_rgba(0,0,0,.25)]" />}
              <SponsorMark s={s} xmas={xmas} className="h-14 w-14 rounded-2xl bg-white text-lg" />
              <span className="min-w-0">
                <span className="block text-[0.65rem] font-extrabold tracking-wider">PANGUNAHING SPONSOR</span>
                <b className="block truncate">{s.name}</b>
                <span className="block text-xs">{s.what}{s.amount ? ` · ${formatPeso(s.amount).replace(".00", "")}` : ""}</span>
                <LinkHint link={s.link} dark />
              </span>
            </SponsorBox>
          ))}
          {(full ? others : others.slice(0, 4)).length > 0 && (
            <>
              {xmas && <XmasGarland />}
              <ul className={`grid grid-cols-2 ${xmas ? "items-start gap-x-3 gap-y-3" : "gap-2"}`} style={xmas ? { marginTop: "-1.1rem" } : undefined}>
                {(full ? others : others.slice(0, 4)).map((s, i) =>
                  xmas ? (
                    // At Christmas each sponsor hangs from the garland on a gold string, like an ornament, at its own height.
                    <li key={s.id} className={i % 2 ? "pt-2" : ""}>
                      <div className="xmas-sway" style={{ animationDelay: `-${(i * 1.3) % 5}s` }}>
                        <span className={`mx-auto block w-px bg-gradient-to-b from-[#D9B53F] to-[#9A7B12] ${i % 2 ? "h-16" : "h-9"}`} aria-hidden />
                        <SponsorBox s={s} className="relative flex flex-col items-center">
                          <span className="relative z-10 -mb-8">
                            <span className="absolute -top-1.5 left-1/2 h-2 w-3 -translate-x-1/2 rounded-t-[3px] bg-gradient-to-b from-[#E8C85A] to-[#B8921E]" aria-hidden />
                            <SponsorMark s={s} xmas className="h-16 w-16 bg-white text-base" />
                          </span>
                          <span className="flex w-full flex-col items-center gap-0.5 rounded-2xl border border-[#EEDFB0] bg-gradient-to-b from-white to-[#FFFAEC] px-2 pb-3 pt-10 text-center shadow-[0_10px_18px_-12px_rgba(120,80,0,.55)]">
                            <b className="line-clamp-1 w-full text-sm">{s.name}</b>
                            <span className="line-clamp-1 w-full text-xs text-gray-600">{s.what}</span>
                            {s.amount > 0 && <span className="rounded-full bg-[#FDECEE] px-2.5 py-0.5 text-xs font-bold text-[#B3202B]">{formatPeso(s.amount).replace(".00", "")}</span>}
                            <LinkHint link={s.link} dark />
                          </span>
                        </SponsorBox>
                      </div>
                    </li>
                  ) : (
                    <li key={s.id}>
                      <SponsorBox s={s} className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-2.5 text-center">
                        <SponsorMark s={s} className="h-14 w-14 rounded-2xl bg-brand-light text-base" />
                        <b className="line-clamp-1 text-sm">{s.name}</b>
                        <span className="line-clamp-1 text-xs text-gray-600">{s.what}</span>
                        {s.amount > 0 && <span className="text-xs font-bold text-brand">{formatPeso(s.amount).replace(".00", "")}</span>}
                        <LinkHint link={s.link} />
                      </SponsorBox>
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
          {!full && others.length > 4 && <Link href="/raffle" className="block text-center text-sm font-bold text-brand">Tingnan ang lahat ({shown.length})</Link>}
        </>
      )}

      {user ? (
        <Button full variant="primary" className={xmas ? "!bg-[#0F4A36]" : ""} onClick={() => setDonating(true)}>Magdonate o maging sponsor</Button>
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
  const [logo, setLogo] = useState("");
  const [link, setLink] = useState("");
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
      await pledgeDonation(uid, { name, anon, kind, what: kind === "Pera" ? `₱${value.toLocaleString("en-PH")}` : what, amount: value, contact, message, logo, link });
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
      {!anon && (
        <div className="space-y-1">
          <LogoPicker logo={logo} onChange={setLogo} label="Maglagay ng logo ng negosyo (optional)" />
          <p className="text-xs text-gray-500">Lalabas ang logo sa listahan ng sponsor kapag natanggap na ng Barangay ang donasyon mo.</p>
          <Input label="Facebook page o website ng negosyo (optional)" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} placeholder="hal. facebook.com/omegaice" inputMode="url" hint="Kapag pinindot ng tao ang sponsor mo sa listahan, doon sila dadalhin." />
        </div>
      )}
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
            <p className="text-xs text-gray-500">{DONOR_LABEL[d.status]}{d.receiptNo ? ` · ${d.receiptNo}` : ""}</p>
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
