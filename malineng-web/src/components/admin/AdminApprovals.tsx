"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Plus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import {
  ACTION_DEFS,
  APPROVER_OPTIONS,
  FAST_BY_OPTIONS,
  MAX_STEPS,
  effectiveSteps,
  stepLabel,
  useApprovalConfig,
  type ActionCfg,
  type ActionKey,
  type ApprovalConfig,
} from "@/lib/approvalConfig";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/Toast";

/** Developer only: who approves each action, in order. Positions only (not named people). */
export function AdminApprovals() {
  const toast = useToast();
  const saved = useApprovalConfig();
  const [draft, setDraft] = useState<ApprovalConfig>(saved);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<ActionKey>("hiram");
  const [busy, setBusy] = useState(false);

  // Follow the saved settings until the Developer starts editing.
  useEffect(() => {
    if (!dirty) setDraft(saved);
  }, [saved, dirty]);

  const def = ACTION_DEFS.find((d) => d.key === sel)!;
  const cfg = draft[sel];
  const change = (patch: Partial<ActionCfg>) => {
    setDraft((d) => ({ ...d, [sel]: { ...d[sel], ...patch } }));
    setDirty(true);
  };
  const duplicate = cfg.on && new Set(cfg.steps).size !== cfg.steps.length;
  const anyDuplicate = (Object.values(draft) as ActionCfg[]).some((c) => c.on && new Set(c.steps).size !== c.steps.length);

  const flow = (c: ActionCfg) => (c.on ? effectiveSteps(c).map((s, i) => `${i + 1}. ${stepLabel(s)}`).join(" → ") : `Walang approval · ${stepLabel(c.steps[0])} ang nagpapasya`);

  const save = async () => {
    if (anyDuplicate) return toast("Ayusin muna: may parehong approver sa dalawang hakbang.", "error");
    setBusy(true);
    try {
      await setDoc(doc(db, "settings", "approvals"), { actions: draft, updatedAt: serverTimestamp() });
      logActivity("Approval", "Binago ang setting ng mga approver");
      setDirty(false);
      toast("Na-save. Ito na ang susundin ng app.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pb-20">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">
        <b className="text-gold">Developer lang</b> ang makakapagbago nito. Piliin ang aksyon, kung kailangan ng approval, at kung sino ang magpapasya sa bawat hakbang. Ang <b>Developer</b> ay laging may override.
      </p>

      <div className="space-y-2">
        {ACTION_DEFS.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={d.key === sel}
            onClick={() => setSel(d.key)}
            className={`w-full rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ${d.key === sel ? "ring-2 ring-gold" : "ring-gray-100"}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold">{d.name}</span>
              {!d.wired && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-bold text-gray-500">Susunod na bersyon</span>}
            </span>
            <span className="block text-xs text-gray-500">{d.ui}</span>
            <span className="mt-1 block text-xs font-semibold text-brand">{flow(draft[d.key])}{d.hasFast && draft[d.key].fast ? ` · Agaran: ${draft[d.key].fastBy ?? "Kapitan"}` : ""}</span>
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        <div>
          <h2 className="font-extrabold">{def.name}</h2>
          <p className="text-xs text-gray-500">Lalabas sa: {def.ui}</p>
          {!def.wired && <p className="mt-1 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">Hindi pa gumagana ang aksyong ito sa app. Mase-save ang setting at gagamitin kapag nai-connect na ito.</p>}
        </div>

        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Kailangan ng approval
          <button
            type="button"
            role="switch"
            aria-checked={cfg.on}
            onClick={() => change({ on: !cfg.on })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${cfg.on ? "bg-brand" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${cfg.on ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </label>

        <p className="text-xs font-bold tracking-wide text-gray-500">{cfg.on ? "MGA HAKBANG (AYON SA PAGKAKASUNOD)" : "SINO ANG MAGPAPASYA"}</p>
        {(cfg.on ? cfg.steps : cfg.steps.slice(0, 1)).map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-brand-deep">{i + 1}</span>
            <select
              value={step}
              aria-label={`Approver ${i + 1}`}
              onChange={(e) => change({ steps: cfg.steps.map((s, k) => (k === i ? e.target.value : s)) })}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
            >
              {APPROVER_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            {cfg.on && cfg.steps.length > 1 && (
              <button type="button" aria-label="Alisin ang hakbang" onClick={() => change({ steps: cfg.steps.filter((_, k) => k !== i) })} className="rounded-xl border border-gray-200 p-2.5 text-red-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {cfg.on && cfg.steps.length < MAX_STEPS && (
          <Button variant="outline" full onClick={() => change({ steps: [...cfg.steps, "Kapitan"] })}>
            <Plus className="h-4 w-4" aria-hidden /> Dagdagan ng hakbang (hanggang {MAX_STEPS})
          </Button>
        )}
        {duplicate && <p className="rounded-xl bg-yellow-50 p-2.5 text-xs font-semibold text-yellow-900">May dalawang hakbang na parehong approver. Dalawang magkaibang tao ang dapat magpasya sa bawat hakbang.</p>}

        {def.hasFast && cfg.on && (
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              May &quot;Agarang aprubahan&quot; (emergency)
              <button
                type="button"
                role="switch"
                aria-checked={cfg.fast === true}
                onClick={() => change({ fast: !cfg.fast, fastBy: cfg.fastBy ?? "Kapitan" })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${cfg.fast ? "bg-brand" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${cfg.fast ? "left-[1.4rem]" : "left-0.5"}`} />
              </button>
            </label>
            {cfg.fast && (
              <select value={cfg.fastBy ?? "Kapitan"} aria-label="Sino ang makakapag-agaran" onChange={(e) => change({ fastBy: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                {FAST_BY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <p className="rounded-xl bg-brand-deep p-3 text-xs text-white">
          <b className="text-gold">Daloy:</b> Residente → {effectiveSteps(cfg).map(stepLabel).join(" → ")} → <b className="text-gold">{sel === "balik" ? "Isinara" : "Nailabas"}</b>
          {def.hasFast && cfg.on && cfg.fast ? ` · Agaran: ${cfg.fastBy ?? "Kapitan"}` : ""}
        </p>
        <p className="text-xs text-gray-500">Kung walang may hawak ng posisyon, ang Developer ang magpapasya.</p>
      </Card>

      <div className="sticky bottom-[4.6rem] z-20 -mx-1 rounded-2xl bg-white/95 p-2 shadow-float backdrop-blur">
        <Button full loading={busy} disabled={!dirty} onClick={save}>I-save ang setting</Button>
      </div>
    </div>
  );
}
