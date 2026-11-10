"use client";

import { useState } from "react";
import { Timestamp, collection, getDocs, query, where, type DocumentData } from "firebase/firestore";
import { Download, FileBarChart } from "lucide-react";
import { db } from "@/lib/firebase";
import { downloadCsv } from "@/lib/csv";
import { logActivity } from "@/lib/activity";
import { APPOINTMENT_SERVICES, AYUDA_STATUS_LABEL } from "@/lib/constants";
import { friendlyError } from "@/lib/format";
import { Button, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Row {
  section: string;
  label: string;
  value: number;
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: Timestamp.fromDate(new Date(y, m - 1, 1)), end: Timestamp.fromDate(new Date(y, m, 1)) };
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Docs in a collection whose time field falls inside the month (single-field range: no index needed). */
async function inMonth(name: string, field: string, month: string): Promise<DocumentData[]> {
  const { start, end } = monthRange(month);
  const snap = await getDocs(query(collection(db, name), where(field, ">=", start), where(field, "<", end)));
  return snap.docs.map((d) => d.data());
}

function countBy(list: DocumentData[], key: string): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, d) => {
    const k = String(d[key] ?? "—");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

export function AdminReport() {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const [users, verified, appts, docs, ambs, listings, jobs, posts, regs, lost, ayudaSnap, households] = await Promise.all([
        inMonth("users", "createdAt", month),
        inMonth("verifiedUsers", "verifiedAt", month),
        inMonth("appointments", "createdAt", month),
        inMonth("issuedDocuments", "issuedAt", month),
        inMonth("ambulanceRequests", "createdAt", month),
        inMonth("listings", "createdAt", month),
        inMonth("jobs", "createdAt", month),
        inMonth("posts", "createdAt", month),
        inMonth("registrations", "createdAt", month),
        inMonth("lostFound", "createdAt", month),
        getDocs(collection(db, "ayuda")),
        getDocs(collection(db, "households")),
      ]);

      const out: Row[] = [];
      const add = (section: string, label: string, value: number) => out.push({ section, label, value });

      add("Mga Residente", "Bagong nag-register", users.length);
      add("Mga Residente", "Na-verify (selfie)", verified.length);
      add("Mga Residente", "Kabuuang household (sa ngayon)", households.size);

      const byService = countBy(appts, "service");
      // Services written under "Iba pa" are counted together with "Iba pa".
      const listed = APPOINTMENT_SERVICES.filter((s) => s !== "Iba pa");
      APPOINTMENT_SERVICES.forEach((s) => add("Appointments", s, s === "Iba pa" ? appts.filter((a) => !(listed as readonly string[]).includes(a.service)).length : byService[s] ?? 0));
      add("Appointments", "Kabuuan", appts.length);
      add("Dokumentong na-issue", "Barangay Clearance", docs.filter((d) => d.type === "Barangay Clearance").length);
      add("Dokumentong na-issue", "Indigency", docs.filter((d) => d.type === "Indigency").length);

      add("Ambulansya", "Emergency request", ambs.filter((a) => a.type === "emergency").length);
      add("Ambulansya", "Naka-schedule na biyahe", ambs.filter((a) => a.type === "schedule").length);
      add("Ambulansya", "Natapos na biyahe", ambs.filter((a) => a.status === "done").length);
      add("Ambulansya", "Hindi naaprubahan / na-cancel", ambs.filter((a) => a.status === "rejected" || a.status === "cancelled").length);

      const ayuda = countBy(ayudaSnap.docs.map((d) => d.data()), "status");
      Object.entries(AYUDA_STATUS_LABEL).forEach(([k, label]) => add("Ayuda (sa ngayon)", label, ayuda[k] ?? 0));

      add("Komunidad", "Paninda sa Tindahan", listings.length);
      add("Komunidad", "Trabahong na-post", jobs.length);
      add("Komunidad", "Post sa Board", posts.length);
      add("Komunidad", "Lost & Found report", lost.length);
      Object.entries(countBy(regs, "purpose")).forEach(([k, v]) => add("Nagparehistro", k, v));

      setRows(out);
      logActivity("Settings", `Gumawa ng monthly report para sa ${month}`);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("fil-PH", { month: "long", year: "numeric" });
  const sections = rows ? Array.from(new Set(rows.map((r) => r.section))) : [];

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-sm text-gray-600">Buod ng mga serbisyo bawat buwan, para sa Sangguniang Barangay at sa ulat sa munisipyo.</p>
        <label className="block">
          <span className="mb-1 block text-[0.85rem] font-semibold text-gray-700">Buwan</span>
          <input type="month" value={month} max={currentMonth()} onChange={(e) => { setMonth(e.target.value); setRows(null); }} className="w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5" />
        </label>
        <Button full loading={busy} onClick={generate}><FileBarChart className="h-4 w-4" /> Gumawa ng report</Button>
      </Card>

      {busy && <Spinner label="Binibilang..." />}
      {rows && !busy && (
        <>
          <p className="text-center text-sm font-bold">Ulat para sa {monthLabel}</p>
          {sections.map((sec) => (
            <div key={sec} className="overflow-hidden rounded-2xl bg-white shadow-card">
              <p className="bg-brand-light px-4 py-2 text-sm font-bold text-brand">{sec}</p>
              <ul className="divide-y divide-gray-100">
                {rows.filter((r) => r.section === sec).map((r) => (
                  <li key={r.label} className="flex justify-between px-4 py-2 text-sm">
                    <span>{r.label}</span>
                    <span className="font-bold tabular-nums">{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Button variant="outline" full onClick={() => downloadCsv(`malineng-report-${month}.csv`, [["Bahagi", "Item", "Bilang"], ...rows.map((r) => [r.section, r.label, r.value])])}>
            <Download className="h-4 w-4" /> I-export bilang CSV
          </Button>
        </>
      )}
    </div>
  );
}
