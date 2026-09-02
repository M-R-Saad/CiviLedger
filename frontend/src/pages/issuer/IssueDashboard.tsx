import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { issuerApi } from "../../services/api";
import { StatusPill } from "../../components/credentials/StatusPill";
import { Button } from "../../components/common/Button";
import { StatsCard } from "../../components/ui/StatsCard";
import type { Credential } from "../../types";

interface IssuerStats {
  total: number;
  active: number;
  suspended: number;
  revoked: number;
}

export default function IssueDashboard() {
  const { run, data: credentials, loading } = useApi<Credential[]>(issuerApi.listIssued);
  const [stats, setStats] = useState<IssuerStats | null>(null);

  useEffect(() => {
    run();
    issuerApi.stats().then((r) => setStats(r.data)).catch(() => {});
  }, [run]);

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Issued Credentials</h1>
        <Link to="/issuer/new"><Button>+ Issue New Credential</Button></Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatsCard label="Total Issued" value={stats.total} color="accent" />
          <StatsCard label="Active" value={stats.active} color="ok" />
          <StatsCard label="Suspended" value={stats.suspended} color="warn" />
          <StatsCard label="Revoked" value={stats.revoked} color="danger" />
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      <table className="w-full text-sm bg-white border rounded overflow-hidden">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2">Credential ID</th>
            <th className="p-2">Citizen</th>
            <th className="p-2">Status</th>
            <th className="p-2">Issued</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {credentials?.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2 font-mono text-xs">{c.id.slice(0, 8)}...</td>
              <td className="p-2 font-mono text-xs">{c.citizen_user_id.slice(0, 8)}...</td>
              <td className="p-2"><StatusPill status={c.status_cache} /></td>
              <td className="p-2">{new Date(c.issued_at).toLocaleDateString()}</td>
              <td className="p-2 space-x-2">
                <Link className="underline text-blue-600" to={`/issuer/credential/${c.id}`}>View</Link>
                <Link className="underline text-slate-700" to={`/issuer/manage/${c.id}`}>Manage</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
