"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/activity";
import { useCaptainSignature } from "@/lib/signature";
import { BarangayIdCard } from "@/components/BarangayIdCard";
import { Button, PageHeader, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";

/** Most people on one request: three full A4 pages of the small size. */
const MAX_IDS = 27;
const PX_PER_MM = 96 / 25.4;
const CARD_W = 384; // the natural width of the card (max-w-sm)

interface Person {
  uid: string;
  name: string;
  purok: string;
  birthday: string;
  sex: string;
  civilStatus: string;
  idNo: string;
  selfie: string;
  verified: boolean;
  roleText?: string;
  sectors: string[];
  qr: string;
}

/**
 * Several Barangay IDs on one sheet, to save paper: 9 small ones (3 × 3) or 4 bigger ones (2 × 2) on each A4 page,
 * with a dashed cutting line around each. Admins pick the people in Admin → I-print ang mga ID.
 */
function Sheet() {
  const params = useSearchParams();
  const { isAdmin, loading } = useAuth();
  const captain = useCaptainSignature();
  const ids = useMemo(() => (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_IDS), [params]);
  const per = params.get("per") === "4" ? 4 : 9;
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin || ids.length === 0) return;
    let live = true;
    (async () => {
      try {
        // Sector tags (Senior, PWD...) come in groups of 10 people.
        const sectors = new Map<string, string[]>();
        for (let i = 0; i < ids.length; i += 10) {
          const snap = await getDocs(query(collection(db, "sectorMembers"), where("userId", "in", ids.slice(i, i + 10)))).catch(() => null);
          snap?.docs.forEach((d) => {
            const v = d.data() as { userId: string; sectors?: string[] };
            sectors.set(v.userId, [...new Set([...(sectors.get(v.userId) ?? []), ...(v.sectors ?? [])])]);
          });
        }
        const out: Person[] = [];
        for (const uid of ids) {
          const [u, v, f] = await Promise.all([getDoc(doc(db, "users", uid)), getDoc(doc(db, "verifications", uid)), getDoc(doc(db, "verifiedUsers", uid))]);
          const ud = u.data();
          if (!ud) continue;
          out.push({
            uid,
            name: String(ud.fullName ?? ""),
            purok: String(ud.purok ?? ""),
            birthday: String(ud.birthday ?? ""),
            sex: String(ud.sex ?? ""),
            civilStatus: String(ud.civilStatus ?? ""),
            idNo: String(ud.idNo ?? "") || "Wala pang ID no.",
            selfie: String(v.data()?.selfie ?? ""),
            verified: f.exists() || ud.role === "admin" || ud.role === "superadmin",
            roleText: ud.role && ud.role !== "resident" ? roleLabel(ud.role, ud.position).toUpperCase() : undefined,
            sectors: sectors.get(uid) ?? [],
            qr: await QRCode.toDataURL(`${window.location.origin}/id-check/?u=${uid}`, { margin: 1, width: 300, errorCorrectionLevel: "M" }),
          });
        }
        if (live) setPeople(out);
      } catch (err) {
        console.warn("[id print] failed:", err);
        if (live) setError("Hindi ma-load ang mga ID. Subukan ulit.");
      }
    })();
    return () => {
      live = false;
    };
  }, [isAdmin, ids]);

  if (loading) return <Spinner />;
  if (!isAdmin) return <p className="rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-700">Para sa Barangay Admin lang ang page na ito.</p>;
  if (ids.length === 0) return <p className="rounded-2xl bg-white p-5 text-center text-sm text-gray-600 shadow-card">Walang napiling ID. Pumunta sa Admin → I-print ang mga ID at pumili.</p>;
  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>;
  if (!people) return <Spinner label="Inihahanda ang mga ID..." />;

  // Cell size in mm: 9 per page = 3 × 3 small cards, 4 per page = 2 × 2 big cards.
  const cell = per === 9 ? { w: 58, h: 88 } : { w: 90, h: 130 };
  const scale = (cell.w * PX_PER_MM) / CARD_W;
  const pages: Person[][] = [];
  for (let i = 0; i < people.length; i += per) pages.push(people.slice(i, i + per));

  return (
    <div>
      <div className="no-print space-y-3 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/barangay-id/print/?ids=${ids.join(",")}&per=9`} replace className={`rounded-xl border py-2.5 text-center text-sm font-bold ${per === 9 ? "border-brand bg-brand-light text-brand" : "border-gray-200 bg-white text-gray-600"}`}>9 sa isang A4 (maliit)</Link>
          <Link href={`/barangay-id/print/?ids=${ids.join(",")}&per=4`} replace className={`rounded-xl border py-2.5 text-center text-sm font-bold ${per === 4 ? "border-brand bg-brand-light text-brand" : "border-gray-200 bg-white text-gray-600"}`}>4 sa isang A4 (malaki)</Link>
        </div>
        <Button full onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> I-print ang {people.length} ID ({pages.length} pahina)</Button>
        <p className="text-center text-xs text-gray-500">Piliin ang <b>A4</b>, <b>Portrait</b>, at <b>Scale: 100%</b> sa print dialog. Gupitin sa putol-putol na guhit. Ang kulay ay para sa ivory na papel o puting papel.</p>
        <Link href="/admin/#idprint" className="block text-center text-sm font-bold text-brand underline">← Bumalik sa listahan</Link>
      </div>

      <div className="id-sheets">
        {pages.map((page, pi) => (
          <div key={pi} className="id-page" style={{ gridTemplateColumns: `repeat(${per === 9 ? 3 : 2}, ${cell.w}mm)`, gridAutoRows: `${cell.h}mm` }}>
            {page.map((p) => (
              <div key={p.uid} className="id-cell" style={{ width: `${cell.w}mm`, height: `${cell.h}mm` }}>
                <div style={{ width: CARD_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <BarangayIdCard idNo={p.idNo} name={p.name} purok={p.purok} birthday={p.birthday} sex={p.sex} civilStatus={p.civilStatus} selfie={p.selfie} verified={p.verified} roleText={p.roleText} sectors={p.sectors} qr={p.qr} signature={captain.image} captainName={captain.name} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IdPrintPage() {
  return (
    <div>
      <div className="no-print">
        <PageHeader title="I-print ang mga ID" subtitle="Marami sa isang papel" />
      </div>
      <LoginGate message="Mag-login bilang admin para mag-print ng mga ID.">
        <Suspense fallback={<Spinner />}>
          <Sheet />
        </Suspense>
      </LoginGate>
    </div>
  );
}
