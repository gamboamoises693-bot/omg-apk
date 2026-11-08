"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { isExpiringSoon, isLow, publishPublicList, toPublicList, type Medicine } from "@/lib/botika";
import { FilterTabs, PageHeader, Spinner } from "@/components/ui";
import { BotikaInventory } from "@/components/botika/BotikaInventory";
import { BotikaDispense } from "@/components/botika/BotikaDispense";
import { BotikaHistory } from "@/components/botika/BotikaHistory";

type Tab = "inventory" | "ibigay" | "history";
const medicinesCol = collection(db, "medicines");

/** Keeps botikaPublic/main in sync with the real inventory (only writes when it changed). */
function usePublicListSync(meds: Medicine[], ready: boolean) {
  const [published, setPublished] = useState<string | null>(null);
  const writing = useRef<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "botikaPublic", "main"),
        (snap) => setPublished(JSON.stringify(snap.data()?.items ?? [])),
        () => setPublished(null),
      ),
    [],
  );

  useEffect(() => {
    if (!ready || published === null) return;
    const list = toPublicList(meds);
    const json = JSON.stringify(list);
    if (json === published || json === writing.current) return;
    writing.current = json;
    publishPublicList(list).catch((err) => {
      console.warn("[botika] public list sync failed:", err);
      writing.current = null;
    });
  }, [meds, ready, published]);
}

function BotikaManage() {
  const { profile } = useAuth();
  const { data: meds, loading, error } = useCollection<Medicine>(medicinesCol);
  const [tab, setTab] = useState<Tab>("inventory");
  usePublicListSync(meds, !loading && !error);

  const sorted = useMemo(() => [...meds].sort((a, b) => a.name.localeCompare(b.name)), [meds]);
  const alerts = meds.filter((m) => isLow(m) || isExpiringSoon(m)).length;

  return (
    <div>
      <PageHeader title="Botika ng Barangay" subtitle={profile ? `BHW · ${profile.fullName}` : undefined} />
      <FilterTabs
        label="Botika"
        value={tab}
        onChange={setTab}
        options={[
          { value: "inventory", label: "Inventory", count: alerts || undefined },
          { value: "ibigay", label: "Magbigay" },
          { value: "history", label: "History" },
        ]}
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : tab === "inventory" ? (
        <BotikaInventory meds={sorted} onDispense={() => setTab("ibigay")} />
      ) : tab === "ibigay" ? (
        <BotikaDispense meds={sorted} onDone={() => setTab("history")} />
      ) : (
        <BotikaHistory />
      )}
    </div>
  );
}

export default function BotikaManagePage() {
  const { canBotika, loading, user } = useAuth();
  if (loading) return <Spinner />;
  if (!user || !canBotika) {
    return <p className="rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-700">Para sa BHW, Kapitan at Super Admin lang ang page na ito.</p>;
  }
  return <BotikaManage />;
}
