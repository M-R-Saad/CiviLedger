import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { RoleGuard } from "./components/layout/RoleGuard";

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

export default function App() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/connect-wallet" element={<ConnectWallet />} />

        {/* Citizen */}
        <Route path="/citizen" element={<RoleGuard allow={["CITIZEN"]}><WalletHome /></RoleGuard>} />
        <Route path="/citizen/share" element={<RoleGuard allow={["CITIZEN"]}><ShareCredential /></RoleGuard>} />
        <Route path="/citizen/audit" element={<RoleGuard allow={["CITIZEN"]}><AuditHistory /></RoleGuard>} />

        {/* Issuer */}
        <Route path="/issuer" element={<RoleGuard allow={["ISSUER_ADMIN"]}><IssueDashboard /></RoleGuard>} />
        <Route path="/issuer/new" element={<RoleGuard allow={["ISSUER_ADMIN"]}><IssueCredentialForm /></RoleGuard>} />
        <Route path="/issuer/manage/:id" element={<RoleGuard allow={["ISSUER_ADMIN"]}><ManageCredential /></RoleGuard>} />

        {/* Verifier — /verify/:token is the public entry point citizens share via QR/link */}
        <Route path="/verifier" element={<RoleGuard allow={["VERIFIER_STAFF"]}><ScanPresentation /></RoleGuard>} />
        <Route path="/verify/:token" element={<VerificationResult />} />
        <Route path="/verifier/result/:token" element={<RoleGuard allow={["VERIFIER_STAFF"]}><VerificationResult /></RoleGuard>} />

        {/* Oversight */}
        <Route path="/oversight" element={<RoleGuard allow={["OVERSIGHT"]}><GovernanceDashboard /></RoleGuard>} />
        <Route path="/oversight/audit" element={<RoleGuard allow={["OVERSIGHT"]}><AuditLog /></RoleGuard>} />

        <Route path="*" element={<div className="p-10 text-center text-slate-500">404 — Page not found</div>} />
      </Routes>
    </div>
  );
}
