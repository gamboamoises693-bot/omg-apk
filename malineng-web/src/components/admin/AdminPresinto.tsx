"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { Camera, FileSpreadsheet, Trash2, Vote } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import {
  cleanName,
  cleanPrecinct,
  csvToRows,
  guessCsvColumns,
  nameToKey,
  parseCsv,
  parsePcvlText,
  rowId,
  rowProblem,
  type CsvField,
  type DraftRow,
  type PrecinctMeta,
  type PrecinctStats,
} from "@/lib/presinto";
import { Button, Card, ErrorText, Input, Modal } from "@/components/ui";

const BATCH = 400;
const SHOW_LIMIT = 80;

/** Grayscale + contrast + sensible size: small, low-contrast phone photos read much better. */
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const target = 2000;
  const scale = bitmap.width < target ? target / bitmap.width : Math.min(1, 3000 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Hindi mabuksan ang canvas ng browser.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = Math.max(0, Math.min(255, (gray - 128) * 1.3 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const CSV_LABELS: { key: CsvField; label: string }[] = [
  { key: "full", label: "Buong pangalan (APELYIDO, PANGALAN)" },
  { key: "last", label: "Apelyido" },
  { key: "first", label: "Pangalan" },
  { key: "middle", label: "Middle name" },
  { key: "address", label: "Address" },
  { key: "precinct", label: "Presinto" },
  { key: "remarks", label: "Remarks" },
];

/** Delete every voter, 400 at a time (Firestore batch limit is 500). */
async function wipeVoters(onProgress?: (n: number) => void): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, "precinctVoters"), limit(BATCH)));
    if (snap.empty) return total;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    onProgress?.(total);
  }
}

