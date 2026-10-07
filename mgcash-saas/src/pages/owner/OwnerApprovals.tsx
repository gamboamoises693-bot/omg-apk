import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { approveTxn, rejectTxn, watchPending } from "../../services/transactions";
import { fmtDateTime, money } from "../../lib/format";
import { toDate } from "../../lib/dates";
import { TXN_LABEL, storeProfit } from "../../lib/fees";
import { Alert, Badge, Button, Card, Empty, LockedBadge, Modal, PageTitle, copyText } from "../../components/ui";
import type { Transaction } from "../../lib/types";

/**
 * Boss approval queue. "Approve + Copy" copies the locked number so Boss can paste it into
 * the GCash app (Boss holds the MPIN; tindera never sends big amounts on her own).
 */
export default function OwnerApprovals() {
  const { user } = useAuth();
  const { store } = useStore();
  const [list, setList] = useState<Transaction[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<Transaction | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => (store ? watchPending(store.id, setList, (e) => setMsg({ tone: "red", text: e.message })) : undefined), [store]);

  if (!store || !user) return null;

  const approve = async (t: Transaction) => {
    setBusyId(t.id);
    setMsg(null);
    try {
      await approveTxn(store.id, t.id, user.uid);
      const copied = await copyText(t.customer_number);
      setMsg({
        tone: "green",
        text:
          t.type === "cash_out"
            ? `Approved! I-verify na natanggap ang ${money(t.amount)} galing ${t.customer_number} bago ibigay ang cash.`
            : `Approved! ${copied ? "Na-copy" : "I-copy"} ang ${t.customer_number}. I-send ang ${money(t.amount)} sa GCash app.`,
      });
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await rejectTxn(store.id, rejecting.id, user.uid, reason.trim() || "Rejected by Boss");
      setMsg({ tone: "green", text: "Na-reject ang transaction." });
      setRejecting(null);
      setReason("");
    } catch (e) {
      setMsg({ tone: "red", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <PageTitle right={<Badge tone="blue">{list.length} pending</Badge>}>Approvals</PageTitle>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      {list.length === 0 ? <Empty>Walang pending. 🎉</Empty> : null}
      {list.map((t) => (
        <Card key={t.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-500">{TXN_LABEL[t.type]}</div>
              <div className="text-2xl font-black text-brand">{money(t.amount)}</div>
              <div className="text-xs text-slate-500">
                Fee {money(t.fee)} · Profit {money(storeProfit(t.fee, t.commission))} · {t.tindera_name}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              {fmtDateTime(toDate(t.created_at))}
              <div className="mt-1">
                <Badge tone="slate">{t.number_source === "qr" ? "📱 QR" : "⌨️ Keypad"}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-accent/15 px-3 py-2">
            <span className="font-mono text-xl font-black tracking-wider">{t.customer_number}</span>
            <LockedBadge />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" onClick={() => setRejecting(t)} disabled={busyId === t.id}>
              Reject
            </Button>
            <Button variant="success" className="col-span-2" loading={busyId === t.id} onClick={() => void approve(t)}>
              Approve + Copy
            </Button>
          </div>
        </Card>
      ))}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject Transaction">
        <div className="space-y-3">
          <input className="input" placeholder="Dahilan (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" className="w-full" loading={busyId === rejecting?.id} onClick={() => void doReject()}>
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}
