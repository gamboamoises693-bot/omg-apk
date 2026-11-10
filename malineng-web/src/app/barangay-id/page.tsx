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

      {/* The card */}
      <section className="mx-auto max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-float print:shadow-none" aria-label="Barangay ID">
        <div className="flex items-center gap-2">
          <LogoMark size="h-9 w-9" textClass="text-sm" />
          <div className="leading-tight">
            <p className="text-[0.8rem] font-black tracking-wide">BARANGAY MALINENG</p>
            <p className="text-[0.68rem] text-white/80">{BARANGAY_CITY}</p>
          </div>
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[0.6rem] font-bold">RESIDENT ID</span>
        </div>
        <div className="mt-3 flex gap-3">
          {selfie ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfie} alt={`Litrato ni ${profile.fullName}`} className="h-28 w-[5.5rem] shrink-0 rounded-xl object-cover ring-2 ring-white/40" />
          ) : (
            <span className="flex h-28 w-[5.5rem] shrink-0 items-center justify-center rounded-xl bg-white/15 text-center text-[0.65rem] text-white/80">Walang litrato</span>
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="text-base font-extrabold uppercase leading-tight">{profile.fullName}</p>
            <p className="text-xs text-white/85">{profile.purok || "—"}</p>
            {profile.birthday && <p className="text-xs text-white/85">Kaarawan: {formatDate(profile.birthday)}</p>}
            <p className="text-xs text-white/85">ID No. {idNo}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ${flag ? "bg-gold text-brand-deep" : "bg-white/20"}`}>{flag ? "✓ VERIFIED" : "HINDI PA VERIFIED"}</span>
              {profile.role !== "resident" && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.62rem] font-black">{roleLabel(profile.role, profile.position).toUpperCase()}</span>}
              {sectors.map((s) => (
                <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[0.62rem] font-black text-brand-deep">{s.toUpperCase()}</span>
              ))}
            </div>
          </div>
        </div>
        {qr && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-2.5 text-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR para i-verify ang ID" className="h-24 w-24" />
            <p className="text-[0.7rem] leading-snug">I-scan para makita kung <b>valid</b> ang ID. Live ito: hindi gagana kapag na-suspend ang account.</p>
          </div>
        )}
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
