import { formatDate } from "@/lib/format";
import { BARANGAY_CITY } from "@/lib/constants";
import { LogoMark } from "@/components/BarangayLogo";

/** MLN-2026-3F9K2A: registration year + start of the uid (stable, unique enough to read aloud). */
export function barangayIdNo(uid: string, year: number): string {
  return `MLN-${year}-${uid.slice(0, 6).toUpperCase()}`;
}

/** The Barangay ID card: navy with gold accents. Used on the resident's own ID page and when an admin checks a raffle winner. */
export function BarangayIdCard({
  idNo,
  name,
  purok,
  birthday,
  selfie,
  verified,
  roleText,
  sectors = [],
  qr,
}: {
  idNo: string;
  name: string;
  purok: string;
  birthday?: string;
  selfie: string;
  verified: boolean;
  /** "KAPITAN", "SUPER ADMIN"... for officials; leave out for residents. */
  roleText?: string;
  sectors?: string[];
  qr?: string;
}) {
  return (
    <section
      className="relative mx-auto max-w-sm overflow-hidden rounded-3xl bg-[#0B2B57] text-white shadow-float print:shadow-none"
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        backgroundImage:
          "radial-gradient(120% 70% at 100% 0%, rgba(42,111,194,0.55) 0%, rgba(42,111,194,0) 60%), radial-gradient(90% 60% at 0% 100%, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0) 60%)",
      }}
      aria-label="Barangay ID"
    >
      {/* Gold edge */}
      <div className="h-1.5 bg-gradient-to-r from-gold-dark via-gold to-gold-dark" />

      <div className="p-5">
        <div className="flex items-center gap-3">
          <LogoMark size="h-11 w-11" textClass="text-base" />
          <div className="min-w-0 leading-tight">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-gold">Republika ng Pilipinas</p>
            <p className="text-[0.95rem] font-black uppercase tracking-wide">Barangay Malineng</p>
            <p className="text-[0.68rem] text-white/70">{BARANGAY_CITY}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-y border-white/15 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.25em] text-white/80">
          <span>Resident ID</span>
          <span className="text-gold">{idNo}</span>
        </div>

        <div className="mt-4 flex gap-4">
          {selfie ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfie} alt={`Litrato ni ${name}`} className="h-32 w-[6.25rem] shrink-0 rounded-xl object-cover ring-2 ring-gold" />
          ) : (
            <span className="flex h-32 w-[6.25rem] shrink-0 items-center justify-center rounded-xl bg-white/10 text-center text-[0.65rem] text-white/70 ring-2 ring-gold/60">Walang litrato</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/60">Pangalan</p>
            <p className="text-lg font-extrabold uppercase leading-tight tracking-tight">{name}</p>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div>
                <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/60">Purok</dt>
                <dd className="text-sm font-bold">{purok || "—"}</dd>
              </div>
              {birthday && (
                <div>
                  <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/60">Kaarawan</dt>
                  <dd className="text-sm font-bold">{formatDate(birthday)}</dd>
                </div>
              )}
            </dl>
            {(roleText || sectors.length > 0) && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {roleText && <span className="rounded-full border border-gold/70 px-2 py-0.5 text-[0.6rem] font-black tracking-wide text-gold">{roleText}</span>}
                {sectors.map((s) => (
                  <span key={s} className="rounded-full bg-white/15 px-2 py-0.5 text-[0.6rem] font-black tracking-wide">{s.toUpperCase()}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status + QR */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/60">Katayuan</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black tracking-wide ${verified ? "bg-gold text-brand-deep" : "bg-white/15 text-white"}`}>
              {verified ? "✓ VERIFIED" : "HINDI PA VERIFIED"}
            </span>
          </div>
          {qr && (
            <div className="rounded-xl bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR para i-verify ang ID" className="h-24 w-24" />
            </div>
          )}
        </div>
      </div>

      <div className="h-1.5 bg-gradient-to-r from-gold-dark via-gold to-gold-dark" />
    </section>
  );
}
