"use client";

import { useMemo, useState } from "react";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { Ban, KeyRound, ShieldCheck, Undo2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useVerifiedSet } from "@/lib/useVerifiedSet";
import { logActivity, roleLabel } from "@/lib/activity";
import { ADMIN_POSITIONS } from "@/lib/constants";
import { friendlyError, timeAgo } from "@/lib/format";
import type { UserProfile } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Modal, Select, Spinner } from "@/components/ui";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useToast } from "@/components/Toast";

const usersCollection = collection(db, "users");
type Filter = "lahat" | "admins" | "unverified" | "suspended";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "lahat", label: "Lahat" },
  { key: "admins", label: "Admins" },
  { key: "unverified", label: "Hindi verified" },
  { key: "suspended", label: "Suspended" },
];

type UserRow = UserProfile & { id: string };

function UserDetail({ u, verified, onClose }: { u: UserRow; verified: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const isMe = user?.uid === u.id;
  const [role, setRole] = useState<"resident" | "admin">(u.role === "admin" ? "admin" : "resident");
  const [position, setPosition] = useState<string>(u.position || "Secretary");
  const [busy, setBusy] = useState(false);

  const saveRole = async () => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", u.id), role === "admin" ? { role, position } : { role, position: "" });
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
      } else {
        const ver = await getDoc(doc(db, "verifications", u.id));
        if (ver.exists() && ver.data().status === "verified") batch.set(flag, { name: u.fullName, verifiedAt: serverTimestamp(), verifiedBy: "restored" });
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-bold">{u.fullName} <VerifiedBadge show={verified} /></p>
        <p className="text-sm text-gray-500">{u.purok || "Walang purok"} · {u.contact || "walang contact"}</p>
        <p className="break-all text-sm text-gray-500">{u.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge color={u.role === "superadmin" ? "blue" : u.role === "admin" ? "green" : "gray"}>{roleLabel(u.role, u.position)}</Badge>
          {u.suspended && <Badge color="red">Suspended</Badge>}
          <Badge color={verified ? "blue" : "gold"}>{verified ? "✓ Verified" : "Hindi verified"}</Badge>
        </div>
        <p className="mt-1 text-xs text-gray-400">Nag-register {timeAgo(u.createdAt)}</p>
      </div>

      {isMe || u.role === "superadmin" ? (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Hindi pwedeng baguhin dito ang role ng Super Admin, para hindi ma-lock out ang website.</p>
      ) : (
        <>
          <Card className="space-y-3 bg-gray-50 shadow-none">
            <p className="flex items-center gap-1 font-bold"><ShieldCheck className="h-4 w-4" /> Role</p>
            <div className="grid grid-cols-2 gap-2">
              {(["resident", "admin"] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)} className={`rounded-xl border py-2 text-sm font-semibold ${role === r ? "border-brand bg-brand-light text-brand" : "border-gray-200 bg-white text-gray-600"}`}>
                  {r === "admin" ? "Admin" : "Residente"}
                </button>
              ))}
            </div>
            {role === "admin" && (
              <Select label="Posisyon" options={ADMIN_POSITIONS} value={position} onChange={(e) => setPosition(e.target.value)} hint="“Kapitan” lang ang makaka-approve ng ambulansya." />
            )}
            <Button full loading={busy} onClick={saveRole}>I-save ang role</Button>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={u.suspended ? "soft" : "outline"} loading={busy} onClick={toggleSuspend}>
              {u.suspended ? <><Undo2 className="h-4 w-4" /> Alisin ang suspend</> : <><Ban className="h-4 w-4" /> I-suspend</>}
            </Button>
            <Button variant="outline" onClick={resetPassword}><KeyRound className="h-4 w-4" /> Reset password</Button>
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
      <div className="mb-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-2.5 text-center shadow-card">
            <p className="text-lg font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[0.7rem] font-semibold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${filter === f.key ? "bg-brand text-white" : "bg-white text-gray-600 shadow-card"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin: pangalan, purok, email..." className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" aria-label="Hanapin ang user" />

      {list.length === 0 ? (
        <EmptyState title="Walang nakita" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((u) => (
            <li key={u.id}>
              <button onClick={() => setOpenId(u.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isStaff(u) ? "bg-brand" : "bg-gray-400"}`}>
                  {u.fullName.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                </span>
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
