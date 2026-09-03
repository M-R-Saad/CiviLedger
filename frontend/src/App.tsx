import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useT } from "./i18n/I18nProvider";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequireRole } from "./components/layout/RequireAuth";

// Eager: the two entry points a first visit almost always hits.
import LandingPage from "./pages/LandingPage";
import Login from "./pages/auth/Login";

// Lazy: everything else is code-split so ethers / html5-qrcode / the dashboards
// are not in the bundle a citizen loads to open a verify link.
const ConnectWallet = lazy(() => import("./pages/auth/ConnectWallet"));
const WalletHome = lazy(() => import("./pages/citizen/WalletHome"));
const ShareCredential = lazy(() => import("./pages/citizen/ShareCredential"));
const AuditHistory = lazy(() => import("./pages/citizen/AuditHistory"));
const CitizenCredentialDetail = lazy(() => import("./pages/citizen/CitizenCredentialDetail"));
const IssueDashboard = lazy(() => import("./pages/issuer/IssueDashboard"));
const IssueCredentialForm = lazy(() => import("./pages/issuer/IssueCredentialForm"));
const ManageCredential = lazy(() => import("./pages/issuer/ManageCredential"));
const IssuerCredentialDetail = lazy(() => import("./pages/issuer/IssuerCredentialDetail"));
const ScanPresentation = lazy(() => import("./pages/verifier/ScanPresentation"));
const VerificationResult = lazy(() => import("./pages/verifier/VerificationResult"));
const VerifierHistory = lazy(() => import("./pages/verifier/VerifierHistory"));
const GovernanceDashboard = lazy(() => import("./pages/oversight/GovernanceDashboard"));
const AuditLog = lazy(() => import("./pages/oversight/AuditLog"));

function RouteFallback() {
  const { t } = useT();
  return (
    <div className="px-4 py-24 text-center text-sm text-ink-muted">{t("common.loading")}</div>
  );
}

function NotFound() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-bg">
      <div className="px-4 py-24 text-center text-sm text-ink-muted">{t("error.notFound")}</div>
    </div>
  );
}

const role = (r: "CITIZEN" | "ISSUER_ADMIN" | "VERIFIER_STAFF" | "OVERSIGHT", el: React.ReactNode) => (
  <RequireRole roles={[r]}>{el}</RequireRole>
);

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<PublicLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/connect-wallet" element={<ConnectWallet />} />
          <Route path="/verify/:token" element={<VerificationResult />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/citizen" element={role("CITIZEN", <WalletHome />)} />
            <Route path="/citizen/share" element={role("CITIZEN", <ShareCredential />)} />
            <Route path="/citizen/audit" element={role("CITIZEN", <AuditHistory />)} />
            <Route
              path="/citizen/credential/:id"
              element={role("CITIZEN", <CitizenCredentialDetail />)}
            />

            <Route path="/issuer" element={role("ISSUER_ADMIN", <IssueDashboard />)} />
            <Route path="/issuer/new" element={role("ISSUER_ADMIN", <IssueCredentialForm />)} />
            <Route path="/issuer/manage/:id" element={role("ISSUER_ADMIN", <ManageCredential />)} />
            <Route
              path="/issuer/credential/:id"
              element={role("ISSUER_ADMIN", <IssuerCredentialDetail />)}
            />

            <Route path="/verifier" element={role("VERIFIER_STAFF", <ScanPresentation />)} />
            <Route path="/verifier/history" element={role("VERIFIER_STAFF", <VerifierHistory />)} />
            <Route
              path="/verifier/result/:token"
              element={role("VERIFIER_STAFF", <VerificationResult />)}
            />

            <Route path="/oversight" element={role("OVERSIGHT", <GovernanceDashboard />)} />
            <Route path="/oversight/audit" element={role("OVERSIGHT", <AuditLog />)} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
