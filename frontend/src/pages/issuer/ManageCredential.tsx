import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { issuerApi } from "../../services/api";
import { Button } from "../../components/common/Button";

export default function ManageCredential() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAction(action: "SUSPEND" | "REACTIVATE" | "REVOKE") {
    if (!id) return;
    setBusy(true);
    try {
      await issuerApi.changeStatus(id, action, reason);
      navigate("/issuer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Manage Credential</h1>
      <textarea
        className="border rounded px-3 py-2 w-full mb-3"
        placeholder="Reason (optional, recorded on-chain)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => handleAction("SUSPEND")} className="bg-yellow-600 hover:bg-yellow-500">Suspend</Button>
        <Button disabled={busy} onClick={() => handleAction("REACTIVATE")} className="bg-green-700 hover:bg-green-600">Reactivate</Button>
        <Button disabled={busy} onClick={() => handleAction("REVOKE")} className="bg-red-700 hover:bg-red-600">Revoke</Button>
      </div>
    </div>
  );
}
