import { formatDate } from "@/lib/format";
import { BARANGAY_CITY } from "@/lib/constants";
import { LogoMark } from "@/components/BarangayLogo";

/**
 * The Barangay ID card: ivory paper, navy ink and gold lines (it prints well on ivory paper).
 * Used on the resident's own ID page and when an admin checks a raffle winner.
 * The Punong Barangay's signature (uploaded by the Developer) is printed above the name; the owner's line is left blank to be signed.
 */
export function BarangayIdCard({
  idNo,
  name,
  purok,
  birthday,
  sex,
  civilStatus,
  selfie,
  verified,
  roleText,
  sectors = [],
  qr,
  signature,
  captainName,
}: {
  idNo: string;
  name: string;
  purok: string;
  birthday?: string;
  sex?: string;
  civilStatus?: string;
  selfie: string;
  verified: boolean;
  /** "KAPITAN", "SUPER ADMIN"... for officials; leave out for residents. */
  roleText?: string;
  sectors?: string[];
  qr?: string;
  /** PNG data URL of the Punong Barangay's signature (transparent background), or "". */
  signature?: string;
  captainName?: string;
}) {
  const fact = (label: string, value?: string) => (
    <div>
      <dt className="text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[#5F6A7E]">{label}</dt>
      <dd className="text-sm font-bold text-[#0B2B57]">{value || "—"}</dd>
    </div>
  );
  return (
    <section
      className="relative mx-auto max-w-sm overflow-hidden rounded-3xl bg-[#FBF6E6] text-[#0B2B57] shadow-float ring-1 ring-[#B8921E]/60 print:shadow-none"
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        backgroundImage:
          "radial-gradient(120% 70% at 100% 0%, rgba(217,182,72,0.22) 0%, rgba(217,182,72,0) 60%), radial-gradient(90% 60% at 0% 100%, rgba(11,43,87,0.06) 0%, rgba(11,43,87,0) 60%)",
      }}
      aria-label="Barangay ID"
    >
      {/* Gold edge */}
      <div className="h-[7px] bg-gradient-to-r from-[#9A7B12] via-[#D9B648] to-[#9A7B12]" />

      <div className="p-5">
        <div className="flex items-center gap-3">
          <LogoMark size="h-11 w-11" textClass="text-base" />
          <div className="min-w-0 leading-tight">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[#B8921E]">Republika ng Pilipinas</p>
            <p className="text-[0.95rem] font-black uppercase tracking-wide">Barangay Malineng</p>
            <p className="text-[0.68rem] text-[#5F6A7E]">{BARANGAY_CITY}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-y border-[#0B2B57]/20 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.25em] text-[#5F6A7E]">
          <span>Resident ID</span>
          <span className="font-black text-[#0B2B57]">{idNo}</span>
        </div>

        <div className="mt-[18px] flex gap-4">
          {selfie ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfie} alt={`Litrato ni ${name}`} className="h-[10.5rem] w-32 shrink-0 rounded-2xl object-cover ring-2 ring-[#D9B648] ring-offset-2 ring-offset-[#FBF6E6]" />
          ) : (
            <span className="flex h-[10.5rem] w-32 shrink-0 items-center justify-center rounded-2xl bg-[#0B2B57]/10 text-center text-[0.65rem] text-[#5F6A7E] ring-2 ring-[#D9B648]">Walang litrato</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-[#5F6A7E]">Pangalan</p>
            <p className="text-[1.3rem] font-extrabold uppercase leading-tight tracking-tight">{name}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
              {fact("Purok", purok)}
              {fact("Kaarawan", birthday ? formatDate(birthday) : "")}
              {fact("Kasarian", sex)}
              {fact("Civil status", civilStatus)}
            </dl>
            {(roleText || sectors.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1">
                {roleText && <span className="rounded-full border border-[#B8921E] bg-[#D9B648]/20 px-2 py-0.5 text-[0.6rem] font-black tracking-wide text-[#7A5C00]">{roleText}</span>}
                {sectors.map((s) => (
                  <span key={s} className="rounded-full bg-[#0B2B57]/10 px-2 py-0.5 text-[0.6rem] font-black tracking-wide">{s.toUpperCase()}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="my-[18px] h-px bg-gradient-to-r from-transparent via-[#B8921E] to-transparent opacity-70" />

        {/* Status + QR */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-[#5F6A7E]">Katayuan</p>
            <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black tracking-wide ${verified ? "bg-[#0B2B57] text-[#F3DE8A]" : "bg-[#0B2B57]/10 text-[#0B2B57]"}`}>
              {verified ? "✓ VERIFIED" : "HINDI PA VERIFIED"}
            </span>
            <p className="mt-2.5 text-[0.6rem] leading-snug tracking-wide text-[#5F6A7E]">I-scan ang QR para<br />i-verify ang ID na ito.</p>
          </div>
          {qr && (
            <div className="rounded-xl bg-white p-1.5 ring-1 ring-[#0B2B57]/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR para i-verify ang ID" className="h-[7.5rem] w-[7.5rem]" />
            </div>
          )}
        </div>

        {/* Signatures: the owner's line stays blank to be signed; the Punong Barangay's signature is printed. */}
        <div className="mt-5 grid grid-cols-2 gap-5 text-center">
          <div>
            <div className="h-[3rem] border-b-[1.5px] border-[#0B2B57]" />
            <p className="mt-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em]">Lagda ng may-ari</p>
          </div>
          <div>
            <div className="flex h-[3rem] items-end justify-center border-b-[1.5px] border-[#0B2B57]">
              {signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signature} alt="Pirma ng Punong Barangay" className="mb-0.5 max-h-[2.8rem] max-w-full object-contain" />
              )}
            </div>
            <p className="mt-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em]">{captainName || "Punong Barangay"}</p>
            {captainName && <p className="text-[0.56rem] tracking-wide text-[#5F6A7E]">Punong Barangay</p>}
          </div>
        </div>
      </div>

      <div className="h-[7px] bg-gradient-to-r from-[#9A7B12] via-[#D9B648] to-[#9A7B12]" />
    </section>
  );
}
