"use client";

import { useState, type FormEvent } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { MEDICINE_CATEGORIES, MEDICINE_FORMS, RESTOCK_SOURCES, createMedicine, type Medicine } from "@/lib/botika";
import { Button, ErrorText, Input, Select, SelectOther } from "@/components/ui";
import { useToast } from "@/components/Toast";

function toInt(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

/** Add a new medicine (with starting stock), or edit an existing one's details. */
export function MedicineForm({ existing, onDone }: { existing?: Medicine; onDone: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [form, setForm] = useState<string>(existing?.form ?? MEDICINE_FORMS[0]);
  const [category, setCategory] = useState<string>(existing?.category ?? MEDICINE_CATEGORIES[0]);
  const [needsPrescription, setNeedsPrescription] = useState(existing?.needsPrescription ?? false);
  const [minStock, setMinStock] = useState(String(existing?.minStock ?? 20));
  const [expiry, setExpiry] = useState(existing?.expiry ?? "");
  const [stock, setStock] = useState("");
  const [source, setSource] = useState<string>(RESTOCK_SOURCES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setError("");
    const min = toInt(minStock);
    const start = existing ? 0 : toInt(stock || "0");
    if (!name.trim()) return setError("Ilagay ang pangalan ng gamot (hal. Paracetamol 500mg).");
    if (!(min >= 0)) return setError("Mali ang minimum na bilang.");
    if (!existing && !(start >= 0)) return setError("Mali ang panimulang bilang.");
    if (!existing && start > 0 && !expiry) return setError("Ilagay ang expiry date ng stock.");

    setBusy(true);
    try {
      if (existing) {
        await updateDoc(doc(db, "medicines", existing.id), {
          name: name.trim(),
          form,
          category,
          needsPrescription,
          minStock: min,
          expiry,
          updatedAt: serverTimestamp(),
        });
        logActivity("Botika", `Inayos ang detalye ng ${name.trim()}`, existing.id);
        toast("Na-save ang detalye.");
      } else {
        const id = await createMedicine(
          { name: name.trim(), form, category, needsPrescription, stock: start, minStock: min, expiry: start > 0 ? expiry : "" },
          { uid: user.uid, name: profile.fullName },
          source,
        );
        logActivity("Botika", `Nagdagdag ng bagong gamot: ${name.trim()} (${start} ${form})`, id);
        toast("Naidagdag ang gamot.");
      }
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Pangalan at lakas" placeholder="hal. Paracetamol 500mg" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Uri / unit" options={MEDICINE_FORMS} value={form} onChange={(e) => setForm(e.target.value)} />
        <Input label="Minimum (babala)" type="number" inputMode="numeric" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} hint="Paubos kapag ganito na lang" />
      </div>
      <SelectOther label="Kategorya" options={MEDICINE_CATEGORIES} value={category} onChange={setCategory} />
      <label className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm">
        <input type="checkbox" checked={needsPrescription} onChange={(e) => setNeedsPrescription(e.target.checked)} className="h-5 w-5 accent-brand" />
        Kailangan ng reseta (babala lang kapag ibinigay)
      </label>

      {existing ? (
        <Input label="Pinakamalapit na expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} hint="Itama lang kung mali ang naka-save." />
      ) : (
        <div className="space-y-3 rounded-xl bg-brand-light/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">Panimulang stock</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Dami" type="number" inputMode="numeric" min={0} placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            <Input label="Expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <SelectOther label="Galing saan" options={RESTOCK_SOURCES} value={source} onChange={setSource} />
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <Button type="submit" full loading={busy}>{existing ? "I-save" : "Idagdag ang gamot"}</Button>
    </form>
  );
}
