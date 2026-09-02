import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"
});

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("civiledger_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The AuthProvider registers a handler here so a 401 anywhere drops the session
// and bounces to /login. 401s from /auth/* (a bad password) are left alone.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    if (status === 401 && !url.startsWith("/auth/")) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;

// --- Typed endpoint helpers, matching backend/src/routes ---

export const authApi = {
  login: (email: string, password: string) => api.post("/auth/login", { email, password }),
  register: (payload: object) => api.post("/auth/register", payload),
  walletLogin: (wallet_address: string) => api.post("/auth/wallet-login", { wallet_address })
};

export const issuerApi = {
  issueCredential: (payload: object) => api.post("/issuer/credentials", payload),
  listIssued: () => api.get("/issuer/credentials"),
  getCredential: (id: string) => api.get(`/issuer/credentials/${id}`),
  changeStatus: (id: string, action: string, reason?: string) =>
    api.post(`/issuer/credentials/${id}/status`, { action, reason }),
  stats: () => api.get("/issuer/stats")
};

export const citizenApi = {
  listMyCredentials: () => api.get("/citizen/credentials"),
  getCredential: (id: string) => api.get(`/citizen/credentials/${id}`),
  createPresentation: (payload: object) => api.post("/citizen/presentations", payload),
  auditHistory: () => api.get("/citizen/audit-history"),
  stats: () => api.get("/citizen/stats")
};

export const verifierApi = {
  getPresentation: (token: string) => api.get(`/verifier/presentations/${token}`),
  // Public read-only verification (token is the secret). No record is written.
  check: (token: string) => api.get(`/verifier/presentations/${token}/check`),
  // Authenticated verifier action: same checks, plus an on-chain receipt + logged event.
  verify: (share_token: string) => api.post("/verifier/verify", { share_token }),
  stats: () => api.get("/verifier/stats")
};

export const governanceApi = {
  proposeMember: (payload: object) => api.post("/governance/propose-member", payload),
  approveMember: (organizationId: string) => api.post(`/governance/approve-member/${organizationId}`),
  auditLog: () => api.get("/governance/audit-log"),
  listOrganizations: () => api.get("/governance/organizations"),
  listPendingMembers: () => api.get("/governance/pending-members"),
  stats: () => api.get("/governance/stats")
};

export const credentialTypesApi = {
  list: () => api.get("/credential-types")
};