function VoterImport({ meta }: { meta: PrecinctMeta | null }) {
  const { isSuperAdmin } = useAuth();
  const photoInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [onlyBad, setOnlyBad] = useState(false);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [csv, setCsv] = useState<{ data: string[][]; header: string[]; map: Partial<Record<CsvField, number>> } | null>(null);
  const [done, setDone] = useState("");
  const seq = useRef(0);

  const withProblems = useMemo(() => rows.map((r) => ({ r, problem: rowProblem(r) })), [rows]);
  const badCount = withProblems.filter((x) => x.problem).length;
  const shown = (onlyBad ? withProblems.filter((x) => x.problem) : withProblems).slice(0, SHOW_LIMIT);

  function addRows(list: Omit<DraftRow, "key">[]) {
    setRows((prev) => [...prev, ...list.map((r) => ({ ...r, key: `r${seq.current++}` }))]);
  }

  async function readPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setDone("");
    setBusy(true);
    try {
      setStatus("Inihahanda ang OCR (unang beses lang ito mabagal)...");
      const { createWorker, PSM } = await import("tesseract.js");
      let page = 0;
      const worker = await createWorker("eng", 1, {
        langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int",
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(((page + m.progress) / files.length) * 100));
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
      try {
        for (let i = 0; i < files.length; i++) {
          page = i;
          setStatus(`Binabasa ang larawan ${i + 1} sa ${files.length} (sa phone mo lang ito, walang ipinapadala)`);
          const canvas = await prepareImage(files[i]);
          const { data } = await worker.recognize(canvas);
          const parsed = parsePcvlText(data.text);
          if (!parsed.rows.length) setError((e) => `${e}Walang nabasang hanay sa larawan ${i + 1}. Subukan ng mas malinaw na kuha. `);
          addRows(parsed.rows);
        }
      } finally {
        await worker.terminate();
      }
      setStatus("Tapos na. Suriin ang mga hanay sa ibaba bago i-save.");
    } catch (err) {
      setError(friendlyError(err));
      setStatus("");
    } finally {
      setBusy(false);
      setProgress(null);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function readCsv(file: File | undefined) {
    if (!file) return;
    setError("");
    setDone("");
    try {
      const data = parseCsv(await file.text());
      if (data.length < 2) throw new Error("Walang laman ang file.");
      setCsv({ data: data.slice(1), header: data[0], map: guessCsvColumns(data[0]) });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      if (csvInput.current) csvInput.current.value = "";
    }
  }

  function applyCsv() {
    if (!csv) return;
    if (csv.map.full === undefined && (csv.map.last === undefined || csv.map.first === undefined)) {
      setError("Piliin ang hanay ng pangalan (buo, o apelyido at pangalan).");
      return;
    }
    if (csv.map.precinct === undefined) {
      setError("Piliin ang hanay ng presinto.");
      return;
    }
    addRows(csvToRows(csv.data, csv.map));
    setCsv(null);
    setError("");
  }

  function patch(key: string, field: keyof DraftRow, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  async function save() {
    setError("");
    setDone("");
    if (badCount) {
      setError(`May ${badCount} hanay na kailangang itama o burahin muna.`);
      return;
    }
    if (!rows.length) return;
    setSaving(true);
    try {
      if (mode === "replace" && isSuperAdmin) {
        setStatus("Binubura ang lumang listahan...");
        await wipeVoters((n) => setStatus(`Nabura ang ${n}...`));
      }
      // Same person + address + precinct = same doc id, so re-uploading a page never duplicates.
      const unique = new Map<string, DraftRow>();
      for (const r of rows) unique.set(await rowId(r), r);
      const entries = [...unique.entries()];
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = writeBatch(db);
        for (const [id, r] of entries.slice(i, i + BATCH)) {
          batch.set(doc(db, "precinctVoters", id), {
            name: cleanName(r.name),
            nameKey: nameToKey(r.name),
            address: r.address.trim().slice(0, 200),
            precinct: cleanPrecinct(r.precinct),
            remarks: (r.remarks.trim() || "ACTIVE").toUpperCase().slice(0, 30),
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
        setStatus(`Na-save ang ${Math.min(i + BATCH, entries.length)} sa ${entries.length}...`);
      }
      const total = (await getCountFromServer(collection(db, "precinctVoters"))).data().count;
      const precincts = [...new Set([...(mode === "replace" ? [] : (meta?.precincts ?? [])), ...rows.map((r) => cleanPrecinct(r.precinct))])].sort();
      await setDoc(
        doc(db, "precinctMeta", "current"),
        {
          count: total,
          precincts,
          electionDate: meta?.electionDate ?? "",
          electionName: meta?.electionName ?? "",
          defaultPlace: meta?.defaultPlace ?? "",
          places: meta?.places ?? {},
          listDate: meta?.listDate ?? "",
          uploadedAt: serverTimestamp(),
        },
        { merge: true },
      );
      // Counters start at zero (officers may create them; residents only add 1 per search).
      await setDoc(doc(db, "precinctStats", "current"), { searches: 0, found: 0, notFound: 0 }).catch(() => {});
      logActivity("Presinto", `Nag-upload ng ${entries.length} botante (${mode === "replace" ? "pinalitan ang listahan" : "idinagdag"})`);
      setDone(`Na-save ang ${entries.length} botante. Kabuuan ngayon: ${total.toLocaleString("en-PH")}.`);
      setRows([]);
      setStatus("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-xs font-bold tracking-wide text-gray-600">BAGONG UPLOAD</p>
        <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => readPhotos(e.target.files)} />
        <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => readCsv(e.target.files?.[0])} />
        <button
          type="button"
          disabled={busy || saving}
          onClick={() => photoInput.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-light px-4 py-4 font-extrabold text-brand active:bg-blue-100 disabled:opacity-60"
        >
          <Camera className="h-5 w-5" aria-hidden /> Kunan o pumili ng LARAWAN ng listahan
        </button>
        <Button variant="outline" full disabled={busy || saving} onClick={() => csvInput.current?.click()}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden /> O pumili ng CSV (mas tumpak)
        </Button>
        <p className="rounded-xl bg-gold-light px-3 py-2 text-xs text-yellow-900">
          <b>Tips sa larawan:</b> patag ang papel, maliwanag, walang anino, isang page bawat litrato. Para sa Excel, i-“Save as CSV” muna.
        </p>
        {busy && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress ?? 5}%` }} />
            </div>
          </div>
        )}
        {status && <p className="text-center text-xs text-gray-600">{status}</p>}
        <ErrorText>{error}</ErrorText>
        {done && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{done}</p>}
      </Card>

      {csv && (
        <Card className="space-y-2">
          <p className="text-sm font-bold">Itugma ang mga hanay ({csv.data.length.toLocaleString("en-PH")} hanay)</p>
          {CSV_LABELS.map(({ key, label }) => (
            <label key={key} className="grid grid-cols-2 items-center gap-2 text-sm">
              <span>{label}</span>
              <select
                value={csv.map[key] ?? ""}
                onChange={(e) => setCsv({ ...csv, map: { ...csv.map, [key]: e.target.value === "" ? undefined : Number(e.target.value) } })}
                className="rounded-xl border border-gray-200 bg-white px-2 py-2"
                aria-label={label}
              >
                <option value="">(wala)</option>
                {csv.header.map((h, i) => (
                  <option key={i} value={i}>{h || `Hanay ${i + 1}`}</option>
                ))}
              </select>
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={() => setCsv(null)}>Kanselahin</Button>
            <Button onClick={applyCsv}>Basahin</Button>
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{rows.length - badCount} ayos</span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{badCount} kailangang itama</span>
            {badCount > 0 && (
              <button type="button" onClick={() => setOnlyBad((v) => !v)} className="ml-auto text-brand underline">
                {onlyBad ? "Ipakita lahat" : "Pula lang"}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {shown.map(({ r, problem }) => (
              <div key={r.key} className={`space-y-1.5 rounded-xl border p-2 ${problem ? "border-red-300 bg-red-50" : "border-gray-100"}`}>
                <div className="flex gap-1.5">
                  <input
                    value={r.name}
                    onChange={(e) => patch(r.key, "name", e.target.value)}
                    aria-label="Pangalan"
                    placeholder="APELYIDO, PANGALAN M."
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-semibold uppercase"
                  />
                  <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} aria-label="Burahin ang hanay" className="rounded-lg bg-white px-2 text-red-600 active:bg-red-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-[1fr_5rem_5.5rem] gap-1.5">
                  <input value={r.address} onChange={(e) => patch(r.key, "address", e.target.value)} aria-label="Address" placeholder="Address" className="min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" />
                  <input value={r.precinct} onChange={(e) => patch(r.key, "precinct", e.target.value)} aria-label="Presinto" placeholder="0123A" className="min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold uppercase" />
                  <input value={r.remarks} onChange={(e) => patch(r.key, "remarks", e.target.value)} aria-label="Remarks" placeholder="ACTIVE" className="min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs uppercase" />
                </div>
                {problem && <p className="text-[0.7rem] font-semibold text-red-700">{problem}</p>}
              </div>
            ))}
          </div>
          {(onlyBad ? badCount : rows.length) > SHOW_LIMIT && (
            <p className="text-xs text-gray-600">Ipinapakita ang unang {SHOW_LIMIT}. Itama ang pula, pagkatapos lalabas ang susunod.</p>
          )}

          {isSuperAdmin ? (
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === "append"} onChange={() => setMode("append")} className="accent-brand" /> Idagdag lang sa dati (susunod na page o presinto)</label>
              <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="accent-brand" /> Palitan ang buong listahan (burahin ang luma)</label>
            </div>
          ) : (
            <p className="text-xs text-gray-600">Idadagdag ito sa kasalukuyang listahan. Super Admin lang ang makakapagpalit o makakaburá ng buong listahan.</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={saving} onClick={() => setRows([])}>Itapon lahat</Button>
            <Button loading={saving} disabled={badCount > 0} onClick={save}>I-save ang {rows.length}</Button>
          </div>
          <p className="text-center text-xs text-gray-600">Hindi mase-save ang hanay na pula hangga’t hindi naitatama o nabubura.</p>
        </Card>
      )}
    </div>
  );
}

export function AdminPresinto() {
  const { isSuperAdmin } = useAuth();
  const [meta, setMeta] = useState<PrecinctMeta | null>(null);
  const [stats, setStats] = useState<PrecinctStats | null>(null);
  const [form, setForm] = useState({ electionName: "", electionDate: "", listDate: "", defaultPlace: "" });
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);

  useEffect(
    () =>
      onSnapshot(doc(db, "precinctMeta", "current"), (snap) => {
        const m = snap.exists() ? (snap.data() as PrecinctMeta) : null;
        setMeta(m);
        // Fill the form once; afterwards the person typing owns it.
        if (m && !loaded.current) {
          loaded.current = true;
          setForm({ electionName: m.electionName ?? "", electionDate: m.electionDate ?? "", listDate: m.listDate ?? "", defaultPlace: m.defaultPlace ?? "" });
          setPlaces(m.places ?? {});
        }
      }),
    [],
  );
  useEffect(() => onSnapshot(doc(db, "precinctStats", "current"), (snap) => setStats(snap.exists() ? (snap.data() as PrecinctStats) : null), () => setStats(null)), []);

  async function saveInfo() {
    setSavingInfo(true);
    setInfoMsg("");
    setError("");
    try {
      const cleanPlaces = Object.fromEntries(Object.entries(places).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
      await setDoc(
        doc(db, "precinctMeta", "current"),
        {
          count: meta?.count ?? 0,
          precincts: meta?.precincts ?? [],
          electionName: form.electionName.trim(),
          electionDate: form.electionDate.trim(),
          listDate: form.listDate.trim(),
          defaultPlace: form.defaultPlace.trim(),
          places: cleanPlaces,
        },
        { merge: true },
      );
      logActivity("Presinto", "Binago ang petsa at lugar ng botohan");
      setInfoMsg("Na-save.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSavingInfo(false);
    }
  }

  async function wipeAll() {
    setWiping(true);
    setError("");
    try {
      const n = await wipeVoters();
      await setDoc(doc(db, "precinctMeta", "current"), { count: 0, precincts: [], uploadedAt: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, "precinctStats", "current"), { searches: 0, found: 0, notFound: 0 });
      logActivity("Presinto", `Binura ang buong listahan ng botante (${n})`);
      setWipeOpen(false);
      setConfirmText("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setWiping(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-extrabold"><Vote className="h-4 w-4 text-brand" aria-hidden /> Kasalukuyang listahan</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-extrabold ${meta && meta.count > 0 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
            {meta && meta.count > 0 ? "MAY LISTAHAN" : "WALA PA"}
          </span>
        </div>
        <p className="text-sm text-gray-700">
          {(meta?.count ?? 0).toLocaleString("en-PH")} botante · {meta?.precincts?.length ?? 0} presinto
          {meta?.precincts?.length ? ` (${meta.precincts.join(", ")})` : ""}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { n: stats?.searches ?? 0, label: "Naghanap", color: "text-brand" },
            { n: stats?.found ?? 0, label: "Nahanap", color: "text-emerald-700" },
            { n: stats?.notFound ?? 0, label: "Hindi nahanap", color: "text-amber-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-gray-50 px-1 py-2">
              <p className={`font-extrabold ${s.color}`}>{s.n.toLocaleString("en-PH")}</p>
              <p className="text-[0.7rem] text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600">Bilang lang ito ng paghahanap. Walang pangalan ng naghanap na naitatala.</p>
      </Card>

      <VoterImport meta={meta} />

      <Card className="space-y-3">
        <p className="text-xs font-bold tracking-wide text-gray-600">PETSA AT LUGAR NG BOTOHAN</p>
        <Input label="Pangalan ng halalan" value={form.electionName} onChange={(e) => setForm({ ...form, electionName: e.target.value })} placeholder="hal. Barangay at SK Elections" />
        <Input label="Petsa ng halalan" value={form.electionDate} onChange={(e) => setForm({ ...form, electionDate: e.target.value })} placeholder="hal. Mayo 12, 2026" />
        <Input label="Petsa ng listahan" value={form.listDate} onChange={(e) => setForm({ ...form, listDate: e.target.value })} placeholder="hal. Abril 2, 2026" hint="Lalabas sa paalala sa resulta." />
        <Input label="Lugar ng botohan (default)" value={form.defaultPlace} onChange={(e) => setForm({ ...form, defaultPlace: e.target.value })} placeholder="hal. Malineng Elementary School" />
        {(meta?.precincts ?? []).map((p) => (
          <Input key={p} label={`Lugar ng presinto ${p} (kung iba)`} value={places[p] ?? ""} onChange={(e) => setPlaces({ ...places, [p]: e.target.value })} placeholder="Iwanang blangko kung pareho sa default" />
        ))}
        {infoMsg && <p className="text-sm font-semibold text-emerald-700">{infoMsg}</p>}
        <Button full loading={savingInfo} onClick={saveInfo}>I-save</Button>
      </Card>

      <ErrorText>{error}</ErrorText>

      {isSuperAdmin && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-900">
          <span><b>Pagkatapos ng halalan:</b> burahin ang listahan para protektado ang datos (RA 10173).</span>
          <Button variant="danger" onClick={() => setWipeOpen(true)} disabled={!meta?.count}>Burahin lahat</Button>
        </div>
      )}

      <Modal open={wipeOpen} onClose={() => !wiping && setWipeOpen(false)} title="Burahin ang buong listahan?">
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Mabubura ang lahat ng {(meta?.count ?? 0).toLocaleString("en-PH")} botante at hindi na ito maibabalik. I-type ang <b>BURAHIN</b> para magpatuloy.</p>
          <Input label="Kumpirmasyon" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={wiping} onClick={() => setWipeOpen(false)}>Huwag</Button>
            <Button variant="danger" loading={wiping} disabled={confirmText.trim().toUpperCase() !== "BURAHIN"} onClick={wipeAll}>Burahin</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
