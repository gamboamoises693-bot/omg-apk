import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { homeFor } from "../../components/Guards";
import { FullLoader } from "../../components/ui";

export default function Landing() {
  const { user, role, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (user && role) return <Navigate to={homeFor(role)} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-brand px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-md flex-1">
        <h1 className="text-5xl font-black tracking-tight">
          MG<span className="text-accent">-CASH</span>
        </h1>
        <p className="mt-2 text-lg text-white/85">GCash Cash In / Cash Out / Load manager para sa sari-sari store mo.</p>
        <ul className="mt-6 space-y-2 text-white/90">
          <li>✅ Customer mismo ang nagta-type ng number (QR o Bluetooth keypad)</li>
          <li>✅ Ikaw (Boss) ang nag-a-approve ng bawat transaction</li>
          <li>✅ Start/End shift na may photo + auto audit</li>
          <li>✅ Auto payroll at commission ng tindera</li>
        </ul>
        <div className="mt-6 rounded-2xl bg-white/10 p-4">
          <div className="text-sm text-white/70">Presyo</div>
          <div className="text-3xl font-black text-accent">₱210/month</div>
          <div className="text-sm text-white/80">₱7 lang kada araw · 7 days FREE trial</div>
        </div>
        <div className="mt-8 grid gap-3">
          <Link to="/owner/signup" className="btn bg-accent text-slate-900">
            Mag-Sign Up (Free Trial)
          </Link>
          <Link to="/owner/login" className="btn bg-white text-brand">
            Login bilang Boss / Store Owner
          </Link>
          <Link to="/tindera/login" className="btn border-2 border-white/60 text-white">
            Login bilang Tindera
          </Link>
        </div>
      </div>
      <Link to="/admin/login" className="mt-8 text-center text-xs text-white/50">
        Super Admin
      </Link>
    </div>
  );
}
