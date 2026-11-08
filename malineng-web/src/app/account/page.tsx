"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, query, updateDoc, where } from "firebase/firestore";
import { BadgeCheck, Ban, Camera, CalendarCheck, Pill, Clock, LogOut, ShieldCheck, Store, Trash2, UserRound, Briefcase, Users, XCircle } from "lucide-react";
import { EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { db, googleProvider } from "@/lib/firebase";
import { logActivity, roleLabel } from "@/lib/activity";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { deleteListing, isExpired, repostListing, timeLeft } from "@/lib/listings";
import { ensureUserDoc, useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { formatPeso, friendlyError, sortNewest } from "@/lib/format";
import type { Job, Listing } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Input, LinkButton, Modal, PageHeader, SectionTitle, Select, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { TextSizeSetting } from "@/components/TextSizeSetting";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import { compressToDataUrl } from "@/lib/upload";

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
      await deleteListing(id);
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
            const expired = l.status === "approved" && isExpired(l);
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
                    {expired ? <Badge color="red">Expired</Badge> : l.status === "approved" && <Badge color="gray">⏱ {timeLeft(l)}</Badge>}
                  </div>
                  {expired && (
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          await repostListing(l);
                          logActivity("Tindahan", `Nag-post ulit ng paninda: “${l.title}”`);
                          toast("Naipadala ulit! Lalabas ito kapag na-approve.");
                        } catch (err) {
                          toast(friendlyError(err), "error");
                        }
                      }}
                      className="mt-1.5 rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white"
                    >
                      ↻ I-post ulit
                    </button>
                  )}
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

/** Selfie verification status card. */
function VerificationCard() {
  const { isStaff, isVerified, verification } = useAuth();
  if (isStaff) return null;
  if (isVerified) {
    return (
      <Card className="mb-3 flex items-center gap-3">
        <BadgeCheck className="h-8 w-8 shrink-0 text-blue-600" />
        <div><p className="font-bold">Verified na residente</p><p className="text-xs text-gray-500">Bukas sa iyo ang lahat ng features.</p></div>
      </Card>
    );
  }
  if (verification?.status === "pending") {
    return (
      <Card className="mb-3 flex items-center gap-3 bg-gold-light">
        <Clock className="h-8 w-8 shrink-0 text-yellow-700" />
        <div className="flex-1"><p className="font-bold">Sinusuri pa ang selfie mo</p><p className="text-xs text-yellow-900">Karaniwang 1 araw. Magagamit mo na ang Emergency, Board at Ayuda Checker.</p></div>
      </Card>
    );
  }
  return (
    <Card className="mb-3 space-y-2 bg-blue-50">
      <div className="flex items-center gap-3">
        {verification?.status === "rejected" ? <XCircle className="h-8 w-8 shrink-0 text-red-600" /> : <BadgeCheck className="h-8 w-8 shrink-0 text-blue-600" />}
        <div>
          <p className="font-bold">{verification?.status === "rejected" ? "Kailangang ulitin ang selfie" : "I-verify ang account mo"}</p>
          <p className="text-xs text-gray-600">{verification?.status === "rejected" ? verification.reason : "Para makapagbenta, mag-post ng trabaho, mag-book ng clearance at bumoto."}</p>
        </div>
      </div>
      <LinkButton href="/verify" full>{verification?.status === "rejected" ? "Kumuha ulit ng selfie" : "Mag-selfie para ma-verify"}</LinkButton>
    </Card>
  );
}

