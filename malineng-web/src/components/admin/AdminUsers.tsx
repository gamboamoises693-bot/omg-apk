"use client";

import { IdPhotoUpload } from "@/components/IdPhotoUpload";
import { compressToDataUrl } from "@/lib/upload";
import { verifiedSetAdd, verifiedSetRef, verifiedSetRemove } from "@/lib/verified";
import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch, setDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { Ban, Camera, Copy, Landmark, ExternalLink, KeyRound, ShieldCheck, Trash2, Undo2, UserPlus } from "lucide-react";
import { VERIFY_LINK, verifyInviteText } from "@/lib/nextPath";
import { ChatWithButton } from "@/components/ChatWithButton";
import { firebaseConfig } from "@/config/firebase.config";
import { deleteListing } from "@/lib/listings";
import { refreshPublicStatsQuietly } from "@/lib/stats";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity, roleLabel } from "@/lib/activity";
import { ADMIN_POSITIONS } from "@/lib/constants";
import { isLimitedPosition, KAGAWAD_SECTIONS } from "@/lib/adminAccess";
import { friendlyError, timeAgo } from "@/lib/format";
import type { UserProfile } from "@/lib/types";
import { Badge, Button, Card, EmptyState, FilterTabs, Modal, Select, Spinner } from "@/components/ui";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AddAccountForm } from "./AddAccountForm";
import { PurokCountsCard } from "./PurokCountsCard";
import { releasePhone } from "@/lib/phone";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";

const usersCollection = collection(db, "users");
type Filter = "lahat" | "admins" | "unverified" | "suspended";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "lahat", label: "Lahat" },
  { key: "admins", label: "Admins" },
  { key: "unverified", label: "Di verified" },
  { key: "suspended", label: "Suspended" },
];

/** Short explanations shown in the position picker. */
const POSITION_INFO: { name: string; hint: string }[] = [
  { name: "Kapitan", hint: "Punong Barangay. Isa lang ang Kapitan." },
  { name: "Secretary", hint: "Katuwang ng Kapitan sa mga dokumento at ulat." },
  { name: "Treasurer", hint: "Pondo at gastos." },
  { name: "Kagawad", hint: "Miyembro ng Sangguniang Barangay." },
  { name: "SK Chairman", hint: "Liga at mga programa ng kabataan." },
  { name: "BHW Head", hint: "Botika at kalusugan, nangunguna sa BHW." },
  { name: "BHW", hint: "Botika at kalusugan lang." },
  { name: "Iba pa", hint: "Isulat ang posisyon, halimbawa Tanod." },
];

export type UserRow = UserProfile & { id: string };

