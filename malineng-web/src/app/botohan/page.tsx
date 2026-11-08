"use client";

import { useMemo, useState } from "react";
import { arrayUnion, collection, doc, updateDoc } from "firebase/firestore";
import { Vote, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { friendlyError, sortNewest } from "@/lib/format";
import type { Poll } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

const pollsCollection = collection(db, "polls");

function PollCard({ poll }: { poll: Poll }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const votes = poll.votes ?? [];
  const voters = poll.voters ?? [];
  const myVote = user ? votes.find((v) => v.uid === user.uid) : undefined;
  const hasVoted = !!user && (voters.includes(user.uid) || !!myVote);
  const showResults = hasVoted || !poll.isActive;
  const total = votes.length;

  const counts = poll.options.map((_, i) => votes.filter((v) => v.option === i).length);

  const vote = async (option: number) => {
    if (!user) return toast("Mag-login muna para makaboto.", "error");
    if (hasVoted || busy) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "polls", poll.id), {
        votes: arrayUnion({ uid: user.uid, option }),
        voters: arrayUnion(user.uid),
      });
      toast("Salamat sa pagboto!");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-base font-bold">{poll.question}</p>
        <Badge color={poll.isActive ? "green" : "gray"}>{poll.isActive ? "Bukas" : "Sarado"}</Badge>
      </div>
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const mine = myVote?.option === i;
          return showResults ? (
            <div key={i} className={`relative overflow-hidden rounded-xl border-2 ${mine ? "border-brand" : "border-gray-200"}`}>
              <div className="absolute inset-y-0 left-0 bg-brand-light" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between px-4 py-3 font-semibold">
                <span className="flex items-center gap-2">{mine && <CheckCircle2 className="h-5 w-5 text-brand" />}{opt}</span>
                <span>{pct}%</span>
              </div>
            </div>
          ) : (
            <button key={i} disabled={busy} onClick={() => vote(i)} className="w-full rounded-xl border-2 border-brand px-4 py-3 text-left font-semibold text-brand active:bg-brand-light disabled:opacity-50">
              {opt}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-gray-500">{total} boto{!user && poll.isActive ? " · Mag-login para makaboto" : ""}</p>
    </Card>
  );
}

export default function BotohanPage() {
  const { data, loading } = useCollection<Poll>(pollsCollection);
  const polls = useMemo(() => sortNewest(data).sort((a, b) => Number(b.isActive) - Number(a.isActive)), [data]);

  return (
    <div>
      <PageHeader title="Botohan" subtitle="Ipaalam ang boses mo sa Barangay" />
      {loading ? (
        <Spinner />
      ) : polls.length === 0 ? (
        <EmptyState icon={<Vote className="h-12 w-12" />} title="Wala pang botohan" />
      ) : (
        <div className="space-y-3">{polls.map((p) => <PollCard key={p.id} poll={p} />)}</div>
      )}
    </div>
  );
}
