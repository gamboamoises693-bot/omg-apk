import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { authErrorMessage } from "../../lib/authEmail";
import { useAuth } from "../../context/AuthContext";
import { AuthFrame } from "../owner/OwnerAuth";
import { Alert, Button, Field } from "../../components/ui";

export default function AdminLogin() {
  const { user, role, refresh } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user && role === "superadmin") return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // Force-refresh so a freshly-set custom claim is picked up.
      const token = await cred.user.getIdTokenResult(true);
      if (token.claims.superadmin !== true) {
        await signOut(auth);
        throw new Error("Hindi Super Admin ang account na ito.");
      }
      await refresh();
      nav("/admin", { replace: true });
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Super Admin Login">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err ? <Alert>{err}</Alert> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Login
        </Button>
      </form>
    </AuthFrame>
  );
}