/** Deletes the account and personal data (selfie, household, profile). Requires re-login for safety. */
function DeleteAccount() {
  const { user, profile, isSuperAdmin } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user || isSuperAdmin) return null;
  const isPasswordUser = user.providerData.some((p) => p.providerId === "password");

  const run = async () => {
    if (confirmText.trim().toUpperCase() !== "BURAHIN") return setError("I-type ang BURAHIN para kumpirmahin.");
    setBusy(true);
    setError("");
    try {
      // Firebase requires a recent login before deleting an account.
      if (isPasswordUser) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
      else await reauthenticateWithPopup(user, googleProvider);
      logActivity("Account", `Binura ang sariling account (${profile?.fullName ?? ""})`, user.uid);
      await Promise.all(["verifications", "verifiedUsers", "households"].map((c) => deleteDoc(doc(db, c, user.uid)).catch(() => undefined)));
      await deleteDoc(doc(db, "users", user.uid));
      await user.delete();
      toast("Nabura na ang account mo at ang personal na data mo.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-4 w-full text-center text-sm font-semibold text-red-600 underline">Burahin ang account ko</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Burahin ang account">
        <div className="space-y-3 text-sm">
          <p>Mabubura nang <b>permanente</b>: ang profile mo, ang selfie mo, at ang impormasyon ng pamilya mo. Hindi na ito maibabalik.</p>
          <p className="text-gray-500">Mananatili ang mga record na kailangan ng Barangay (hal. mga naibigay na clearance at ang activity log).</p>
          {isPasswordUser && <Input label="Password mo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          <Input label='I-type ang "BURAHIN"' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <ErrorText>{error}</ErrorText>
          <Button variant="danger" full loading={busy} onClick={run}><Trash2 className="h-4 w-4" /> Burahin nang permanente</Button>
        </div>
      </Modal>
    </>
  );
}

/** Admin-only profile photo: tap the circle to change, small "Alisin" link to remove. */
function AdminPhoto({ uid, name, photo }: { uid: string; name: string; photo?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const save = async (photoURL: string) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", uid), { photoURL });
      logActivity("Account", photoURL ? "Nagpalit ng profile picture" : "Nag-alis ng profile picture");
      toast(photoURL ? "Napalitan ang profile picture." : "Inalis ang profile picture.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (file?: File) => {
    if (!file) return;
    try {
      // 200px square JPEG ≈ 10–25KB, safely under the 60KB rule limit.
      await save(await compressToDataUrl(file, 200, 0.75, 55_000, true));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <label className={`relative cursor-pointer ${busy ? "opacity-60" : ""}`} aria-label="Palitan ang profile picture">
        <Avatar name={name} photo={photo} size="h-16 w-16" textClass="text-xl" ring="ring-2 ring-gold" />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-gold p-1 text-brand-deep shadow"><Camera className="h-3.5 w-3.5" /></span>
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {photo && (
        <button onClick={() => confirm("Alisin ang profile picture?") && save("")} disabled={busy} className="text-[0.7rem] text-white/80 underline">
          Alisin
        </button>
      )}
    </div>
  );
}

function AccountContent() {
  const { user, profile, isAdmin, isStaff, canBotika, isVerified, isSuspended, logout, loading } = useAuth();
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
        {isStaff && user ? (
          <AdminPhoto uid={user.uid} name={profile.fullName} photo={profile.photoURL} />
        ) : (
          <span className="rounded-full bg-gold p-3 text-brand-dark"><UserRound className="h-8 w-8" /></span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{profile.fullName} <VerifiedBadge show={isVerified && !isStaff} className="text-white" /></p>
          <p className="truncate text-white/80">{user?.email}</p>
          <p className="text-gold">{profile.purok || "Wala pang purok"} · {roleLabel(profile.role, profile.position)}</p>
        </div>
      </Card>

      {isSuspended && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          <Ban className="mt-0.5 h-5 w-5 shrink-0" />
          <span><b>Naka-suspend ang account mo.</b> Hindi ka muna makakapag-post o makakapag-book. Bukas pa rin sa iyo ang Emergency. Makipag-ugnayan sa Barangay Hall.</span>
        </p>
      )}
      <VerificationCard />

      <div className="mb-2 grid grid-cols-2 gap-2">
        <LinkButton href="/appointment" variant="outline"><CalendarCheck className="h-5 w-5" /> Appointments</LinkButton>
        <LinkButton href="/tindahan/magbenta" variant="outline"><Store className="h-5 w-5" /> Magbenta</LinkButton>
        <LinkButton href="/pamilya" variant="outline" className="col-span-2"><Users className="h-5 w-5" /> Pamilya ko (household)</LinkButton>
      </div>
      {isAdmin && (
        <LinkButton href="/admin" variant="gold" full className="mb-2"><ShieldCheck className="h-5 w-5" /> Admin Dashboard</LinkButton>
      )}
      {canBotika && (
        <LinkButton href="/botika/manage" variant={isAdmin ? "soft" : "gold"} full className="mb-2"><Pill className="h-5 w-5" /> Botika (BHW)</LinkButton>
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
      <DeleteAccount />
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

      {/* Available to everyone, even without logging in (e.g. senior citizens). */}
      <SectionTitle>Laki ng text (Aa)</SectionTitle>
      <Card>
        <TextSizeSetting />
        <p className="mt-2 text-xs text-gray-500">Para sa phone na ito lang. Piliin ang “Malaki” kung nahihirapang magbasa.</p>
      </Card>
    </div>
  );
}
