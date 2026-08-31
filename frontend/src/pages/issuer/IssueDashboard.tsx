import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { issuerApi } from "../../services/api";
import { StatusPill } from "../../components/credentials/StatusPill";
import { Button } from "../../components/common/Button";
import type { Credential } from "../../types";

export default function IssueDashboard() {
  const { run, data: credentials, loading } = useApi<Credential[]>(issuerApi.listIssued);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Issued Credentials</h1>
        <Link to="/issuer/new"><Button>+ Issue New Credential</Button></Link>
      </div>

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
              <td className="p-2">
                <Link className="underline text-slate-700" to={`/issuer/manage/${c.id}`}>Manage</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
