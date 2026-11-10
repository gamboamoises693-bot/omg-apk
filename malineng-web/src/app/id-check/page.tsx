"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { BadgeCheck, ShieldX } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, PageHeader, Spinner } from "@/components/ui";

interface StaffView {
  selfie: string;
  purok: string;
  birthday: string;
}

/**
 * Opened by scanning the QR on a Barangay ID.
 * Public: only the name and whether the ID is valid (verifiedUsers/{uid} exists; it is
 * removed when an account is suspended). Logged-in staff also see the photo and purok.
 */
function Check() {
  const uid = useSearchParams().get("u") ?? "";
  const { isStaff, loading: authLoading } = useAuth();
  const [state, setState] = useState<"loading" | "valid" | "invalid">("loading");
  const [name, setName] = useState("");
  const [staffView, setStaffView] = useState<StaffView | null>(null);

  useEffect(() => {
    if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) return setState("invalid");
    getDoc(doc(db, "verifiedUsers", uid))
      .then((s) => {
        setName((s.data()?.name as string) ?? "");
        setState(s.exists() ? "valid" : "invalid");
      })
      .catch(() => setState("invalid"));
  }, [uid]);

  useEffect(() => {
    if (authLoading || !isStaff || state !== "valid") return;
    Promise.all([getDoc(doc(db, "verifications", uid)), getDoc(doc(db, "users", uid))])
      .then(([v, u]) => setStaffView({ selfie: (v.data()?.selfie as string) ?? "", purok: (u.data()?.purok as string) ?? "", birthday: (u.data()?.birthday as string) ?? "" }))
      .catch(() => setStaffView(null));
  }, [authLoading, isStaff, state, uid]);

  if (state === "loading") return <Spinner label="Sinusuri ang ID..." />;

  if (state === "invalid") {
    return (
      <Card className="text-center">
        <ShieldX className="mx-auto mb-2 h-12 w-12 text-red-600" />
        <p className="text-lg font-extrabold text-red-700">HINDI VALID</p>
        <p className="text-sm text-gray-600">Hindi verified o naka-suspend ang may-ari ng ID na ito. Makipag-ugnayan sa Barangay Hall.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 text-center">
      <BadgeCheck className="mx-auto h-12 w-12 text-emerald-600" />
      <p className="text-lg font-extrabold text-emerald-700">VALID · Residente ng Malineng</p>
      <p className="text-xl font-extrabold uppercase">{name}</p>
      {staffView?.selfie && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={staffView.selfie} alt={`Litrato ni ${name}`} className="mx-auto h-40 w-32 rounded-xl object-cover" />
      )}
      {staffView && (
        <p className="text-sm text-gray-600">
          {staffView.purok || "—"}
          {staffView.birthday ? ` · ${staffView.birthday}` : ""}
        </p>
      )}
      <p className="text-xs text-gray-500">
        {isStaff ? "Ikumpara ang litrato sa taong may hawak ng ID." : "Ikumpara ang pangalan at litrato sa ID na ipinakita."}
      </p>
    </Card>
  );
}

export default function IdCheckPage() {
  return (
    <div>
      <PageHeader title="Pagsuri ng Barangay ID" />
      <Suspense fallback={<Spinner />}>
        <Check />
      </Suspense>
    </div>
  );
}
