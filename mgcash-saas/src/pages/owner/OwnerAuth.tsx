import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { authErrorMessage, ownerEmail } from "../../lib/authEmail";
import { normalizePhone, PHONE_RE } from "../../lib/format";
import { signupOwner } from "../../services/stores";
import { useAuth } from "../../context/AuthContext";
import { Alert, Button, Field } from "../../components/ui";

function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-3xl font-black text-white">
          MG<span className="text-accent">-CASH</span>
        </Link>
        <div className="mt-4 rounded-2xl bg-white p-5">
          <h1 className="mb-4 text-xl font-extrabold text-brand">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function OwnerLogin() {
  const { user, role, refresh } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user && role === "store_owner") return <Navigate to="/owner" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (!PHONE_RE.test(p)) return setErr("Ilagay ang 11-digit phone number (09XXXXXXXXX).");
    setBusy(true);
    setErr(null);
    try {
      await signInWithEmailAndPassword(auth, ownerEmail(p), password);
      await refresh();
      nav("/owner", { replace: true });
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Boss Login">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Phone Number" inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXXX" />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err ? <Alert>{err}</Alert> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Login
        </Button>
        <p className="text-center text-sm">
          Wala pang account?{" "}
          <Link to="/owner/signup" className="font-bold text-brand">
            Mag-Sign Up (7 days free)
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function OwnerSignup() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    storeName: "",
    ownerName: "",
    phone: "",
    password: "",
    address: "",
    gcashBusiness: "",
    ownerGcash: "",
    referralCode: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const phone = normalizePhone(f.phone);
    const gcashBusiness = normalizePhone(f.gcashBusiness || f.phone);
    const ownerGcash = normalizePhone(f.ownerGcash || f.phone);
    if (!f.storeName.trim() || !f.ownerName.trim() || !f.address.trim()) return setErr("Kumpletuhin ang Store Name, Owner Name, at Address.");
    if (![phone, gcashBusiness, ownerGcash].every((p) => PHONE_RE.test(p))) return setErr("Mali ang format ng phone/GCash number (09XXXXXXXXX).");
    if (f.password.length < 6) return setErr("Password: 6 characters pataas.");
    setBusy(true);
    setErr(null);
    try {
      await signupOwner({ ...f, phone, gcashBusiness, ownerGcash });
      await refresh();
      nav("/owner", { replace: true });
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Sign Up - 7 Days FREE Trial">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Store Name" value={f.storeName} onChange={set("storeName")} placeholder="Nena Sari-Sari Store" />
        <Field label="Owner Name" value={f.ownerName} onChange={set("ownerName")} placeholder="Aling Nena" />
        <Field label="Phone (pang-login)" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="09XXXXXXXXX" />
        <Field label="Password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} />
        <Field label="Address" value={f.address} onChange={set("address")} placeholder="Angeles City" />
        <Field
          label="GCash Number ng Store (pang Cash In/Out)"
          inputMode="tel"
          value={f.gcashBusiness}
          onChange={set("gcashBusiness")}
          placeholder="Kung blank, phone ang gagamitin"
        />
        <Field
          label="GCash Number pambayad ng subscription"
          inputMode="tel"
          value={f.ownerGcash}
          onChange={set("ownerGcash")}
          placeholder="Kung blank, phone ang gagamitin"
        />
        <Field label="Referral Code (optional)" value={f.referralCode} onChange={set("referralCode")} placeholder="e.g. NENA-4821" />
        {err ? <Alert>{err}</Alert> : null}
        <Button type="submit" variant="accent" className="w-full" loading={busy}>
          Start Free Trial
        </Button>
        <p className="text-center text-sm">
          May account na?{" "}
          <Link to="/owner/login" className="font-bold text-brand">
            Login
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export { AuthFrame };
