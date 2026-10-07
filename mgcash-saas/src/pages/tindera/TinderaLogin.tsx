import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { authErrorMessage, tinderaEmail } from "../../lib/authEmail";
import { useAuth } from "../../context/AuthContext";
import { AuthFrame } from "../owner/OwnerAuth";
import { Alert, Button, Field } from "../../components/ui";

const LAST_CODE_KEY = "mgcash.lastStoreCode";

function readLastCode(): string {
  try {
    return localStorage.getItem(LAST_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function TinderaLogin() {
  const { user, role, refresh } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState(readLastCode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user && role === "tindera") return <Navigate to="/tindera" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !username.trim()) return setErr("Ilagay ang Store Code at username.");
    setBusy(true);
    setErr(null);
    try {
      await signInWithEmailAndPassword(auth, tinderaEmail(code, username), password);
      try {
        localStorage.setItem(LAST_CODE_KEY, code.trim().toUpperCase());
      } catch {
        /* storage blocked - ignore */
      }
      await refresh();
      nav("/tindera", { replace: true });
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Tindera Login">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Store Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. NENA-4821" autoCapitalize="characters" />
        <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {err ? <Alert>{err}</Alert> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Login
        </Button>
        <p className="text-center text-sm text-slate-500">
          Walang account? Sabihan si Boss na i-add ka. <Link to="/" className="font-bold text-brand">Home</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
