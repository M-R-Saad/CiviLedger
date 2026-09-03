# CiviLedger — Build Walkthrough

## Completed Improvement Plan Items

| # | Item | Status |
|---|------|--------|
| 1.1 | Landing Page | ✅ Done |
| 1.2 | Credential Detail View | ✅ Done |
| 1.3 | Presentation Expiry UX | ✅ Done |
| 1.4 | Dashboard Stats Cards | ✅ Done |
| 2.4 | QR Code Scanning | ✅ Done |
| 3.3 | Toast Notifications | ✅ Done |

---

## 1. Landing Page (1.1)

**Files created/modified:**
- [LandingPage.tsx](file:///e:/Projects/civiledger/frontend/src/pages/LandingPage.tsx) — Full landing page with hero, features, how-it-works flow, role portals, architecture diagram
- [landing.css](file:///e:/Projects/civiledger/frontend/src/styles/landing.css) — Light-themed styles using the app's design tokens (CSS variables)
- [App.tsx](file:///e:/Projects/civiledger/frontend/src/App.tsx) — Route `/` → LandingPage
- [PublicLayout.tsx](file:///e:/Projects/civiledger/frontend/src/components/layout/PublicLayout.tsx) — Brand link → `/`

---

## 2. Dashboard Stats Cards (1.4)

### Backend (3 new endpoints)
- [issuer.controller.js](file:///e:/Projects/civiledger/backend/src/controllers/issuer.controller.js) — `GET /issuer/stats` → total, active, suspended, revoked counts
- [citizen.controller.js](file:///e:/Projects/civiledger/backend/src/controllers/citizen.controller.js) — `GET /citizen/stats` → total, active, expired, shared counts
- [governance.controller.js](file:///e:/Projects/civiledger/backend/src/controllers/governance.controller.js) — `GET /governance/stats` → org counts, event totals
- [verifier.controller.js](file:///e:/Projects/civiledger/backend/src/controllers/verifier.controller.js) — `GET /verifier/stats` → verification counts, pass/fail

### Frontend
- [StatsCard.tsx](file:///e:/Projects/civiledger/frontend/src/components/ui/StatsCard.tsx) — Reusable stats card with color variants (accent, ok, warn, danger)
- [IssueDashboard.tsx](file:///e:/Projects/civiledger/frontend/src/pages/issuer/IssueDashboard.tsx) — Stats row at top
- [WalletHome.tsx](file:///e:/Projects/civiledger/frontend/src/pages/citizen/WalletHome.tsx) — Stats row at top
- [GovernanceDashboard.tsx](file:///e:/Projects/civiledger/frontend/src/pages/oversight/GovernanceDashboard.tsx) — Stats row at top
- [ScanPresentation.tsx](file:///e:/Projects/civiledger/frontend/src/pages/verifier/ScanPresentation.tsx) — Stats row at top

---

## 3. Credential Detail View (1.2)

### Backend (2 new endpoints)
- `GET /issuer/credentials/:id` — Full credential with citizen info, status history
- `GET /citizen/credentials/:id` — Full credential with issuer info, status history

### Frontend (2 new pages)
- [IssuerCredentialDetail.tsx](file:///e:/Projects/civiledger/frontend/src/pages/issuer/IssuerCredentialDetail.tsx) — Full payload, citizen info, on-chain anchor, status history, suspend/revoke actions
- [CitizenCredentialDetail.tsx](file:///e:/Projects/civiledger/frontend/src/pages/citizen/CitizenCredentialDetail.tsx) — Full payload, issuer info, verification info, status history, share action
- [CredentialCard.tsx](file:///e:/Projects/civiledger/frontend/src/components/credentials/CredentialCard.tsx) — Now links to detail page

---

## 4. QR Code Scanning (2.4)

- Installed `html5-qrcode` library
- [ScanPresentation.tsx](file:///e:/Projects/civiledger/frontend/src/pages/verifier/ScanPresentation.tsx) — Camera-based QR scanner with start/stop controls, auto-extracts token from full URLs, manual input fallback

---

## 5. Toast Notifications (3.3)

- [ToastProvider.tsx](file:///e:/Projects/civiledger/frontend/src/context/ToastProvider.tsx) — Global toast system with 4 types (success, error, warning, info), auto-dismiss after 5s, slide-in animation
- [main.tsx](file:///e:/Projects/civiledger/frontend/src/main.tsx) — Wrapped app in ToastProvider
- Toasts wired into: issue credential, manage credential (suspend/revoke/reactivate), share credential, clipboard copy

---

## 6. Presentation Expiry UX (1.3)

- [ShareCredential.tsx](file:///e:/Projects/civiledger/frontend/src/pages/citizen/ShareCredential.tsx) — Configurable expiry picker (15 min, 1 hour, 24 hours)
- [citizen.controller.js](file:///e:/Projects/civiledger/backend/src/controllers/citizen.controller.js) — Backend accepts `expiry_minutes` parameter
- Expired presentations already handled via 410 status + i18n error message

---

## Verification

- **TypeScript:** `npx tsc --noEmit` → 0 errors ✅
- **Backend:** All new routes registered and exporting correctly
- **Frontend:** Vite dev server running without errors

---

## Next Steps (Remaining from improvement plan)

| # | Item | Status |
|---|------|--------|
| 2.1 | Purpose-Specific Credentials | 🔲 Not started |
| 2.2 | Supersede Credential | 🔲 Not started |
| 2.3 | Issuer Key Rotation | 🔲 Not started |
| 3.1 | Proper Navbar with Role Indicator | 🔲 Not started |
| 3.2 | Verification Certificate | 🔲 Not started |
| 3.4 | Testnet Deployment | 🔲 Not started |
| 3.5 | Backend Signature Verification | 🔲 Not started |