/** Super Admin only: replace or remove the profile picture of an official (profile pictures are shown for staff accounts). */
function ProfilePhotoEditor({ u }: { u: UserRow }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const save = async (photoURL: string) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", u.id), { photoURL });
      logActivity("Roles", photoURL ? `Pinalitan ang profile picture ni ${u.fullName}` : `Inalis ang profile picture ni ${u.fullName}`, u.id);
      toast(photoURL ? "Napalitan ang profile picture." : "Inalis ang profile picture.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      // 200px square JPEG, under the 60KB rule limit.
      await save(await compressToDataUrl(file, 200, 0.75, 55_000, true));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <Card className="space-y-2 bg-gray-50 shadow-none">
      <p className="font-bold">Profile picture (opisyal)</p>
      <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-3 font-semibold ${busy ? "opacity-60" : ""}`}>
        <Camera className="h-4 w-4" aria-hidden /> Palitan ang profile picture
        <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {u.photoURL && <Button variant="outline" full loading={busy} onClick={() => confirm("Alisin ang profile picture?") && save("")}>Alisin ang profile picture</Button>}
    </Card>
  );
}

/**
 * Officials do not join the raffle, so when someone becomes an Admin their entry and code are removed.
 * Once the draw has started the entry is kept (it may already be a winner and is part of the record).
 * Returns the batch operations to add to the caller's batch.
 */
async function raffleCleanup(batch: ReturnType<typeof writeBatch>, uid: string): Promise<boolean> {
  try {
    const [entry, drawn] = await Promise.all([getDoc(doc(db, "raffleEntries", uid)), getDoc(doc(db, "rafflePublicRounds", "1"))]);
    if (!entry.exists() || drawn.exists()) return false;
    const code = entry.data().code as string | undefined;
    batch.delete(entry.ref);
    if (code) batch.delete(doc(db, "raffleCodes", code));
    return true;
  } catch {
    return false; // never block the promotion because of the raffle
  }
}

export function UserDetail({ u, verified, onClose }: { u: UserRow; verified: boolean; onClose: () => void }) {
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();
  const isMe = user?.uid === u.id;
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!isSuperAdmin) return;
    getDoc(doc(db, "verifications", u.id)).then((s) => setIdPhoto(s.exists() ? ((s.data().selfie as string) ?? "") : null)).catch(() => setIdPhoto(null));
  }, [isSuperAdmin, u.id]);
  const [role, setRole] = useState<"resident" | "admin">(u.role === "admin" ? "admin" : "resident");
  const [position, setPosition] = useState<string>(u.position || "");
  const [busy, setBusy] = useState(false);
  // Position picker (Developer only): opens inline, remembers the choice until saved.
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<string>(u.role === "admin" && u.position ? u.position : "");
  const [customPos, setCustomPos] = useState("");
  const [otherKapitan, setOtherKapitan] = useState<string | null>(null);
  // Kagawad only: the admin sections they may open.
  const [access, setAccess] = useState<string[]>(u.adminAccess ?? []);
  const toggleAccess = (key: string) => setAccess((a) => (a.includes(key) ? a.filter((k) => k !== key) : [...a, key]));

  const isListed = (ADMIN_POSITIONS as readonly string[]).includes(u.position ?? "");
  const chosen = pick === "Iba pa" ? customPos.trim() : pick;

  // Warn (not block) when another account already holds the Kapitan position.
  useEffect(() => {
    setOtherKapitan(null);
    if (!picking || pick !== "Kapitan") return;
    let live = true;
    getDocs(query(usersCollection, where("position", "==", "Kapitan")))
      .then((snap) => {
        const other = snap.docs.find((d) => d.id !== u.id && d.data().role === "admin");
        if (live) setOtherKapitan(other ? ((other.data().fullName as string) ?? "isa pang account") : null);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [picking, pick, u.id]);

  /** Sets (or clears, with "") the barangay position. A position makes the user an Admin; clearing returns them to Residente. */
  const savePosition = async (next: string, allowed: string[] = []) => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", u.id), next ? { role: "admin", position: next, adminAccess: isLimitedPosition(next) ? allowed : [] } : { role: "resident", position: "", adminAccess: [], photoURL: "" });
      const dropped = next ? await raffleCleanup(batch, u.id) : false;
      await batch.commit();
      logActivity("Roles", next ? `Itinalaga si ${u.fullName} bilang ${next} (dati: ${u.position || (u.role === "admin" ? "Admin" : "Residente")})${isLimitedPosition(next) ? `, access: ${allowed.length} na section` : ""}` : `Inalis ang posisyon ni ${u.fullName} (${u.position || "Admin"}), naging Residente`, u.id);
      if (dropped) logActivity("Raffle", `Inalis ang raffle entry at code ni ${u.fullName} (naging opisyal)`, u.id);
      toast(next ? `Na-update na: si ${u.fullName.split(" ")[0]} ay ${next} na.` : "Inalis ang posisyon.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async () => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      // Profile photos are admin-only, so a demoted user's photo is cleared too.
      if (role === "admin") await raffleCleanup(batch, u.id);
      batch.update(doc(db, "users", u.id), role === "admin" ? { role, position: position || "Secretary" } : { role, position: "", adminAccess: [], photoURL: "" });
      await batch.commit();
      logActivity("Roles", `Ginawang ${roleLabel(role, role === "admin" ? position : "")} si ${u.fullName}`, u.id);
      toast("Na-save ang role.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  /** Suspend hides the verified badge too; un-suspend restores it if the selfie was approved. */
  const toggleSuspend = async () => {
    const next = !u.suspended;
    if (next && !confirm(`I-suspend si ${u.fullName}? Hindi siya makakapag-post, magbenta o mag-book (pero pwede pa rin sa emergency).`)) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", u.id), { suspended: next });
      const flag = doc(db, "verifiedUsers", u.id);
      if (next) {
        batch.delete(flag);
        batch.set(verifiedSetRef(), verifiedSetRemove(u.id), { merge: true });
      } else {
        const ver = await getDoc(doc(db, "verifications", u.id));
        if (ver.exists() && ver.data().status === "verified") {
          batch.set(flag, { name: u.fullName, verifiedAt: serverTimestamp(), verifiedBy: "restored" });
          batch.set(verifiedSetRef(), verifiedSetAdd(u.id), { merge: true });
        }
      }
      await batch.commit();
      logActivity("Roles", `${next ? "Sinuspend" : "Inalis ang suspension ni"} ${u.fullName}`, u.id);
      toast(next ? "Na-suspend." : "Inalis ang suspension.");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const [deleted, setDeleted] = useState(false);
  const [alsoPosts, setAlsoPosts] = useState(true);

  /**
   * Removes the user's data from Firestore. The login itself (Firebase Auth) can only be
   * removed from the Firebase Console on the free plan, so we link there afterwards.
   */
  const deleteAccount = async () => {
    if (!confirm(`Burahin ang account ni ${u.fullName}? Mabubura ang profile, selfie at household niya${alsoPosts ? ", pati ang mga paninda, trabaho at post niya" : ""}.`)) return;
    setBusy(true);
    try {
      if (alsoPosts) {
        const owned: [string, string][] = [["listings", "sellerId"], ["jobs", "posterId"], ["posts", "authorId"], ["skills", "userId"], ["lostFound", "userId"]];
        for (const [col, field] of owned) {
          const snap = await getDocs(query(collection(db, col), where(field, "==", u.id)));
          await Promise.all(snap.docs.map((d) => (col === "listings" ? deleteListing(d.id) : deleteDoc(d.ref))));
        }
      }
      await Promise.all(["verifications", "verifiedUsers", "households"].map((c) => deleteDoc(doc(db, c, u.id)).catch(() => undefined)));
      await setDoc(verifiedSetRef(), verifiedSetRemove(u.id), { merge: true }).catch(() => undefined);
      await releasePhone(u.contact ?? "", u.id);
      await deleteDoc(doc(db, "users", u.id));
      refreshPublicStatsQuietly();
      logActivity("Roles", `Binura ang account ni ${u.fullName}${alsoPosts ? " (kasama ang mga post)" : ""}`, u.id);
      toast("Nabura ang data. Huling hakbang: burahin ang login sa Firebase.");
      setDeleted(true);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (deleted) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-xl bg-brand-light p-3 font-semibold text-brand">✓ Nabura ang data ni {u.fullName}.</p>
        <p><b>Huling hakbang:</b> burahin ang login niya para hindi na siya makapag-login ulit:</p>
        <ol className="list-decimal space-y-1 pl-5 text-gray-700">
          <li>Buksan ang Firebase Authentication (button sa ibaba).</li>
          <li>Hanapin ang <b className="break-all">{u.email || u.id}</b>.</li>
          <li>Pindutin ang <b>⋮</b> sa dulo → <b>Delete account</b>.</li>
        </ol>
        <a href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white">
          <ExternalLink className="h-4 w-4" /> Buksan ang Firebase Authentication
        </a>
        <Button variant="ghost" full onClick={onClose}>Isara</Button>
      </div>
    );
  }

  const resetPassword = async () => {
    if (!u.email) return toast("Walang email ang account na ito (Google login?).", "error");
    try {
      await sendPasswordResetEmail(auth, u.email);
      logActivity("Roles", `Nagpadala ng password reset kay ${u.fullName}`, u.id);
      toast(`Naipadala ang reset link sa ${u.email}.`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  /** Copies a ready message with the verification link (falls back to showing it when the phone refuses to copy). */
  const copyInvite = async (name: string) => {
    const text = verifyInviteText(name);
    try {
      await navigator.clipboard.writeText(text);
      toast("Nakopya na. I-paste sa Messenger o text.");
    } catch {
      toast(text, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar name={u.fullName} photo={(u.role !== "resident" ? u.photoURL : undefined) || u.faceThumb} size="h-14 w-14" textClass="text-lg" fallbackClass={u.role !== "resident" ? "bg-brand text-gold" : "bg-gray-300 text-white"} />
        <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">{u.fullName} <VerifiedBadge show={verified} /></p>
        <p className="text-sm text-gray-500">{u.purok || "Walang purok"} · {u.contact || "walang contact"}</p>
        <p className="break-all text-sm text-gray-500">{u.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge color={u.role === "superadmin" ? "blue" : u.role === "admin" ? "green" : "gray"}>{roleLabel(u.role, u.position)}</Badge>
          {u.suspended && <Badge color="red">Suspended</Badge>}
          <Badge color={verified ? "blue" : "gold"}>{verified ? "✓ Verified" : "Hindi verified"}</Badge>
        </div>
        <p className="mt-1 text-xs text-gray-400">Nag-register {timeAgo(u.createdAt)}{u.assistedByName ? ` · Inirehistro ng ${u.assistedByName} sa Hall` : ""}</p>
        </div>
      </div>

      <ChatWithButton uid={u.id} name={u.fullName} />

      {!verified && u.role === "resident" && (
        <Card className="space-y-2 bg-gold-light shadow-none">
          <p className="font-bold">Link para ma-verify siya</p>
          <p className="break-all rounded-lg bg-white px-2.5 py-2 text-xs text-gray-700">{VERIFY_LINK}</p>
          <Button full onClick={() => copyInvite(u.fullName)}><Copy className="h-4 w-4" aria-hidden /> Kopyahin ang mensahe at link</Button>
          <p className="text-xs text-gray-600">I-paste sa Messenger o text. Pagbukas niya, magla-login siya at dadalhin na sa pagkuha ng selfie.</p>
        </Card>
      )}

      {isSuperAdmin && u.role !== "resident" && <ProfilePhotoEditor u={u} />}

      {isSuperAdmin && (
        <Card className="space-y-2 bg-gray-50 shadow-none">
          <p className="font-bold">Litrato sa Barangay ID</p>
          {idPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={idPhoto} alt={`Litrato ni ${u.fullName} sa ID`} className="mx-auto h-40 w-32 rounded-xl object-cover ring-2 ring-gold" />
          ) : (
            <p className="text-sm text-gray-500">{idPhoto === null ? "Wala pang selfie ang account na ito." : "Walang litrato."}</p>
          )}
          {idPhoto !== null && <IdPhotoUpload uid={u.id} name={u.fullName} onSaved={setIdPhoto} />}
        </Card>
      )}

      {isMe || u.role === "superadmin" ? (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Hindi pwedeng baguhin dito ang role ng Super Admin, para hindi ma-lock out ang website.</p>
      ) : (
        <>
          {isSuperAdmin && (
            <Card className="space-y-3 border-2 border-gold bg-white">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 font-bold"><Landmark className="h-4 w-4" aria-hidden /> Posisyon sa Barangay</p>
              </div>
              {!picking ? (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-3">
                    <div className="min-w-0">
                      <p className="text-[0.7rem] font-bold uppercase tracking-wide text-gray-500">Ngayon</p>
                      <p className="truncate text-base font-extrabold text-brand">{u.role === "admin" ? (u.position || "Admin") : "Residente"}</p>
                      {u.role !== "admin" && <p className="text-xs text-gray-500">Walang posisyon</p>}
                    </div>
                    <Button variant={u.role === "admin" ? "outline" : "gold"} onClick={() => { setPick(u.role === "admin" && isListed ? (u.position as string) : u.role === "admin" && u.position ? "Iba pa" : ""); setCustomPos(u.role === "admin" && !isListed ? (u.position ?? "") : ""); setPicking(true); }}>
                      {u.role === "admin" ? "Palitan" : "Magtalaga"}
                    </Button>
                  </div>
                  {u.role === "admin" && isLimitedPosition(u.position) && (
                    <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                      {(u.adminAccess ?? []).length === 0
                        ? <>⚠ Wala pa siyang <b>access</b> sa admin. Pindutin ang Palitan para pumili ng sections.</>
                        : <>Access: <b>{(u.adminAccess ?? []).length}</b> na section lang ang mabubuksan niya.</>}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">Kapag naglagay ng posisyon, nagiging <b>Admin</b> siya. Kapag inalis, bumabalik siya sa Residente.</p>
                  {u.role === "admin" && (
                    <Button variant="danger" full loading={busy} onClick={() => confirm(`Alisin ang posisyon ni ${u.fullName}? Magiging Residente na siya.`) && savePosition("")}>Alisin ang posisyon</Button>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2" role="radiogroup" aria-label="Posisyon">
                    {POSITION_INFO.map((p) => (
                      <button key={p.name} role="radio" aria-checked={pick === p.name} onClick={() => setPick(p.name)}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${pick === p.name ? "border-gold bg-gold-light" : "border-gray-200 bg-white"}`}>
                        <span className={`h-5 w-5 flex-none rounded-full border-2 ${pick === p.name ? "border-brand bg-brand ring-2 ring-inset ring-white" : "border-gray-300"}`} aria-hidden />
                        <span><b className="block text-sm">{p.name}</b><span className="block text-xs text-gray-600">{p.hint}</span></span>
                      </button>
                    ))}
                  </div>
                  {pick === "Iba pa" && (
                    <input value={customPos} onChange={(e) => setCustomPos(e.target.value)} maxLength={40} placeholder="Isulat ang posisyon (hal. Tanod)" aria-label="Ibang posisyon" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" />
                  )}
                  {pick === "Kagawad" && (
                    <div className="space-y-3 rounded-xl bg-gray-50 p-3">
                      <p className="text-sm font-bold">Ano ang pwede niyang buksan sa Admin?</p>
                      <p className="text-xs text-gray-600">Ikaw lang ang makakapagbago nito. Kapag walang tinick, wala siyang admin access.</p>
                      {KAGAWAD_SECTIONS.map((g) => (
                        <fieldset key={g.title} className="space-y-1">
                          <legend className="text-[0.7rem] font-bold uppercase tracking-wide text-gray-500">{g.title}</legend>
                          {g.items.map((it) => (
                            <label key={it.key} className="flex min-h-10 items-center gap-2.5 text-sm">
                              <input type="checkbox" checked={access.includes(it.key)} onChange={() => toggleAccess(it.key)} className="h-5 w-5 accent-brand" />
                              {it.label}
                            </label>
                          ))}
                        </fieldset>
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => setAccess(KAGAWAD_SECTIONS.flatMap((g) => g.items.map((i) => i.key)))}>Piliin lahat</Button>
                        <Button variant="outline" onClick={() => setAccess([])}>Alisin lahat</Button>
                      </div>
                    </div>
                  )}
                  {otherKapitan && (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">⚠ May Kapitan na: {otherKapitan}. Isa lang dapat ang Kapitan. Pwede mo pa ring ituloy kung papalitan siya.</p>
                  )}
                  <div className="grid grid-cols-[1fr_1.6fr] gap-2">
                    <Button variant="outline" onClick={() => setPicking(false)}>Kanselahin</Button>
                    <Button loading={busy} disabled={!chosen} onClick={() => savePosition(chosen, access)}>I-save{chosen ? `: ${chosen}` : ""}</Button>
                  </div>
                </>
              )}
            </Card>
          )}
          <Card className="space-y-3 bg-gray-50 shadow-none">
            <p className="flex items-center gap-1 font-bold"><ShieldCheck className="h-4 w-4" /> Role</p>
            <div className="grid grid-cols-2 gap-2">
              {(["resident", "admin"] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)} className={`rounded-xl border py-2 text-sm font-semibold ${role === r ? "border-brand bg-brand-light text-brand" : "border-gray-200 bg-white text-gray-600"}`}>
                  {r === "admin" ? "Admin" : "Residente"}
                </button>
              ))}
            </div>
            <Button full loading={busy} onClick={saveRole}>I-save ang role</Button>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={u.suspended ? "soft" : "outline"} loading={busy} onClick={toggleSuspend}>
              {u.suspended ? <><Undo2 className="h-4 w-4" /> Alisin ang suspend</> : <><Ban className="h-4 w-4" /> I-suspend</>}
            </Button>
            <Button variant="outline" onClick={resetPassword}><KeyRound className="h-4 w-4" /> Reset password</Button>
          </div>
          <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 p-3">
            <label className="flex items-center gap-2 text-sm text-red-900">
              <input type="checkbox" checked={alsoPosts} onChange={(e) => setAlsoPosts(e.target.checked)} className="h-4 w-4 accent-red-600" />
              Burahin din ang mga paninda, trabaho at post niya
            </label>
            <Button variant="danger" full loading={busy} onClick={deleteAccount}><Trash2 className="h-4 w-4" /> Burahin ang account</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function AdminUsers() {
  const { data, loading } = useCollection<UserRow>(usersCollection);
  const verified = useVerifiedSet();
  const [filter, setFilter] = useState<Filter>("lahat");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const isStaff = (u: UserRow) => u.role === "admin" || u.role === "superadmin";
  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return data
      .filter((u) => {
        if (filter === "admins" && !isStaff(u)) return false;
        if (filter === "unverified" && (isStaff(u) || verified.has(u.id))) return false;
        if (filter === "suspended" && !u.suspended) return false;
        return !t || `${u.fullName} ${u.purok} ${u.email ?? ""}`.toLowerCase().includes(t);
      })
      .sort((a, b) => Number(isStaff(b)) - Number(isStaff(a)) || a.fullName.localeCompare(b.fullName));
  }, [data, filter, search, verified]);
  const open = data.find((u) => u.id === openId) ?? null;

  if (loading) return <Spinner />;

  const residents = data.filter((u) => !isStaff(u));
  const stats = [
    { label: "Residente", value: residents.length },
    { label: "Admin", value: data.filter(isStaff).length },
    { label: "Verified", value: residents.filter((u) => verified.has(u.id)).length },
    { label: "Suspended", value: data.filter((u) => u.suspended).length },
  ];

  return (
    <div>
      <Button variant="gold" full className="mb-3" onClick={() => setAdding(true)}>
        <UserPlus className="h-4 w-4" /> Magdagdag ng account (Kapitan, Sec, BHW...)
      </Button>
      <Modal open={adding} onClose={() => setAdding(false)} title="Bagong account">
        {adding && <AddAccountForm onDone={() => setAdding(false)} />}
      </Modal>
      <div className="mb-3">
        <PurokCountsCard />
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-2.5 text-center shadow-card">
            <p className="text-lg font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[0.7rem] font-semibold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <FilterTabs
        label="Uri ng user"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({
          value: f.key,
          label: f.label,
          count: f.key === "suspended" ? data.filter((u) => u.suspended).length : undefined,
          tone: "neutral" as const,
        }))}
      />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin: pangalan, purok, email..." className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" aria-label="Hanapin ang user" />

      {list.length === 0 ? (
        <EmptyState title="Walang nakita" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((u) => (
            <li key={u.id}>
              <button onClick={() => setOpenId(u.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                <Avatar name={u.fullName} photo={(isStaff(u) ? u.photoURL : undefined) || u.faceThumb} size="h-9 w-9" textClass="text-xs" fallbackClass={`text-white ${isStaff(u) ? "bg-brand" : "bg-gray-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.fullName} <VerifiedBadge show={verified.has(u.id)} /></p>
                  <p className="truncate text-xs text-gray-500">{u.purok || "Walang purok"} · {timeAgo(u.createdAt)}</p>
                </div>
                {u.suspended ? <Badge color="red">Suspended</Badge> : <Badge color={u.role === "resident" ? "gray" : u.role === "superadmin" ? "blue" : "green"}>{roleLabel(u.role, u.position)}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} title="User">
        {open && <UserDetail key={open.id} u={open} verified={verified.has(open.id)} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
