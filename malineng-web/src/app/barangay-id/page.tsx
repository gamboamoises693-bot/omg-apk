"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { collection, doc, getDoc, query, where } from "firebase/firestore";
import { Printer, ShieldAlert } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/activity";
import { BARANGAY_CITY } from "@/lib/constants";
import { LogoMark } from "@/components/BarangayLogo";
import { Button, PageHeader, Spinner } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";

/** MLN-2026-3F9K2A: registration year + start of the uid (stable, unique enough to read aloud). */
function barangayIdNo(uid: string, year: number): string {
  return `MLN-${year}-${uid.slice(0, 6).toUpperCase()}`;
}

function IdCard() {
  const { user, profile, isStaff } = useAuth();
  const [selfie, setSelfie] = useState<string | null>(null);
  const [flag, setFlag] = useState<boolean | null>(null);
  const [qr, setQr] = useState("");

  const sectorsQ = useMemo(() => (user ? query(collection(db, "sectorMembers"), where("userId", "==", user.uid)) : null), [user]);
  const { data: sectorDocs } = useCollection<{ id: string; sectors: string[] }>(sectorsQ);
  const sectors = [...new Set(sectorDocs.flatMap((s) => s.sectors))];

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "verifications", user.uid))
      .then((s) => setSelfie((s.data()?.selfie as string) ?? ""))
      .catch(() => setSelfie(""));
    getDoc(doc(db, "verifiedUsers", user.uid))
      .then((s) => setFlag(s.exists()))
      .catch(() => setFlag(false));
    QRCode.toDataURL(`${window.location.origin}/id-check/?u=${user.uid}`, { margin: 1, width: 300, errorCorrectionLevel: "M" }).then(setQr, () => setQr(""));
  }, [user]);

  if (!user || !profile || selfie === null || flag === null) return <Spinner />;

  const year = profile.createdAt?.toDate().getFullYear() ?? new Date().getFullYear();
  const idNo = barangayIdNo(user.uid, year);

  return (
    <div>
      {!flag && (
        <p className="no-print mb-3 flex items-start gap-2 rounded-2xl bg-gold-light p-3 text-sm text-yellow-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {isStaff
              ? "Wala pang selfie at verified flag ang account mo, kaya \"HINDI VALID\" ang lalabas sa QR. "
              : "Hindi pa naka-verify ang account mo, kaya \"HINDI VALID\" ang lalabas kapag na-scan. "}
            <Link href="/verify" className="font-bold underline">Kumuha ng selfie →</Link>
          </span>
        </p>
      )}

      {/* The card: navy with gold accents */}
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
              <img src={selfie} alt={`Litrato ni ${profile.fullName}`} className="h-32 w-[6.25rem] shrink-0 rounded-xl object-cover ring-2 ring-gold" />
            ) : (
              <span className="flex h-32 w-[6.25rem] shrink-0 items-center justify-center rounded-xl bg-white/10 text-center text-[0.65rem] text-white/70 ring-2 ring-gold/60">Walang litrato</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/60">Pangalan</p>
              <p className="text-lg font-extrabold uppercase leading-tight tracking-tight">{profile.fullName}</p>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>
                  <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/60">Purok</dt>
                  <dd className="text-sm font-bold">{profile.purok || "—"}</dd>
                </div>
                {profile.birthday && (
                  <div>
                    <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/60">Kaarawan</dt>
                    <dd className="text-sm font-bold">{formatDate(profile.birthday)}</dd>
                  </div>
                )}
              </dl>
              {(profile.role !== "resident" || sectors.length > 0) && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {profile.role !== "resident" && (
                    <span className="rounded-full border border-gold/70 px-2 py-0.5 text-[0.6rem] font-black tracking-wide text-gold">{roleLabel(profile.role, profile.position).toUpperCase()}</span>
                  )}
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
              <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black tracking-wide ${flag ? "bg-gold text-brand-deep" : "bg-white/15 text-white"}`}>
                {flag ? "✓ VERIFIED" : "HINDI PA VERIFIED"}
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

      <div className="no-print mx-auto mt-4 max-w-sm space-y-2">
        <Button full onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> I-print / I-save bilang PDF
        </Button>
        <p className="text-center text-xs text-gray-500">Pwede ring i-screenshot at ipakita sa phone.</p>
      </div>
    </div>
  );
}

export default function BarangayIdPage() {
  return (
    <div>
      <div className="no-print">
        <PageHeader title="Barangay ID ko" subtitle="Ipakita sa tanod, health center o munisipyo" />
      </div>
      <RequireVerified feature="magkaroon ng Barangay ID">
        <IdCard />
      </RequireVerified>
    </div>
  );
}
