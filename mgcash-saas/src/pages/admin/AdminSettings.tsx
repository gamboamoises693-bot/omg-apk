import { useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "./AdminContext";
import { saveAppConfig } from "../../services/payments";
import { normalizePhone, PHONE_RE } from "../../lib/format";
import { Alert, Button, Card, Field, PageTitle } from "../../components/ui";

/** GCash number + price shown on every store's paywall. */
export default function AdminSettings() {
  const { config } = useAdmin();
  const [f, setF] = useState({ admin_name: "", admin_gcash: "", monthly_price: "", daily_price: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  useEffect(() => {
    setF({
      admin_name: config.admin_name,
      admin_gcash: config.admin_gcash,
      monthly_price: String(config.monthly_price),
      daily_price: String(config.daily_price),
    });
  }, [config]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const gcash = normalizePhone(f.admin_gcash);
    if (!PHONE_RE.test(gcash)) return setMsg({ tone: "red", text: "Invalid GCash number." });
    setBusy(true);
    try {
      await saveAppConfig({ admin_name: f.admin_name.trim(), admin_gcash: gcash, monthly_price: Number(f.monthly_price), daily_price: Number(f.daily_price) });
      setMsg({ tone: "green", text: "Saved!" });
    } catch (e2) {
      setMsg({ tone: "red", text: (e2 as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageTitle>Settings</PageTitle>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Admin Name" value={f.admin_name} onChange={(e) => setF({ ...f, admin_name: e.target.value })} />
          <Field label="GCash Number (pang-receive ng subscription)" inputMode="tel" value={f.admin_gcash} onChange={(e) => setF({ ...f, admin_gcash: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Monthly Price" type="number" value={f.monthly_price} onChange={(e) => setF({ ...f, monthly_price: e.target.value })} />
            <Field label="Daily Price" type="number" value={f.daily_price} onChange={(e) => setF({ ...f, daily_price: e.target.value })} />
          </div>
          {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Save
          </Button>
        </form>
      </Card>
    </div>
  );
}
