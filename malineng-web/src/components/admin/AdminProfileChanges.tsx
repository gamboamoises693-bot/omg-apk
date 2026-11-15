"use client";

import { useMemo, useState } from "react";
import { collection, doc, getDoc, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { UserCog } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError, timeAgo, tsToMillis } from "@/lib/format";
import { PHONE_TAKEN_MESSAGE, phoneOwner } from "@/lib/phone";
import { FIELD_LABEL, PROFILE_REJECT_REASONS, changedFields, type ProfileChange } from "@/lib/profileChange";
import { Button, EmptyState, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

/** One resident's request: before → after, with Approve / Reject. */
function ChangeCard({ c }: { c: ProfileChange }) {
  const { user, profile, isSuperAdmin } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<string>(PROFILE_REJECT_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const diff = changedFields(c.current, c.requested);
  const own = c.uid === user?.uid && !isSuperAdmin; // nobody but the Super Admin decides their own request

  const decide = async (status: "approved" | "rejected") => {
    if (!user || !profile) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "profileChanges", c.uid), {
        status,
        reason: status === "rejected" ? reason : "",
        reviewedBy: user.uid,
        reviewedByName: profile.fullName,
        reviewedAt: serverTimestamp(),
      });
      if (status === "approved") {
        const contactChanged = c.requested.contact !== c.current.contact;
        if (contactChanged) {
          // The new number must still be free (one number = one account); the old one is released.
          if ((await phoneOwner(c.requested.contact, c.uid)) === "taken") throw new Error(PHONE_TAKEN_MESSAGE);
          batch.set(doc(db, "phoneIndex", c.requested.contact), { uid: c.uid, createdAt: serverTimestamp() });
          if (c.current.contact && (await phoneOwner(c.current.contact, c.uid)) === "mine") batch.delete(doc(db, "phoneIndex", c.current.contact));
        }
        batch.update(doc(db, "users", c.uid), { ...c.requested });
        // Keep the Barangay ID check (verified badge name) and the selfie record in step with the new details.
        if ((await getDoc(doc(db, "verifiedUsers", c.uid))).exists()) batch.update(doc(db, "verifiedUsers", c.uid), { name: c.requested.fullName });
        if ((await getDoc(doc(db, "verifications", c.uid))).exists()) batch.update(doc(db, "verifications", c.uid), { ...c.requested });
      }
      await batch.commit();
      const what = diff.map((k) => `${FIELD_LABEL[k]} ${c.current[k] || "—"} → ${c.requested[k] || "—"}`).join(", ");
      logActivity("Account", status === "approved" ? `Inaprubahan ang pagbabago sa profile ni ${c.current.fullName}: ${what}` : `Ni-reject ang pagbabago ni ${c.current.fullName}: ${reason}`, c.uid);
      toast(status === "approved" ? "Naaprubahan at na-update ang profile." : "Na-reject. Makikita ng resident ang dahilan.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2.5 rounded-2xl bg-white p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <b className="min-w-0 break-words">{c.current.fullName}</b>
        <span className="shrink-0 text-xs text-gray-500">{timeAgo(c.createdAt)}</span>
      </div>
      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 text-sm">
        {diff.map((k) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{FIELD_LABEL[k]}</dt>
            <dd className="min-w-0 break-words">
              <span className="text-gray-500 line-through">{c.current[k] || "—"}</span> → <b className="text-green-700">{c.requested[k] || "—"}</b>
            </dd>
          </div>
        ))}
      </dl>
      {own ? (
        <p className="rounded-xl bg-gray-50 p-2.5 text-xs text-gray-600">Ito ang request mo. Ibang admin ang dapat magdesisyon dito.</p>
      ) : (
        <>
          <Button full loading={busy} onClick={() => decide("approved")}>Aprubahan</Button>
          <div className="space-y-2 rounded-xl bg-red-50 p-3">
            <Select label="Dahilan ng pag-reject" options={PROFILE_REJECT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" full loading={busy} onClick={() => decide("rejected")}>I-reject</Button>
          </div>
        </>
      )}
    </li>
  );
}

/** Admin tab: residents who asked to change their name, purok, contact or birthday. */
export function AdminProfileChanges() {
  const q = useMemo(() => query(collection(db, "profileChanges"), where("status", "==", "pending")), []);
  const { data, loading } = useCollection<ProfileChange>(q);
  const list = useMemo(() => [...data].sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt)), [data]); // oldest first = fair queue
  if (loading) return <Spinner />;
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-gray-600"><UserCog className="h-4 w-4 shrink-0" aria-hidden /> Hindi pa nababago ang profile ng resident hangga&apos;t hindi mo naaaprubahan.</p>
      {list.length === 0 ? <EmptyState title="Walang naghihintay na pagbabago sa profile" /> : <ul className="space-y-3">{list.map((c) => <ChangeCard key={c.id} c={c} />)}</ul>}
    </div>
  );
}
