import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { citizenApi } from "../../services/api";
import { StatusPill } from "../../components/credentials/StatusPill";
import type { Credential } from "../../types";

interface StatusEvent {
  id: string;
  previous_status: string;
  new_status: string;
  reason?: string;
  onchain_tx_hash?: string;
  created_at: string;
}

interface CredentialDetail extends Credential {
  CredentialStatusEvents?: StatusEvent[];
}

export default function CitizenCredentialDetail() {
  const { id } = useParams<{ id: string }>();
  const [credential, setCredential] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    citizenApi.getCredential(id)
      .then((r) => setCredential(r.data))
      .catch((e) => setError(e?.response?.data?.error || "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-3xl mx-auto mt-10 px-4"><p className="text-sm text-slate-500">Loading...</p></div>;
  if (error || !credential) return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <p className="text-red-600 text-sm">{error || "Credential not found"}</p>
      <Link to="/citizen" className="text-sm underline text-slate-600 mt-2 inline-block">← Back to wallet</Link>
    </div>
  );

  const payload = credential.payload || {};
  const statusEvents = credential.CredentialStatusEvents || [];

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4 pb-10">
      <Link to="/citizen" className="text-sm text-slate-500 hover:text-slate-800 mb-4 inline-block">← Back to wallet</Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{credential.CredentialType?.display_name || "Credential"}</h1>
          <p className="text-xs text-slate-500 mt-1">Issued by <strong>{credential.issuer?.name || credential.issuer_org_id}</strong></p>
        </div>
        <StatusPill status={credential.status_cache} />
      </div>

      {/* Credential Payload */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">Credential Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(payload).map(([key, value]) => (
            <div key={key}>
              <p className="text-xs text-slate-500 font-medium capitalize">{key.replace(/_/g, " ")}</p>
              <p className="text-sm font-medium">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* On-chain Info */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">Verification Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Anchor ID</p>
            <p className="text-sm font-mono break-all">{credential.onchain_anchor_id || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Content Hash</p>
            <p className="text-sm font-mono break-all">{credential.payload_hash}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Issued</p>
            <p className="text-sm">{new Date(credential.issued_at).toLocaleString()}</p>
          </div>
          {credential.expires_at && (
            <div>
              <p className="text-xs text-slate-500">Expires</p>
              <p className="text-sm">{new Date(credential.expires_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status History */}
      {statusEvents.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Status History</h2>
          <div className="space-y-3">
            {statusEvents.map((evt) => (
              <div key={evt.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={evt.previous_status} />
                    <span className="text-xs text-slate-400">→</span>
                    <StatusPill status={evt.new_status} />
                  </div>
                  {evt.reason && <p className="text-xs text-slate-500 mt-1">Reason: {evt.reason}</p>}
                  {evt.onchain_tx_hash && (
                    <p className="text-xs text-slate-400 font-mono mt-1">Tx: {evt.onchain_tx_hash.slice(0, 20)}...</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(evt.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Action */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Actions</h2>
        <Link
          to="/citizen/share"
          state={{ preselect: credential.id }}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
        >
          Share this credential
        </Link>
      </div>
    </div>
  );
}
