import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import { RequireActiveStore, RequireRole } from "./components/Guards";
import { FullLoader } from "./components/ui";

// Each role only downloads its own screens (important on low-end phones / slow data).

const Landing = lazy(() => import("./pages/public/Landing"));
const CustomerType = lazy(() => import("./pages/public/CustomerType"));

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminStores = lazy(() => import("./pages/admin/AdminStores"));
const AdminStoreDetail = lazy(() => import("./pages/admin/AdminStoreDetail"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const OwnerLogin = lazy(() => import("./pages/owner/OwnerAuth").then((m) => ({ default: m.OwnerLogin })));
const OwnerSignup = lazy(() => import("./pages/owner/OwnerAuth").then((m) => ({ default: m.OwnerSignup })));
const OwnerLayout = lazy(() => import("./pages/owner/OwnerLayout"));
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard"));
const OwnerApprovals = lazy(() => import("./pages/owner/OwnerApprovals"));
const OwnerTinderas = lazy(() => import("./pages/owner/OwnerTinderas"));
const OwnerAudit = lazy(() => import("./pages/owner/OwnerAudit"));
const OwnerPayroll = lazy(() => import("./pages/owner/OwnerPayroll"));
const OwnerReports = lazy(() => import("./pages/owner/OwnerReports"));
const OwnerSettings = lazy(() => import("./pages/owner/OwnerSettings"));
const OwnerPay = lazy(() => import("./pages/owner/OwnerPay"));

const TinderaLogin = lazy(() => import("./pages/tindera/TinderaLogin"));
const TinderaLayout = lazy(() => import("./pages/tindera/TinderaLayout"));
const TinderaDashboard = lazy(() => import("./pages/tindera/TinderaDashboard"));
const StartShift = lazy(() => import("./pages/tindera/StartShift"));
const NewTransaction = lazy(() => import("./pages/tindera/NewTransaction"));
const EndShift = lazy(() => import("./pages/tindera/EndShift"));
const MyCommission = lazy(() => import("./pages/tindera/MyCommission"));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<FullLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/customer-type" element={<CustomerType />} />

          {/* Super Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<RequireRole role="superadmin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="stores" element={<AdminStores />} />
              <Route path="stores/:id" element={<AdminStoreDetail />} />
              <Route path="billing" element={<AdminBilling />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Store Owner (Boss) */}
          <Route path="/owner/login" element={<OwnerLogin />} />
          <Route path="/owner/signup" element={<OwnerSignup />} />
          <Route element={<RequireRole role="store_owner" />}>
            <Route
              element={
                <StoreProvider>
                  <RequireActiveStore forOwner />
                </StoreProvider>
              }
            >
              <Route path="/owner" element={<OwnerLayout />}>
                <Route index element={<OwnerDashboard />} />
                <Route path="approvals" element={<OwnerApprovals />} />
                <Route path="tinderas" element={<OwnerTinderas />} />
                <Route path="audit" element={<OwnerAudit />} />
                <Route path="payroll" element={<OwnerPayroll />} />
                <Route path="reports" element={<OwnerReports />} />
                <Route path="settings" element={<OwnerSettings />} />
                <Route path="pay" element={<OwnerPay />} />
              </Route>
            </Route>
          </Route>

          {/* Tindera */}
          <Route path="/tindera/login" element={<TinderaLogin />} />
          <Route element={<RequireRole role="tindera" />}>
            <Route
              element={
                <StoreProvider>
                  <RequireActiveStore forOwner={false} />
                </StoreProvider>
              }
            >
              <Route path="/tindera" element={<TinderaLayout />}>
                <Route index element={<TinderaDashboard />} />
                <Route path="start" element={<StartShift />} />
                <Route path="cash-in" element={<NewTransaction key="cash_in" type="cash_in" />} />
                <Route path="cash-out" element={<NewTransaction key="cash_out" type="cash_out" />} />
                <Route path="load" element={<NewTransaction key="load" type="load" />} />
                <Route path="end" element={<EndShift />} />
                <Route path="commission" element={<MyCommission />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
