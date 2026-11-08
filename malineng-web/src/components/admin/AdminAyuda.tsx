"use client";

import { useMemo, useState, type FormEvent } from "react";
import { collection, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { Pencil, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { AYUDA_STATUS_LABEL } from "@/lib/constants";
import { friendlyError, normalizeName } from "@/lib/format";
import type { Ayuda } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Input, SectionTitle, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { logActivity } from "@/lib/activity";

const ayudaCollection = collection(db, "ayuda");
const STATUSES = ["qualified", "scheduled", "claimed"] as const;
const EMPTY = { controlNumber: "", fullName: "", program: "", status: "qualified", remarks: "" };

/** Control number becomes the document ID, so it must be safe for Firestore paths. */
function cleanControlNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, "");
}

export function AdminAyuda() {
  const toast = useToast();
  const { data, loading } = useCollection<Ayuda>(ayudaCollection);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [csv, setCsv] = useState("");

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return data.filter((a) => !t || `${a.fullName} ${a.controlNumber} ${a.program}`.toLowerCase().includes(t)).slice(0, 100);
  }, [data, search]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const id = cleanControlNumber(form.controlNumber);
    if (!id || !form.fullName.trim() || !form.program.trim()) return setError("Kailangan ang Control Number, Pangalan at Program.");
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "ayuda", id), {
        controlNumber: id,
        fullName: form.fullName.trim(),
        nameLower: normalizeName(form.fullName),
        program: form.program.trim(),
        status: form.status,
        remarks: form.remarks.trim(),
        updatedAt: serverTimestamp(),
      });
      logActivity("Ayuda", `Nag-save ng ayuda record ${id} (${form.fullName.trim()}): ${form.status}`, id);
      toast("Na-save ang ayuda record.");
      setForm(EMPTY);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  /** CSV format per line: controlNumber,fullName,program,status,remarks */
  const handleImport = async () => {
    const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    try {
      // Firestore batch limit is 500 writes.
      for (let i = 0; i < lines.length; i += 450) {
        const batch = writeBatch(db);
        lines.slice(i, i + 450).forEach((line) => {
          const [cn, name, program, status = "qualified", ...rest] = line.split(",").map((s) => s.trim());
          const id = cleanControlNumber(cn ?? "");
          if (!id || !name) return;
          batch.set(doc(db, "ayuda", id), {
            controlNumber: id,
            fullName: name,
            nameLower: normalizeName(name),
            program: program ?? "",
            status: (STATUSES as readonly string[]).includes(status) ? status : "qualified",
            remarks: rest.join(", "),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      logActivity("Ayuda", `Nag-import ng ${lines.length} ayuda records (CSV)`);
      toast(`Na-import ang ${lines.length} records.`);
      setCsv("");
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Burahin ang record na ito?")) return;
    try {
      await deleteDoc(doc(db, "ayuda", id));
      logActivity("Ayuda", `Nagbura ng ayuda record ${id}`, id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div>
      <Card>
        <form onSubmit={handleSave} className="space-y-3">
          <Input label="Control Number" placeholder="AYD-2026-0001" value={form.controlNumber} onChange={update("controlNumber")} />
          <Input label="Buong Pangalan" placeholder="Juan Dela Cruz" value={form.fullName} onChange={update("fullName")} />
          <Input label="Program" placeholder="AICS / 4Ps / Senior Pension" value={form.program} onChange={update("program")} />
          <Select label="Status" options={STATUSES} value={form.status} onChange={update("status")} />
          <Textarea label="Remarks" placeholder="Hal. Kunin sa Barangay Hall, Nov 15, 9AM. Magdala ng ID." value={form.remarks} onChange={update("remarks")} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" full loading={saving}>I-save (Add / Update)</Button>
        </form>
      </Card>

      <SectionTitle>Bulk Import (CSV)</SectionTitle>
      <Card className="space-y-3">
        <Textarea label="I-paste ang listahan" hint="Isang tao bawat linya: controlNumber,fullName,program,status,remarks" placeholder={"AYD-001,Juan Dela Cruz,AICS,qualified,\nAYD-002,Maria Santos,Senior Pension,scheduled,Nov 20"} value={csv} onChange={(e) => setCsv(e.target.value)} />
        <Button variant="outline" full onClick={handleImport} disabled={!csv.trim()}><Upload className="h-5 w-5" /> I-import</Button>
      </Card>

      <SectionTitle>Records ({data.length})</SectionTitle>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hanapin..." className="mb-3 w-full rounded-xl border-2 border-gray-200 px-4 py-3" aria-label="Hanapin ang record" />
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{a.fullName}</p>
                <p className="text-sm text-gray-500">{a.id} · {a.program}</p>
                <Badge color={a.status === "claimed" ? "gray" : a.status === "scheduled" ? "gold" : "green"}>{AYUDA_STATUS_LABEL[a.status]}</Badge>
              </div>
              <button
                onClick={() => {
                  setForm({ controlNumber: a.id, fullName: a.fullName, program: a.program, status: a.status, remarks: a.remarks ?? "" });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-full p-2 text-brand"
                aria-label="I-edit"
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button onClick={() => remove(a.id)} className="rounded-full p-2 text-gray-400" aria-label="Burahin"><Trash2 className="h-5 w-5" /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
