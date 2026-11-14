"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { collection, doc, getDoc, query, where } from "firebase/firestore";
import { Printer, ShieldAlert } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { roleLabel } from "@/lib/activity";
import { BarangayIdCard, barangayIdNo } from "@/components/BarangayIdCard";
import { IdPhotoUpload } from "@/components/IdPhotoUpload";
import { Button, PageHeader, Spinner } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";

function IdCard() {
  const { user, profile, isStaff, isSuperAdmin } = useAuth();
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

      <BarangayIdCard
        idNo={idNo}
        name={profile.fullName}
        purok={profile.purok}
        birthday={profile.birthday}
        selfie={selfie}
        verified={flag}
        roleText={profile.role !== "resident" ? roleLabel(profile.role, profile.position).toUpperCase() : undefined}
        sectors={sectors}
        qr={qr}
      />

      <div className="no-print mx-auto mt-4 max-w-sm space-y-2">
        <Button full onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> I-print / I-save bilang PDF
        </Button>
        <p className="text-center text-xs text-gray-500">Pwede ring i-screenshot at ipakita sa phone.</p>
        {isSuperAdmin && <IdPhotoUpload uid={user.uid} name={profile.fullName} onSaved={setSelfie} />}
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
