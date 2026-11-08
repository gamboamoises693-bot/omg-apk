"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Pill, Plus, Search } from "lucide-react";
import { daysUntil, isExpiringSoon, isLow, stockStatus, type Medicine, type StockStatus } from "@/lib/botika";
import { formatDate } from "@/lib/format";
import { Button, EmptyState, FilterTabs, Modal } from "@/components/ui";
import { MedicineDetail } from "./MedicineDetail";
import { MedicineForm } from "./MedicineForm";

type Filter = "lahat" | "paubos" | "expiry" | "ubos";

const STATUS_STYLE: Record<StockStatus, { icon: string; count: string }> = {
  ok: { icon: "bg-brand-light text-brand", count: "text-brand" },
  paubos: { icon: "bg-gold-light text-yellow-800", count: "text-yellow-700" },
  expiring: { icon: "bg-red-50 text-red-700", count: "text-gray-900" },
  expired: { icon: "bg-red-100 text-red-800", count: "text-red-700" },
  ubos: { icon: "bg-gray-100 text-gray-400", count: "text-gray-500" },
};

/** Subtitle per row: the most important warning first. */
function statusText(m: Medicine): { text: string; tone: string } {
  const s = stockStatus(m);
  const d = daysUntil(m.expiry);
  if (s === "ubos") return { text: "Ubos na", tone: "text-gray-500" };
  if (s === "expired") return { text: `EXPIRED na (${formatDate(m.expiry)})`, tone: "font-semibold text-red-700" };
  if (s === "expiring") return { text: d === 0 ? "Mag-e-expire ngayong araw" : `Mag-e-expire sa ${d} araw`, tone: "font-semibold text-red-700" };
  if (s === "paubos") return { text: `Paubos na · min. ${m.minStock}`, tone: "font-semibold text-yellow-800" };
  return { text: m.expiry ? `${m.category} · Exp. ${formatDate(m.expiry)}` : m.category, tone: "text-gray-500" };
}

export function BotikaInventory({ meds, onDispense }: { meds: Medicine[]; onDispense: () => void }) {
  const [filter, setFilter] = useState<Filter>("lahat");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(
    () => ({
      paubos: meds.filter(isLow).length,
      expiry: meds.filter(isExpiringSoon).length,
      ubos: meds.filter((m) => m.stock <= 0).length,
    }),
    [meds],
  );

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return meds.filter((m) => {
      if (filter === "paubos" && !isLow(m)) return false;
      if (filter === "expiry" && !isExpiringSoon(m)) return false;
      if (filter === "ubos" && m.stock > 0) return false;
      return !t || `${m.name} ${m.category}`.toLowerCase().includes(t);
    });
  }, [meds, filter, search]);

  const open = meds.find((m) => m.id === openId) ?? null;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl bg-brand p-3 text-white">
        <div>
          <p className="text-lg font-extrabold">{meds.length}</p>
          <p className="text-[0.7rem] text-white/80">Klase ng gamot</p>
        </div>
        <div>
          <p className="text-lg font-extrabold text-gold">{counts.paubos}</p>
          <p className="text-[0.7rem] text-white/80">Paubos na</p>
        </div>
        <div>
          <p className="text-lg font-extrabold text-gold">{counts.expiry}</p>
          <p className="text-[0.7rem] text-white/80">Malapit mag-expire</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button onClick={onDispense}>
          <ArrowRight className="h-4 w-4" /> Magbigay
        </Button>
        <Button variant="gold" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Bagong gamot
        </Button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin ang gamot..." aria-label="Hanapin ang gamot" className="w-full bg-transparent py-2.5 outline-none" />
      </label>

      <FilterTabs
        label="Filter ng inventory"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "lahat", label: "Lahat" },
          { value: "paubos", label: "Paubos", count: counts.paubos },
          { value: "expiry", label: "Expiry", count: counts.expiry },
          { value: "ubos", label: "Ubos na", count: counts.ubos, tone: "neutral" },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState icon={<Pill />} title={meds.length === 0 ? "Wala pang gamot. Pindutin ang “Bagong gamot”." : "Walang tugma"} />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {list.map((m) => {
            const style = STATUS_STYLE[stockStatus(m)];
            const sub = statusText(m);
            return (
              <li key={m.id}>
                <button onClick={() => setOpenId(m.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.icon}`}>
                    <Pill className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${m.stock <= 0 ? "text-gray-500" : ""}`}>{m.name}</p>
                    <p className={`truncate text-xs ${sub.tone}`}>{sub.text}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-extrabold tabular-nums ${style.count}`}>{m.stock.toLocaleString("en-PH")}</p>
                    <p className="text-[0.7rem] text-gray-500">{m.form}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? "Gamot"}>
        {open && <MedicineDetail key={open.id} m={open} onDeleted={() => setOpenId(null)} />}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Bagong gamot">
        {adding && <MedicineForm onDone={() => setAdding(false)} />}
      </Modal>
    </div>
  );
}

