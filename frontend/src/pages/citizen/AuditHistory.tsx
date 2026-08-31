import { useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { citizenApi } from "../../services/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

export default function AuditHistory() {
  const { run, data: presentations, loading, error } = useApi(citizenApi.auditHistory);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">My Sharing History</h1>
      <p className="text-sm text-slate-500 mb-6">
        Every time you share credentials with a verifier, it is logged here with an on-chain consent record.
      </p>

      {loading && <LoadingSpinner />}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && presentations?.length === 0 && (
        <p className="text-slate-500 text-sm">No sharing history yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {presentations?.map((p: any) => (
          <div key={p.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-medium">
                  Shared {p.credential_ids?.length || 0} credential(s)
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                new Date(p.expires_at) > new Date()
                  ? "bg-green-100 text-green-800"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {new Date(p.expires_at) > new Date() ? "Active" : "Expired"}
              </span>
            </div>

            {p.verifierOrg && (
              <p className="text-xs text-slate-500 mb-1">
                Verifier: <span className="font-medium text-slate-700">{p.verifierOrg.name}</span>
              </p>
            )}

            <p className="text-xs text-slate-400 font-mono break-all">
              Token: {p.share_token}
            </p>

            {/* Verification events for this presentation */}
            {p.VerificationEvents && p.VerificationEvents.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <p className="text-xs font-medium text-slate-600 mb-1">Verification Results:</p>
                {p.VerificationEvents.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      v.result === "VALID" ? "bg-green-500" : "bg-red-500"
                    }`} />
                    <span>{v.result}</span>
                    <span className="text-slate-400">
                      {new Date(v.verified_at).toLocaleString()}
                    </span>
                    {v.onchain_receipt_tx && (
                      <span className="text-slate-300 font-mono">
                        tx:{v.onchain_receipt_tx.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
