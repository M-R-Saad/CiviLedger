import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { governanceApi } from "../../services/api";

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AuditLog() {
  const { run, data, loading } = useApi(governanceApi.auditLog);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <Link to="/oversight" className="text-sm text-slate-600 underline">
          ← Back to Dashboard
        </Link>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      <h2 className="font-semibold text-sm mt-4 mb-2">Governance Events</h2>
      {data?.governanceEvents?.length > 0 ? (
        <table className="w-full text-xs bg-white border rounded overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-2">Event</th>
              <th className="p-2">Details</th>
              <th className="p-2">TX Hash</th>
              <th className="p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {data.governanceEvents.map((e: any) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    e.event_type.includes("APPROVED") ? "bg-green-100 text-green-800" :
                    e.event_type.includes("PROPOSED") ? "bg-blue-100 text-blue-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {e.event_type}
                  </span>
                </td>
                <td className="p-2 text-slate-600">
                  {e.details?.name || e.details?.onchain_address?.slice(0, 10) || "—"}
                </td>
                <td className="p-2 font-mono text-slate-400">
                  {e.onchain_tx_hash ? `${e.onchain_tx_hash.slice(0, 10)}...` : "—"}
                </td>
                <td className="p-2 text-slate-500">
                  {formatDate(e.createdAt || e.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-slate-500 text-sm bg-white border rounded p-3">No governance events yet.</p>
      )}

      <h2 className="font-semibold text-sm mt-6 mb-2">Credential Status Events</h2>
      {data?.statusEvents?.length > 0 ? (
        <table className="w-full text-xs bg-white border rounded overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-2">Previous</th>
              <th className="p-2">New</th>
              <th className="p-2">Reason</th>
              <th className="p-2">TX Hash</th>
              <th className="p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {data.statusEvents.map((e: any) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                    {e.previous_status}
                  </span>
                </td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    e.new_status === "REVOKED" ? "bg-red-100 text-red-800" :
                    e.new_status === "SUSPENDED" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {e.new_status}
                  </span>
                </td>
                <td className="p-2 text-slate-600">{e.reason || "—"}</td>
                <td className="p-2 font-mono text-slate-400">
                  {e.onchain_tx_hash ? `${e.onchain_tx_hash.slice(0, 10)}...` : "—"}
                </td>
                <td className="p-2 text-slate-500">
                  {formatDate(e.createdAt || e.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-slate-500 text-sm bg-white border rounded p-3">No credential status events yet.</p>
      )}
    </div>
  );
}
