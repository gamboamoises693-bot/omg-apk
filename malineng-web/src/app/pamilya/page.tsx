"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Plus, Trash2, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { usePuroks } from "@/lib/useSettings";
import { HOUSEHOLD_RELATIONS } from "@/lib/constants";
import { logActivity } from "@/lib/activity";
import { ageFrom } from "@/lib/age";
import { friendlyError } from "@/lib/format";
import type { HouseholdMember } from "@/lib/types";
import { Button, Card, ErrorText, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

const EMPTY_MEMBER: HouseholdMember = { name: "", relation: "Anak", birthday: "", sex: "Lalaki" };

function HouseholdForm() {
  const { user, profile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [purok, setPurok] = useState("");
  const [address, setAddress] = useState("");
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "households", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setPurok(d.purok ?? "");
          setAddress(d.address ?? "");
          setMembers((d.members as HouseholdMember[]) ?? []);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [user]);

  useEffect(() => {
    if (profile?.purok) setPurok((p) => p || profile.purok);
  }, [profile?.purok]);

  if (!loaded || !profile) return <Spinner />;

  const setMember = (i: number, patch: Partial<HouseholdMember>) => setMembers((list) => list.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const save = async () => {
    if (!user) return;
    if (!purok) return setError("Pumili ng purok.");
    const clean = members.map((m) => ({ ...m, name: m.name.trim().slice(0, 120) })).filter((m) => m.name);
    setBusy(true);
    setError("");
    try {
      await setDoc(doc(db, "households", user.uid), {
        headName: profile.fullName,
        purok,
        address: address.trim().slice(0, 200),
        members: clean,
        updatedAt: serverTimestamp(),
      });
      setMembers(clean);
      logActivity("Pamilya", `Nag-update ng household: ${clean.length + 1} katao (${purok})`, user.uid);
      toast("Na-save ang impormasyon ng pamilya.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-gray-600">Para sa census at mas mabilis na ayuda. Admin ng Barangay lang ang makakakita nito.</p>
        <div className="rounded-xl bg-brand-light p-3 text-sm">
          <p className="font-bold text-brand">Puno ng pamilya: {profile.fullName}</p>
          <p className="text-gray-600">Ikaw (ang may-ari ng account)</p>
        </div>
        <Select label="Purok" options={puroks} placeholder="-- Pumili --" value={purok} onChange={(e) => setPurok(e.target.value)} />
        <Input label="Address (optional)" placeholder="Hal. #12, tabi ng kapilya" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
      </Card>

      <p className="flex items-center gap-1 font-bold"><Users className="h-4 w-4" /> Mga kasama sa bahay ({members.length})</p>
      {members.map((m, i) => {
        const age = ageFrom(m.birthday);
        return (
          <Card key={i} className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label={`Miyembro #${i + 1}`} placeholder="Buong pangalan" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} />
              </div>
              <button onClick={() => setMembers((list) => list.filter((_, j) => j !== i))} className="mb-1.5 rounded-full p-2 text-red-600" aria-label="Tanggalin">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Kaugnayan" options={HOUSEHOLD_RELATIONS} value={m.relation} onChange={(e) => setMember(i, { relation: e.target.value })} />
              <Select label="Kasarian" options={["Lalaki", "Babae"]} value={m.sex} onChange={(e) => setMember(i, { sex: e.target.value as HouseholdMember["sex"] })} />
            </div>
            <Input label="Birthday" type="date" value={m.birthday} onChange={(e) => setMember(i, { birthday: e.target.value })} hint={age !== null ? `${age} taong gulang${age >= 60 ? " · Senior" : age < 18 ? " · Menor de edad" : ""}` : undefined} />
          </Card>
        );
      })}
      {members.length < 20 && (
        <Button variant="outline" full onClick={() => setMembers((list) => [...list, { ...EMPTY_MEMBER }])}>
          <Plus className="h-4 w-4" /> Magdagdag ng miyembro
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>I-save</Button>
    </div>
  );
}

export default function PamilyaPage() {
  return (
    <div>
      <PageHeader title="Pamilya ko" subtitle="Household information" />
      <LoginGate message="Mag-login para mailagay ang impormasyon ng pamilya mo.">
        <HouseholdForm />
      </LoginGate>
    </div>
  );
}
