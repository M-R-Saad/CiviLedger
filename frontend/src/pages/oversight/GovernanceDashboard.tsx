import { useState, useEffect } from "react";
import { governanceApi } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Button } from "../../components/common/Button";
import { Link } from "react-router-dom";
import type { Organization } from "../../types";

export default function GovernanceDashboard() {
  const [name, setName] = useState("");
  const [onchainAddress, setOnchainAddress] = useState("");
  const [orgType, setOrgType] = useState<"ISSUER" | "VERIFIER" | "BOTH">("ISSUER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { run: fetchPending, data: pendingOrgs } = useApi<Organization[]>(governanceApi.listPendingMembers);
  const { run: fetchOrgs, data: allOrgs } = useApi<Organization[]>(governanceApi.listOrganizations);

  useEffect(() => {
    fetchPending();
    fetchOrgs();
  }, [fetchPending, fetchOrgs]);

  async function handlePropose() {
    setBusy(true);
    setMessage(null);
    try {
      await governanceApi.proposeMember({
        name,
        onchain_address: onchainAddress,
        type: orgType,
        credential_types_authorized: []
      });
      setMessage(`Proposed "${name}" successfully.`);
      setName("");
      setOnchainAddress("");
      fetchPending();
      fetchOrgs();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Failed to propose member");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(orgId: string) {
    try {
      await governanceApi.approveMember(orgId);
      setMessage("Member approved.");
      fetchPending();
      fetchOrgs();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Approval failed");
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Governance Dashboard</h1>
        <Link to="/oversight/audit">
          <Button className="bg-slate-600 hover:bg-slate-500">View Audit Log</Button>
        </Link>
      </div>

      {/* Propose New Member */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-sm mb-3">Propose New Member</h2>
        <div className="flex flex-col gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="On-chain address (0x...)"
            value={onchainAddress}
            onChange={(e) => setOnchainAddress(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as any)}
          >
            <option value="ISSUER">Issuer</option>
            <option value="VERIFIER">Verifier</option>
            <option value="BOTH">Both</option>
          </select>
          <Button onClick={handlePropose} disabled={busy || !name || !onchainAddress}>
            {busy ? "Submitting..." : "Propose Member"}
          </Button>
          {message && (
            <p className={`text-sm ${message.includes("success") || message.includes("approved") ? "text-green-700" : "text-red-600"}`}>
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingOrgs && pendingOrgs.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-sm mb-3">Pending Approvals</h2>
          <div className="flex flex-col gap-2">
            {pendingOrgs.map((org) => (
              <div key={org.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{org.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{org.onchain_address}</p>
                </div>
                <Button onClick={() => handleApprove(org.id)} className="bg-green-700 hover:bg-green-600">
                  Approve
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Organizations */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">All Organizations</h2>
        {allOrgs && allOrgs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Address</th>
              </tr>
            </thead>
            <tbody>
              {allOrgs.map((org) => (
                <tr key={org.id} className="border-t">
                  <td className="p-2">{org.name}</td>
                  <td className="p-2">{org.type}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      org.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : org.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-xs">{org.onchain_address?.slice(0, 10)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500 text-sm">No organizations yet.</p>
        )}
      </div>
    </div>
  );
}
