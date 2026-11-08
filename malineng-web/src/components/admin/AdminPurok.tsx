"use client";

import { collection, doc, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { friendlyError } from "@/lib/format";
import type { PurokPoints } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";

const purokCollection = collection(db, "purokPoints");
// "Purok 1" -> "purok-1", "Purok 6-A" -> "purok-6-a" (safe Firestore doc id)
const purokDocId = (purok: string) => purok.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function AdminPurok() {
  const toast = useToast();
  const { data } = useCollection<PurokPoints>(purokCollection);
  const puroks = usePuroks();

  const add = async (purok: string, points: number, cleanup = 0) => {
    try {
      // increment() is atomic: safe even if two admins click at the same time.
      await setDoc(doc(db, "purokPoints", purokDocId(purok)), { purok, points: increment(points), cleanupCount: increment(cleanup) }, { merge: true });
      logActivity("Purok Points", `${purok}: ${points > 0 ? "+" : ""}${points} points${cleanup ? " (clean-up drive)" : ""}`);
      toast(`${purok}: ${points > 0 ? "+" : ""}${points} points`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-3">
      {puroks.map((purok) => {
        const row = data.find((d) => d.purok === purok);
        return (
          <Card key={purok}>
            <div className="mb-2 flex justify-between">
              <p className="text-base font-bold">{purok}</p>
              <p className="font-black text-brand">{row?.points ?? 0} pts · {row?.cleanupCount ?? 0} clean-up</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => add(purok, 5)}>+5</Button>
              <Button variant="outline" onClick={() => add(purok, 10)}>+10</Button>
              <Button variant="outline" onClick={() => add(purok, -5)}>-5</Button>
            </div>
            <Button variant="gold" full className="mt-2" onClick={() => add(purok, 20, 1)}>+ Clean-up Drive (+20 pts)</Button>
          </Card>
        );
      })}
    </div>
  );
}
