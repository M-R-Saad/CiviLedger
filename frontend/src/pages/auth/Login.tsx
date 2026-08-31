import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/common/Button";

const DEMO_ACCOUNTS = [
  { label: "🎓 Education Officer (Issuer)", email: "nusrat@edu.gov.test", role: "ISSUER_ADMIN" },
  { label: "🏛️ NID Officer (Issuer)", email: "rahim@identity.gov.test", role: "ISSUER_ADMIN" },
  { label: "🚗 BRTA Officer (Issuer)", email: "kamal@brta.gov.test", role: "ISSUER_ADMIN" },
  { label: "👤 Ahnaf Tahmid (Citizen)", email: "ahnaf@citizen.test", role: "CITIZEN" },
  { label: "👤 Sumaya Zaman (Citizen)", email: "sumaya@citizen.test", role: "CITIZEN" },
  { label: "👤 Shahriar Morshed (Citizen)", email: "shahriar@citizen.test", role: "CITIZEN" },
  { label: "🔍 HR Manager (Verifier)", email: "abrar@employer.test", role: "VERIFIER_STAFF" },
  { label: "🛡️ System Admin (Oversight)", email: "admin@civiledger.test", role: "OVERSIGHT" },
  { label: "🛡️ Oversight Auditor", email: "auditor@civiledger.test", role: "OVERSIGHT" },
];

export default function Login() {
  const { loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithPassword(email, password);
      const roleHome: Record<string, string> = {
        ISSUER_ADMIN: "/issuer",
        VERIFIER_STAFF: "/verifier",
        OVERSIGHT: "/oversight",
        CITIZEN: "/citizen"
      };
      navigate(roleHome[user.role] || "/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password123");
    setError(null);
  }

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h1 className="text-xl font-bold mb-1">Institution / Staff Login</h1>
        <p className="text-sm text-slate-500 mb-5">Sign in with your organization credentials</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@organization.gov"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Password</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Log in"}
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-slate-500">
            Citizen? Use <Link className="text-blue-600 underline font-medium" to="/connect-wallet">Connect Wallet</Link> instead.
          </p>
        </div>
      </div>

      {/* Demo accounts panel */}
      <div className="mt-4 bg-slate-50 rounded-xl border p-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Demo Accounts</h2>
        <p className="text-xs text-slate-400 mb-3">Click to auto-fill • All passwords: <code className="bg-white px-1 py-0.5 rounded text-slate-600">password123</code></p>
        <div className="grid grid-cols-1 gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillDemoAccount(acc.email)}
              className="flex items-center justify-between w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
            >
              <span>{acc.label}</span>
              <span className="text-xs text-slate-400 font-mono">{acc.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
