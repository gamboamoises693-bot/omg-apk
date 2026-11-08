"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Phone, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/constants";
import { formatDate, friendlyError, telHref } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

const appointmentsCollection = collection(db, "appointments");

export function AdminAppointments() {
  const toast = useToast();
  const [filter, setFilter] = useState<AppointmentStatus | "lahat">("natanggap");
  const { data, loading } = useCollection<Appointment>(appointmentsCollection);

  const items = useMemo(
    () => data.filter((a) => filter === "lahat" || a.status === filter).sort((a, b) => a.date.localeCompare(b.date)),
    [data, filter],
  );

  const setStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await updateDoc(doc(db, "appointments", id), { status });
      toast(`Status: ${APPOINTMENT_STATUS_LABEL[status]}`);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Burahin ang appointment record na ito?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["natanggap", "nasa_kagawad", "ready", "lahat"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`shrink-0 rounded-full px-4 py-2 font-semibold ${filter === s ? "bg-brand text-white" : "bg-white ring-1 ring-gray-200"}`}>
            {s === "lahat" ? "Lahat" : APPOINTMENT_STATUS_LABEL[s].split(" —")[0]} ({s === "lahat" ? data.length : data.filter((a) => a.status === s).length})
          </button>
        ))}
      </div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="Walang appointment dito" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge color="gold">{a.service}</Badge>
                  <p className="mt-1 text-base font-bold">{a.fullName}</p>
                  <p className="text-gray-600">{formatDate(a.date)} · Ref {a.id.slice(0, 8).toUpperCase()}</p>
                  {a.notes && <p className="mt-1 whitespace-pre-line text-gray-700">{a.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <a href={telHref(a.contact)} className="rounded-full bg-brand p-2 text-white" aria-label="Tawagan"><Phone className="h-5 w-5" /></a>
                  <button onClick={() => remove(a.id)} className="rounded-full p-2 text-gray-400" aria-label="Burahin"><Trash2 className="h-5 w-5" /></button>
                </div>
              </div>
              <select
                value={a.status}
                onChange={(e) => setStatus(a.id, e.target.value as AppointmentStatus)}
                className="mt-3 w-full rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold"
                aria-label="Status"
              >
                {APPOINTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
