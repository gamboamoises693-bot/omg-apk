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
import { linkHost, messengerLink } from "@/lib/links";

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

/** "Messenger" button for a sponsor whose link is a Facebook page: opens their chat (m.me/page-name) in a new tab. */
function MessengerButton({ name, link, className = "", compact = false }: { name: string; link?: string; className?: string; compact?: boolean }) {
  const m = link ? messengerLink(link) : "";
  if (!m) return null;
  return (
    <a
      href={m}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`Mag-chat sa ${name} sa Messenger`}
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#0A7CFF] font-extrabold text-white shadow-sm active:scale-95 ${compact ? "p-1.5" : "px-3 py-1.5 text-[0.7rem]"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden>
        <path d="M12 2C6.5 2 2 6.2 2 11.5c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.9.2 1.9.4 3.1.4 5.5 0 10-4.2 10-9.5S17.5 2 12 2zm1 12.8-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7z" />
      </svg>
      {!compact && "Messenger"}
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

/** Tier by amount: Ginto from ₱4,000, Pilak from ₱2,000, everyone else (including anonymous donors) is a Kaibigan ng Barangay. */
export const TIERS = ["Ginto", "Pilak", "Kaibigan ng Barangay"] as const;
type Tier = (typeof TIERS)[number];
export function sponsorTier(amount: number): Tier {
  if (amount >= 4000) return "Ginto";
  if (amount >= 2000) return "Pilak";
  return "Kaibigan ng Barangay";
}

type ListSponsor = { id: string; name: string; what: string; amount: number; logo?: string; link?: string };
const PAGE = 12;

/** Compact, searchable list for when there are many sponsors: tier chips, one line per sponsor, 12 more per tap. */
function SponsorDirectory({ list, xmas }: { list: ListSponsor[]; xmas: boolean }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | Tier>("all");
  const [count, setCount] = useState(PAGE);
  const counts = useMemo(() => {
    const c: Record<Tier, number> = { Ginto: 0, Pilak: 0, "Kaibigan ng Barangay": 0 };
    list.forEach((s) => { c[sponsorTier(s.amount)]++; });
    return c;
  }, [list]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((s) => (tier === "all" || sponsorTier(s.amount) === tier) && (!needle || s.name.toLowerCase().includes(needle) || s.what.toLowerCase().includes(needle)));
  }, [list, q, tier]);
  const visible = filtered.slice(0, count);
  const chip = (active: boolean) => `shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${active ? (xmas ? "bg-[#0F4A36] text-white" : "bg-brand text-white") : "bg-white text-gray-600 ring-1 ring-gray-200"}`;

  return (
    <div className="space-y-2" data-no-i18n>
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setCount(PAGE); }}
        placeholder="Hanapin ang sponsor o donor…"
        aria-label="Hanapin ang sponsor o donor"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button type="button" onClick={() => { setTier("all"); setCount(PAGE); }} className={chip(tier === "all")}>Lahat ({list.length})</button>
        {TIERS.map((t) => (
          <button key={t} type="button" onClick={() => { setTier(t); setCount(PAGE); }} className={chip(tier === t)}>{t} ({counts[t]})</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl bg-surface p-3 text-center text-sm text-gray-500">Walang nahanap.</p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 rounded-xl p-2 ${xmas ? "border border-[#EEDFB0] bg-white" : "bg-surface"}`}>
              <SponsorBox s={s} className="flex min-w-0 flex-1 items-center gap-2">
                <SponsorMark s={s} className={`h-10 w-10 rounded-xl text-xs ${xmas ? "bg-white" : "bg-brand-light"}`} />
                <span className="min-w-0">
                  <b className="block truncate text-sm">{s.name}</b>
                  <span className="block truncate text-xs text-gray-600">{s.what}</span>
                </span>
              </SponsorBox>
              {s.amount > 0 && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${xmas ? "bg-[#FDECEE] text-[#B3202B]" : "bg-brand-light text-brand"}`}>{formatPeso(s.amount).replace(".00", "")}</span>}
              <MessengerButton name={s.name} link={s.link} compact className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
      {filtered.length > count && (
        <button type="button" onClick={() => setCount((c) => c + PAGE)} className="w-full rounded-xl border-2 border-dashed border-gray-300 py-2 text-sm font-bold text-gray-600 active:scale-[0.99]">
          Ipakita pa ({Math.min(PAGE, filtered.length - count)} pa, natitira ang {filtered.length - count})
        </button>
      )}
    </div>
  );
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
  // With many sponsors (9+) on the full page, only the top 3 by amount hang; the rest go to a searchable list.
  // Array.sort is stable, so equal amounts keep the newest sponsor first.
  const many = full && others.length > 8;
  const byAmount = useMemo(() => (many ? [...others].sort((a, b) => (b.amount || 0) - (a.amount || 0)) : others), [many, others]);
  const hanging = many ? byAmount.slice(0, 3) : full ? others : others.slice(0, 4);
  const rest = many ? byAmount.slice(3) : [];
  const compact = many;
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
            <div key={s.id} className={`relative ${xmas ? "mt-5" : ""}`}>
            <SponsorBox s={s} className={`relative flex items-center gap-3 rounded-2xl bg-gradient-to-b from-gold-light to-[#EAD27A] p-3 text-[#3B2E05] shadow-[0_8px_18px_-10px_rgba(120,80,0,.6)] ${xmas ? "pt-8 ring-1 ring-[#E0B94A]" : ""} ${messengerLink(s.link ?? "") ? "pr-28" : ""}`}>
              {xmas && <XmasStar className="absolute -top-4 left-1/2 h-9 w-9 -translate-x-1/2 fill-[#B3202B] drop-shadow-[0_2px_0_rgba(0,0,0,.25)]" />}
              <SponsorMark s={s} xmas={xmas} className="h-14 w-14 rounded-2xl bg-white text-lg" />
              <span className="min-w-0">
                <span className="block text-[0.65rem] font-extrabold tracking-wider">PANGUNAHING SPONSOR</span>
                <b className="block truncate">{s.name}</b>
                <span className="block text-xs">{s.what}{s.amount ? ` · ${formatPeso(s.amount).replace(".00", "")}` : ""}</span>
                <LinkHint link={s.link} dark />
              </span>
            </SponsorBox>
            <MessengerButton name={s.name} link={s.link} className="absolute bottom-3 right-3" />
            </div>
          ))}
          {hanging.length > 0 && (
            <>
              {xmas && <XmasGarland />}
              <ul className={`grid ${compact ? "grid-cols-3" : "grid-cols-2"} ${xmas ? "items-start gap-x-3 gap-y-3" : "gap-2"}`} style={xmas ? { marginTop: "-1.1rem" } : undefined}>
                {hanging.map((s, i) =>
                  xmas ? (
                    // At Christmas each sponsor hangs from the garland on a gold string, like an ornament, at its own height.
                    <li key={s.id} className={i % 2 ? "pt-2" : ""}>
                      <div className="xmas-sway" style={{ animationDelay: `-${(i * 1.3) % 5}s` }}>
                        <span className={`mx-auto block w-px bg-gradient-to-b from-[#D9B53F] to-[#9A7B12] ${i % 2 ? "h-16" : "h-9"}`} aria-hidden />
                        <div className="relative">
                        <SponsorBox s={s} className="relative flex flex-col items-center">
                          <span className={`relative z-10 ${compact ? "-mb-6" : "-mb-8"}`}>
                            <span className="absolute -top-1.5 left-1/2 h-2 w-3 -translate-x-1/2 rounded-t-[3px] bg-gradient-to-b from-[#E8C85A] to-[#B8921E]" aria-hidden />
                            <SponsorMark s={s} xmas className={`bg-white text-base ${compact ? "h-12 w-12" : "h-16 w-16"}`} />
                          </span>
                          <span className={`flex w-full flex-col items-center gap-0.5 rounded-2xl border border-[#EEDFB0] bg-gradient-to-b from-white to-[#FFFAEC] px-2 text-center shadow-[0_10px_18px_-12px_rgba(120,80,0,.55)] ${compact ? "pt-8" : "pt-10"} ${messengerLink(s.link ?? "") ? (compact ? "pb-10" : "pb-12") : "pb-3"}`}>
                            <b className="line-clamp-1 w-full text-sm">{s.name}</b>
                            <span className="line-clamp-1 w-full text-xs text-gray-600">{s.what}</span>
                            {s.amount > 0 && <span className="rounded-full bg-[#FDECEE] px-2.5 py-0.5 text-xs font-bold text-[#B3202B]">{formatPeso(s.amount).replace(".00", "")}</span>}
                            <LinkHint link={s.link} dark />
                          </span>
                        </SponsorBox>
                        <MessengerButton name={s.name} link={s.link} compact={compact} className="absolute bottom-3 left-1/2 -translate-x-1/2" />
                        </div>
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
                      <MessengerButton name={s.name} link={s.link} compact={compact} className="mt-1.5 w-full justify-center" />
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
          {rest.length > 0 && <SponsorDirectory list={rest} xmas={xmas} />}
          {!full && others.length > 4 && <Link href="/raffle" className="block text-center text-sm font-bold text-brand">Tingnan ang lahat ({shown.length})</Link>}
        </>
      )}

      {user ? (
        <Button full variant="primary" className={xmas ? "!bg-[#0F4A36]" : ""} onClick={() => setDonating(true)}>Magdonate o maging sponsor</Button>
      ) : (
        <Link href="/login" className="block rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white">Mag-login para magdonate</Link>
      )}
      <p className="text-center text-xs text-gray-500">Hindi dito kinukuha ang pera. Mangangako ka lang; ang Barangay ang tatawag. Pwedeng dalhin mo sa Barangay Hall o kunin nila sa bahay mo, at bibigyan ka ng resibo at <b>Certificate of Appreciation</b>.</p>

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
  const [handover, setHandover] = useState<"hall" | "pickup">("hall");
  const [pickupAddress, setPickupAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Math.round(Number(amount) || 0);
    if (name.trim().length < 2) return setError("Ilagay ang pangalan o negosyo.");
    if (kind === "Pera" && value <= 0) return setError("Ilagay ang halaga.");
    if (kind !== "Pera" && !what.trim()) return setError("Isulat kung ano ang ibibigay.");
    if (contact.trim().length < 7) return setError("Ilagay ang numero na pwedeng tawagan.");
    if (handover === "pickup" && pickupAddress.trim().length < 5) return setError("Ilagay ang address kung saan kukunin ang donasyon.");
    setBusy(true);
    setError("");
    try {
      await pledgeDonation(uid, { name, anon, kind, what: kind === "Pera" ? `₱${value.toLocaleString("en-PH")}` : what, amount: value, contact, message, logo, link, handover, pickupAddress });
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
      <fieldset className="space-y-2 rounded-xl bg-brand-light p-3 text-sm text-brand-deep">
        <legend className="px-1 text-xs font-extrabold uppercase tracking-wide">Paano ibibigay</legend>
        {([["hall", "Dadalhin ko sa Barangay Hall"], ["pickup", "Pakikuha sa bahay namin"]] as const).map(([v, label]) => (
          <label key={v} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 font-bold ${handover === v ? "border-brand bg-white" : "border-transparent bg-white/60"}`}>
            <input type="radio" name="handover" checked={handover === v} onChange={() => setHandover(v)} /> {label}
          </label>
        ))}
        {handover === "pickup" && <Input label="Address kung saan kukunin" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} maxLength={200} placeholder="hal. #12, Purok 3, tabi ng kapilya" />}
        <p className="text-xs">Tatawagan ka ng Barangay para sa oras. Bibigyan ka ng <b>resibo</b> at <b>Certificate of Appreciation</b> na makikita mo rin dito sa app.</p>
      </fieldset>
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
          {d.status === "received" && (
            <Link href={`/raffle/sertipiko/?id=${d.id}`} className="flex shrink-0 items-center gap-1 rounded-xl border border-gold bg-gold-light px-3 py-1.5 text-xs font-bold text-yellow-900">
              Certificate
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
