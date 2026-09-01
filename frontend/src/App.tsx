import { Routes, Route, Navigate } from "react-router-dom";
import { useT } from "./i18n/I18nProvider";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth, RequireRole } from "./components/layout/RequireAuth";

import Login from "./pages/auth/Login";
import ConnectWallet from "./pages/auth/ConnectWallet";

import WalletHome from "./pages/citizen/WalletHome";
import ShareCredential from "./pages/citizen/ShareCredential";
import AuditHistory from "./pages/citizen/AuditHistory";

import IssueDashboard from "./pages/issuer/IssueDashboard";
import IssueCredentialForm from "./pages/issuer/IssueCredentialForm";
import ManageCredential from "./pages/issuer/ManageCredential";

import ScanPresentation from "./pages/verifier/ScanPresentation";
import VerificationResult from "./pages/verifier/VerificationResult";

import GovernanceDashboard from "./pages/oversight/GovernanceDashboard";
import AuditLog from "./pages/oversight/AuditLog";

function NotFound() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-bg">
      <div className="px-4 py-24 text-center text-sm text-ink-muted">
        {t("error.notFound")}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public: auth screens and the citizen-shared verification link */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/connect-wallet" element={<ConnectWallet />} />
        <Route path="/verify/:token" element={<VerificationResult />} />
      </Route>

      {/* Authenticated: app shell + per-route role gates */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route
            path="/citizen"
            element={
              <RequireRole roles={["CITIZEN"]}>
                <WalletHome />
              </RequireRole>
            }
          />
          <Route
            path="/citizen/share"
            element={
              <RequireRole roles={["CITIZEN"]}>
                <ShareCredential />
              </RequireRole>
            }
          />
          <Route
            path="/citizen/audit"
            element={
              <RequireRole roles={["CITIZEN"]}>
                <AuditHistory />
              </RequireRole>
            }
          />

          <Route
            path="/issuer"
            element={
              <RequireRole roles={["ISSUER_ADMIN"]}>
                <IssueDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/issuer/new"
            element={
              <RequireRole roles={["ISSUER_ADMIN"]}>
                <IssueCredentialForm />
              </RequireRole>
            }
          />
          <Route
            path="/issuer/manage/:id"
            element={
              <RequireRole roles={["ISSUER_ADMIN"]}>
                <ManageCredential />
              </RequireRole>
            }
          />

          <Route
            path="/verifier"
            element={
              <RequireRole roles={["VERIFIER_STAFF"]}>
                <ScanPresentation />
              </RequireRole>
            }
          />
          <Route
            path="/verifier/result/:token"
            element={
              <RequireRole roles={["VERIFIER_STAFF"]}>
                <VerificationResult />
              </RequireRole>
            }
          />

          <Route
            path="/oversight"
            element={
              <RequireRole roles={["OVERSIGHT"]}>
                <GovernanceDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/oversight/audit"
            element={
              <RequireRole roles={["OVERSIGHT"]}>
                <AuditLog />
              </RequireRole>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
