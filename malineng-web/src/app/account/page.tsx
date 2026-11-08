"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, query, updateDoc, where } from "firebase/firestore";
import { CalendarCheck, LogOut, ShieldCheck, Store, Trash2, UserRound, Briefcase } from "lucide-react";
import { db } from "@/lib/firebase";
import { ensureUserDoc, useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { formatPeso, friendlyError, sortNewest } from "@/lib/format";
import type { Job, Listing } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Input, LinkButton, PageHeader, SectionTitle, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/components/Toast";

const STATUS_BADGE = {
  pending: { label: "Naghihintay", color: "gold" },
  approved: { label: "Approved", color: "green" },
  rejected: { label: "Rejected", color: "red" },
} as const;

function ProfileForm() {
  const { user, profile, needsProfile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: "", purok: "", contact: "", birthday: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm({ fullName: profile.fullName ?? "", purok: profile.purok ?? "", contact: profile.contact ?? "", birthday: profile.birthday ?? "" });
  }, [profile]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.fullName.trim() || !form.purok || !form.contact.trim()) return setError("Kailangan ang pangalan, purok at contact.");
    setSaving(true);
    setError("");
    try {
      // role is intentionally NOT included: residents cannot change it (enforced by rules).
      await updateDoc(doc(db, "users", user.uid), {
        fullName: form.fullName.trim().slice(0, 120),
        purok: form.purok,
        contact: form.contact.trim(),
        birthday: form.birthday,
      });
      toast("Na-save ang profile mo.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      {needsProfile && <p className="mb-3 rounded-xl bg-gold-light p-3 font-semibold text-yellow-900">Pakikumpleto ang profile mo (Purok at Contact) para magamit ang lahat ng features.</p>}
      <form onSubmit={handleSave} className="space-y-4">
        <Input label="Buong Pangalan" value={form.fullName} onChange={update("fullName")} required />
        <Select label="Purok" options={puroks} placeholder="-- Pumili --" value={form.purok} onChange={update("purok")} required />
        <Input label="Contact Number" type="tel" value={form.contact} onChange={update("contact")} required />
        <Input label="Birthday" type="date" value={form.birthday} onChange={update("birthday")} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" full loading={saving}>I-save ang Profile</Button>
      </form>
    </Card>
  );
}

function MyListings() {
  const { user } = useAuth();
  const toast = useToast();
  const q = useMemo(() => (user ? query(collection(db, "listings"), where("sellerId", "==", user.uid)) : null), [user]);
  const { data, loading } = useCollection<Listing>(q);
  const items = useMemo(() => sortNewest(data), [data]);

  const remove = async (id: string) => {
    if (!confirm("Burahin ang paninda na ito? (Hal. sold na)")) return;
    try {
      await deleteDoc(doc(db, "listings", id));
      toast("Nabura na.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <>
      <SectionTitle>Mga Paninda Ko</SectionTitle>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card className="text-center text-gray-500">
          Wala ka pang paninda. <Link href="/tindahan/magbenta" className="font-bold text-brand underline">Magbenta ngayon</Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((l) => {
            const expired = l.expiresAt && l.expiresAt.toMillis() < Date.now();
            const badge = STATUS_BADGE[l.status];
            return (
              <Card key={l.id} className="flex items-center gap-3">
                {l.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photoURL} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface"><Store className="h-6 w-6 text-gray-300" /></div>
                )}
                <Link href={`/tindahan/item?id=${l.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-bold">{l.title}</p>
                  <p className="font-semibold text-brand">{formatPeso(l.price)}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge color={badge.color}>{badge.label}</Badge>
                    {expired && <Badge color="red">Expired</Badge>}
                  </div>
                </Link>
                <button onClick={() => remove(l.id)} className="rounded-full p-2 text-gray-400" aria-label="Burahin">
                  <Trash2 className="h-5 w-5" />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function MyJobs() {
  const { user } = useAuth();
  const toast = useToast();
  const q = useMemo(() => (user ? query(collection(db, "jobs"), where("posterId", "==", user.uid)) : null), [user]);
  const { data } = useCollection<Job>(q);
  if (data.length === 0) return null;

  const remove = async (id: string) => {
    if (!confirm("Burahin ang trabaho na ito? (Hal. may nakuha na)")) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
      toast("Nabura na.");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <>
      <SectionTitle>Mga Trabahong Pinost Ko</SectionTitle>
      <div className="space-y-2">
        {sortNewest(data).map((j) => (
          <Card key={j.id} className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{j.title}</p>
              <Badge color={STATUS_BADGE[j.status]?.color ?? "gray"}>{STATUS_BADGE[j.status]?.label ?? j.status}</Badge>
            </div>
            <button onClick={() => remove(j.id)} className="rounded-full p-2 text-gray-400" aria-label="Burahin">
              <Trash2 className="h-5 w-5" />
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}

function AccountContent() {
  const { user, profile, isAdmin, logout, loading } = useAuth();
  const toast = useToast();

  // Safety net: logged in but users/{uid} missing (e.g. write failed during signup).
  useEffect(() => {
    if (!loading && user && !profile) {
      ensureUserDoc(user).catch((err) => toast(friendlyError(err), "error"));
    }
  }, [loading, user, profile, toast]);

  if (!profile) return <Spinner label="Inihahanda ang account..." />;

  return (
    <>
      <Card className="mb-4 flex items-center gap-4 bg-brand text-white">
        <span className="rounded-full bg-gold p-3 text-brand-dark"><UserRound className="h-8 w-8" /></span>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold">{profile.fullName}</p>
          <p className="truncate text-white/80">{user?.email}</p>
          <p className="text-gold">{profile.purok || "Wala pang purok"} · {isAdmin ? "Admin" : "Residente"}</p>
        </div>
      </Card>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <LinkButton href="/appointment" variant="outline"><CalendarCheck className="h-5 w-5" /> Appointments</LinkButton>
        <LinkButton href="/tindahan/magbenta" variant="outline"><Store className="h-5 w-5" /> Magbenta</LinkButton>
      </div>
      {isAdmin && (
        <LinkButton href="/admin" variant="gold" full className="mb-2"><ShieldCheck className="h-5 w-5" /> Admin Dashboard</LinkButton>
      )}

      <SectionTitle>Profile Ko</SectionTitle>
      <ProfileForm />
      <MyListings />
      <MyJobs />

      <Button
        variant="danger"
        full
        className="mt-8"
        onClick={async () => {
          await logout();
          toast("Naka-logout ka na.");
        }}
      >
        <LogOut className="h-5 w-5" /> Mag-logout
      </Button>
    </>
  );
}

export default function AccountPage() {
  return (
    <div>
      <PageHeader title="Account" />
      <LoginGate message="Mag-login o mag-register para magkaroon ng account.">
        <AccountContent />
      </LoginGate>
    </div>
  );
}
