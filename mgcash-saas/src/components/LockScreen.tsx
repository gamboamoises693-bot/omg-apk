import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { PayPanel } from "./PayPanel";
import { Button } from "./ui";

/** Full-screen lock when subscription is expired or store deactivated. */
export function LockScreen({ forOwner }: { forOwner: boolean }) {
  const { status, config, store } = useStore();
  const { logout } = useAuth();
  const deactivated = status === "deactivated";
  return (
    <div className="min-h-screen bg-brand px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-2xl bg-white p-5 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-2 text-2xl font-black text-red-600">{deactivated ? "Store Deactivated" : "Expired!"}</h1>
          <p className="mt-2 text-slate-700">
            {deactivated ? (
              <>Na-deactivate ang <b>{store?.store_name}</b>. Kontakin si {config.admin_name} sa {config.admin_gcash}.</>
            ) : (
              <>
                Magpadala ng <b>₱{config.monthly_price}</b> sa GCash <b>{config.admin_gcash}</b> ({config.admin_name}) with reference{" "}
                <b>{store?.store_name}</b> para ma-reactivate.
              </>
            )}
          </p>
          {!forOwner ? <p className="mt-3 text-sm text-slate-500">Sabihan si Boss na i-renew ang MG-CASH subscription.</p> : null}
        </div>
        {forOwner && !deactivated ? <PayPanel /> : null}
        <Button variant="ghost" className="w-full" onClick={() => void logout()}>
          Logout
        </Button>
      </div>
    </div>
  );
}
