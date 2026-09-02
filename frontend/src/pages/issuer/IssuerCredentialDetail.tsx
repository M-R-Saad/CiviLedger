import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { issuerApi } from "../../services/api";
import { StatusPill } from "../../components/credentials/StatusPill";
import { Button } from "../../components/common/Button";
import type { Credential } from "../../types";

interface StatusEvent {
  id: string;
  previous_status: string;
  new_status: string;
  reason?: string;
  actor_user_id?: string;
  onchain_tx_hash?: string;
  created_at: string;
}

interface CredentialDetail extends Credential {
  citizen?: { id: string; full_name: string; wallet_address?: string; did?: string };
  CredentialStatusEvents?: StatusEvent[];
}

export default function IssuerCredentialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [credential, setCredential] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    issuerApi.getCredential(id)
      .then((r) => setCredential(r.data))
      .catch((e) => setError(e?.response?.data?.error || "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAction(action: string) {
    if (!id) return;
    const reason = prompt(`Reason for ${action.toLowerCase()}:`);
    if (reason === null) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      const { data } = await issuerApi.changeStatus(id, action, reason);
      setCredential((prev) => prev ? { ...prev, status_cache: data.credential.status_cache } : prev);
      setActionMsg(`${action} successful. Tx: ${data.onchain?.txHash?.slice(0, 16)}...`);
      // Refresh to get updated status history
      const refreshed = await issuerApi.getCredential(id);
      setCredential(refreshed.data);
    } catch (e: any) {
      setActionMsg(e?.response?.data?.error || `${action} failed`);
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto mt-10 px-4"><p className="text-sm text-slate-500">Loading...</p></div>;
  if (error || !credential) return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <p className="text-red-600 text-sm">{error || "Credential not found"}</p>
      <Link to="/issuer" className="text-sm underline text-slate-600 mt-2 inline-block">← Back to dashboard</Link>
    </div>
  );

  const payload = credential.payload || {};
  const statusEvents = credential.CredentialStatusEvents || [];

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4 pb-10">
      <Link to="/issuer" className="text-sm text-slate-500 hover:text-slate-800 mb-4 inline-block">← Back to dashboard</Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{credential.CredentialType?.display_name || "Credential"}</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">{credential.id}</p>
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

      {/* Citizen Info */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">Citizen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Name</p>
            <p className="text-sm font-medium">{credential.citizen?.full_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Wallet</p>
            <p className="text-sm font-mono">{credential.citizen?.wallet_address || "—"}</p>
          </div>
          {credential.citizen?.did && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">DID</p>
              <p className="text-sm font-mono break-all">{credential.citizen.did}</p>
            </div>
          )}
        </div>
      </div>

      {/* On-chain Info */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">On-chain Anchor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Anchor ID</p>
            <p className="text-sm font-mono break-all">{credential.onchain_anchor_id || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Payload Hash</p>
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

      {/* Actions */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">Manage</h2>
        <div className="flex flex-wrap gap-2">
          {credential.status_cache === "ACTIVE" && (
            <>
              <Button onClick={() => handleAction("SUSPEND")} disabled={actionBusy} className="bg-yellow-600 hover:bg-yellow-500">
                Suspend
              </Button>
              <Button onClick={() => handleAction("REVOKE")} disabled={actionBusy} className="bg-red-600 hover:bg-red-500">
                Revoke
              </Button>
            </>
          )}
          {credential.status_cache === "SUSPENDED" && (
            <>
              <Button onClick={() => handleAction("REACTIVATE")} disabled={actionBusy} className="bg-green-700 hover:bg-green-600">
                Reactivate
              </Button>
              <Button onClick={() => handleAction("REVOKE")} disabled={actionBusy} className="bg-red-600 hover:bg-red-500">
                Revoke
              </Button>
            </>
          )}
          {credential.status_cache === "REVOKED" && (
            <p className="text-sm text-slate-500">This credential has been permanently revoked.</p>
          )}
        </div>
        {actionMsg && (
          <p className={`text-sm mt-2 ${actionMsg.includes("successful") ? "text-green-700" : "text-red-600"}`}>
            {actionMsg}
          </p>
        )}
      </div>
    </div>
  );
}
