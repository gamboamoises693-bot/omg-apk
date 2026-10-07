import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useStore } from "../../context/StoreContext";
import { updateStoreInfo } from "../../services/stores";
import { authErrorMessage } from "../../lib/authEmail";
import { normalizePhone, PHONE_RE } from "../../lib/format";
import { Alert, Button, Card, Field, PageTitle, copyText } from "../../components/ui";
import { SubStatusBadge } from "../../components/StatusBadge";

export default function OwnerSettings() {
  const { store, status, daysLeft } = useStore();
  const [f, setF] = useState<Record<string, string>>({});
  // Values the form was seeded with; balances are only written if the owner changed them,
  // so a save never overwrites approvals that happened while the page was open.
  const [seed, setSeed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  useEffect(() => {
    if (!store) return;
    const initial = {
      store_name: store.store_name,
      owner_name: store.owner_name,
      address: store.address,
      gcash_number_for_business: store.gcash_number_for_business,
      owner_gcash: store.owner_gcash,
      gcash_fund: String(store.gcash_fund),
      cash_float: String(store.cash_float),
      low_fund_threshold: String(store.low_fund_threshold),
      fee_per_500: String(store.fee_per_500),
      load_fee: String(store.load_fee),
    };
    setF(initial);
    setSeed(initial);
    // Only seed the form when switching stores, not on every live balance update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  if (!store) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const gcashBiz = normalizePhone(f.gcash_number_for_business);
    const ownerGcash = normalizePhone(f.owner_gcash);
    const nums = ["gcash_fund", "cash_float", "low_fund_threshold", "fee_per_500", "load_fee"].map((k) => Number(f[k]));
    if (!PHONE_RE.test(gcashBiz) || !PHONE_RE.test(ownerGcash)) return setMsg({ tone: "red", text: "Mali ang GCash number format." });
    if (nums.some((n) => !Number.isFinite(n))) return setMsg({ tone: "red", text: "Invalid na numero." });
    setBusy(true);
    setMsg(null);
    try {
      await updateStoreInfo(store.id, {
        store_name: f.store_name.trim(),
        owner_name: f.owner_name.trim(),
        address: f.address.trim(),
        gcash_number_for_business: gcashBiz,
        owner_gcash: ownerGcash,
        ...(f.gcash_fund !== seed.gcash_fund ? { gcash_fund: nums[0] } : {}),
        ...(f.cash_float !== seed.cash_float ? { cash_float: nums[1] } : {}),
        low_fund_threshold: nums[2],
        fee_per_500: nums[3],
        load_fee: nums[4],
      });
      setSeed({ ...f });
      setMsg({ tone: "green", text: "Na-save!" });
    } catch (e2) {
      setMsg({ tone: "red", text: (e2 as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle>Settings</PageTitle>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <b>Subscription</b>
          <SubStatusBadge status={status} />
        </div>
        <p className="text-sm text-slate-600">{daysLeft} araw na natitira.</p>
        <Link to="/owner/pay" className="btn w-full bg-accent text-slate-900">
          Magbayad / Upload Proof
        </Link>
        <div className="rounded-xl bg-brand-light p-3 text-sm">
          🎁 Referral code mo: <b>{store.store_code}</b> — kapag may nag-sign up gamit ito at nagbayad, <b>1 month FREE</b> ka.
          <Button variant="ghost" className="mt-2 min-h-9 w-full text-sm" onClick={() => void copyText(store.store_code)}>
            Copy Code
          </Button>
        </div>
      </Card>

      <Card>
        <form onSubmit={save} className="space-y-3">
          <h2 className="font-bold text-brand">Store Info</h2>
          <Field label="Store Name" value={f.store_name ?? ""} onChange={set("store_name")} />
          <Field label="Owner Name" value={f.owner_name ?? ""} onChange={set("owner_name")} />
          <Field label="Address" value={f.address ?? ""} onChange={set("address")} />
          <Field label="GCash Number for Business (Cash In/Out)" inputMode="tel" value={f.gcash_number_for_business ?? ""} onChange={set("gcash_number_for_business")} />
          <Field label="GCash pambayad ng subscription" inputMode="tel" value={f.owner_gcash ?? ""} onChange={set("owner_gcash")} />
          <h2 className="pt-2 font-bold text-brand">Pondo</h2>
          <div className="grid grid-cols-2 gap-2">
            <Field label="GCash Fund (₱)" type="number" value={f.gcash_fund ?? ""} onChange={set("gcash_fund")} />
            <Field label="Cash Float (₱)" type="number" value={f.cash_float ?? ""} onChange={set("cash_float")} />
            <Field label="Low Fund Alert (₱)" type="number" value={f.low_fund_threshold ?? ""} onChange={set("low_fund_threshold")} />
          </div>
          <h2 className="pt-2 font-bold text-brand">Fees sa Customer</h2>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cash In/Out fee per ₱500" type="number" value={f.fee_per_500 ?? ""} onChange={set("fee_per_500")} />
            <Field label="Load fee" type="number" value={f.load_fee ?? ""} onChange={set("load_fee")} />
          </div>
          {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Save Settings
          </Button>
        </form>
      </Card>

      <ChangePassword />
    </div>
  );
}

export function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = auth.currentUser;
    if (!u?.email) return;
    if (next.length < 6) return setMsg({ tone: "red", text: "Bagong password: 6 characters pataas." });
    setBusy(true);
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      await updatePassword(u, next);
      setCur("");
      setNext("");
      setMsg({ tone: "green", text: "Napalitan ang password." });
    } catch (e2) {
      setMsg({ tone: "red", text: authErrorMessage(e2) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-bold text-brand">Change Password</h2>
        <Field label="Current Password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        <Field label="New Password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        <Button type="submit" variant="ghost" className="w-full" loading={busy}>
          Change Password
        </Button>
      </form>
    </Card>
  );
}
