import { PayPanel } from "../../components/PayPanel";
import { PageTitle } from "../../components/ui";

export default function OwnerPay() {
  return (
    <div className="space-y-3">
      <PageTitle>Bayad sa MG-CASH</PageTitle>
      <PayPanel />
    </div>
  );
}
