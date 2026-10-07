import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "./AdminContext";
import { approvePayment, getPaymentProof, rejectPayment, reminderMessage } from "../../services/payments";
import { nextDueDate } from "../../lib/subscription";
import { fmtDate, fmtDateTime, money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { Alert, Badge, Button, Card, Empty, Modal, PageTitle, Spinner, copyText } from "../../components/ui";
import { SubStatusBadge } from "../../components/StatusBadge";
import type { Payment } from "../../lib/types";

export default function AdminBilling() {
  const { payments, stores, config } = useAdmin();
  const [tab, setTab] = useState<"pending" | "all" | "due">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [proof, setProof] = useState<{ p: Payment; url: string | null } | null>(null);

  const list = tab === "pending" ? payments.filter((p) => p.status === "pending") : payments;
  const dueSoon = stores
    .filter((s) => s.status !== "deactivated")
    .map((s) => ({ s, due: nextDueDate({ trial_end: toDate(s.trial_end) ?? new Date(0), subscription_end: toDate(s.subscription_end), deactivated: s.deactivated }) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());

  const act = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "green", text: ok });
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const openProof = async (p: Payment) => {
    setProof({ p, url: null });
    const url = await getPaymentProof(p.id).catch(() => null);
    setProof({ p, url: url ?? "" });
  };

  return (
    <div className="space-y-3">
      <PageTitle>Billing & Payments</PageTitle>
      <div className="grid grid-cols-3 gap-2">
        <Button variant={tab === "pending" ? "primary" : "ghost"} onClick={() => setTab("pending")}>
          Pending ({payments.filter((p) => p.status === "pending").length})
        </Button>
        <Button variant={tab === "all" ? "primary" : "ghost"} onClick={() => setTab("all")}>
          All
        </Button>
        <Button variant={tab === "due" ? "primary" : "ghost"} onClick={() => setTab("due")}>
          Due Dates
        </Button>
      </div>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      {tab === "due" ? (
        <Card className="p-0">
          <ul className="divide-y text-sm">
            {dueSoon.map(({ s, due }) => {
              const text = reminderMessage(s, config.admin_gcash, config.monthly_price, due);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <Link to={`/admin/stores/${s.id}`} className="font-bold text-brand">
                      {s.store_name}
                    </Link>{" "}
                    <SubStatusBadge status={s.status} />
                    <div className="text-xs text-slate-500">
                      Next due {fmtDate(due)} · {s.owner_phone}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => void copyText(text).then(() => setMsg({ tone: "green", text: "Copied!" }))}>
                      Copy
                    </Button>
                    <a className="btn min-h-9 bg-brand px-3 text-xs text-white" href={`sms:${s.owner_phone}?body=${encodeURIComponent(text)}`}>
                      Send GCash Reminder
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : list.length === 0 ? (
        <Empty>Walang payment dito.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-brand-light text-left text-xs text-brand">
              <tr>
                <th className="p-2">Store</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2">Date</th>
                <th className="p-2">GCash Ref</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="p-2">
                    <Link to={`/admin/stores/${p.store_id}`} className="font-semibold text-brand">
                      {p.store_name}
                    </Link>
                  </td>
                  <td className="p-2 text-right">{money(p.amount)}</td>
                  <td className="p-2">
                    {fmtDateTime(toDate(p.paid_at ?? null) ?? toDate(p.created_at))}
                    {p.period_end ? <div className="text-xs text-slate-500">until {fmtDate(toDate(p.period_end))}</div> : null}
                  </td>
                  <td className="p-2">{p.gcash_ref || "-"}</td>
                  <td className="p-2">
                    <Badge tone={p.status === "paid" ? "green" : p.status === "pending" ? "yellow" : "red"}>{p.status}</Badge>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {p.has_proof ? (
                        <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => void openProof(p)}>
                          Proof
                        </Button>
                      ) : null}
                      {p.status === "pending" ? (
                        <>
                          <Button
                            variant="success"
                            className="min-h-8 px-2 text-xs"
                            loading={busy === p.id}
                            onClick={() => void act(p.id, () => approvePayment(p.id, { monthly: config.monthly_price, daily: config.daily_price }), `Approved ${p.store_name}. Na-extend ang subscription.`)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            className="min-h-8 px-2 text-xs"
                            disabled={busy === p.id}
                            onClick={() => {
                              const note = prompt("Dahilan ng reject?") ?? "";
                              void act(p.id, () => rejectPayment(p.id, note), "Rejected.");
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!proof} onClose={() => setProof(null)} title={`Proof - ${proof?.p.store_name ?? ""}`}>
        {proof?.url === null ? (
          <div className="flex justify-center p-6 text-brand">
            <Spinner />
          </div>
        ) : proof?.url ? (
          <img src={proof.url} alt="GCash proof" className="w-full rounded-lg" />
        ) : (
          <Alert>Walang proof na nakita.</Alert>
        )}
        {proof ? (
          <p className="mt-2 text-sm">
            {money(proof.p.amount)} · Ref <b>{proof.p.gcash_ref}</b>
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
