import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { verifierApi } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";

export default function VerifierHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifierApi.history()
      .then((res) => setHistory(res.data))
      .catch((err) => console.error("Failed to load history", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4 pb-10">
      <Link to="/verifier" className="text-sm text-slate-500 hover:text-slate-800 mb-4 inline-block">← Back to Scanner</Link>
      <PageHeader title="Verification History" description="Recent verifications performed by your organization." />

      {loading ? (
        <p className="text-sm text-slate-500 mt-4">Loading...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-500 mt-4">No verifications found.</p>
      ) : (
        <div className="mt-6 bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-xs font-semibold text-slate-500">Date</th>
                <th className="p-3 text-xs font-semibold text-slate-500">Result</th>
                <th className="p-3 text-xs font-semibold text-slate-500">Receipt Tx</th>
                <th className="p-3 text-xs font-semibold text-slate-500">Presentation Token</th>
                <th className="p-3 text-xs font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {history.map((h: any) => (
                <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">{new Date(h.verified_at).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      h.result === "VALID" ? "bg-green-100 text-green-800" :
                      h.result === "EXPIRED" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                    }`}>
                      {h.result}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {h.onchain_receipt_tx ? h.onchain_receipt_tx.slice(0, 16) + "..." : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {(h.Presentation || h.presentation)?.share_token || "—"}
                  </td>
                  <td className="p-3">
                    {(h.Presentation || h.presentation)?.share_token && (
                      <Link to={`/verifier/result/${(h.Presentation || h.presentation).share_token}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
