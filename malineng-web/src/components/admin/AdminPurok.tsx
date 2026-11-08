"use client";

import { collection, doc, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { PUROKS } from "@/lib/constants";
import { friendlyError } from "@/lib/format";
import type { PurokPoints } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/Toast";

const purokCollection = collection(db, "purokPoints");
const purokDocId = (purok: string) => purok.toLowerCase().replace(/\s+/g, "-"); // "Purok 1" -> "purok-1"

export function AdminPurok() {
  const toast = useToast();
  const { data } = useCollection<PurokPoints>(purokCollection);

  const add = async (purok: string, points: number, cleanup = 0) => {
    try {
      // increment() is atomic: safe even if two admins click at the same time.
      await setDoc(doc(db, "purokPoints", purokDocId(purok)), { purok, points: increment(points), cleanupCount: increment(cleanup) }, { merge: true });
      toast(`${purok}: ${points > 0 ? "+" : ""}${points} points`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div className="space-y-3">
      {PUROKS.map((purok) => {
        const row = data.find((d) => d.purok === purok);
        return (
          <Card key={purok}>
            <div className="mb-2 flex justify-between">
              <p className="text-lg font-bold">{purok}</p>
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
