import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { fmtDate } from "../lib/format";
import { toDate } from "../lib/dates";

/** Top banner for Store Owner: trial countdown / active until / overdue warning. */
export function SubscriptionBanner({ payLink = "/owner/pay" }: { payLink?: string }) {
  const { store, status, daysLeft, config } = useStore();
  if (!store) return null;

  if (status === "trial") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-accent px-4 py-2 text-sm font-semibold text-slate-900">
        <span>
          Trial: {daysLeft} araw na lang · Pay ₱{config.monthly_price}/month kay {config.admin_name.split(" ")[0]} via GCash {config.admin_gcash}
        </span>
        <Link to={payLink} className="rounded-lg bg-brand px-3 py-1.5 text-white">
          Pay Now
        </Link>
      </div>
    );
  }
  if (status === "overdue") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white">
        <span>Overdue! Ma-lock ang app sa loob ng {daysLeft || "ilang"} araw. Magbayad ng ₱{config.monthly_price}.</span>
        <Link to={payLink} className="rounded-lg bg-accent px-3 py-1.5 text-slate-900">
          Pay Now
        </Link>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="bg-emerald-600 px-4 py-1.5 text-center text-xs font-semibold text-white">
        Active until {fmtDate(toDate(store.subscription_end))} · ₱{config.monthly_price}/month
      </div>
    );
  }
  return null;
}
