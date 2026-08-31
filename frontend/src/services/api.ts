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
  changeStatus: (id: string, action: string, reason?: string) =>
    api.post(`/issuer/credentials/${id}/status`, { action, reason })
};

export const citizenApi = {
  listMyCredentials: () => api.get("/citizen/credentials"),
  createPresentation: (payload: object) => api.post("/citizen/presentations", payload),
  auditHistory: () => api.get("/citizen/audit-history")
};

export const verifierApi = {
  getPresentation: (token: string) => api.get(`/verifier/presentations/${token}`),
  verify: (share_token: string) => api.post("/verifier/verify", { share_token })
};

export const governanceApi = {
  proposeMember: (payload: object) => api.post("/governance/propose-member", payload),
  approveMember: (organizationId: string) => api.post(`/governance/approve-member/${organizationId}`),
  auditLog: () => api.get("/governance/audit-log"),
  listOrganizations: () => api.get("/governance/organizations"),
  listPendingMembers: () => api.get("/governance/pending-members")
};

export const credentialTypesApi = {
  list: () => api.get("/credential-types")
};
