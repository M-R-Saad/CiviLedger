import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { verifierApi } from "../../services/api";
import { Button } from "../../components/common/Button";
import type { VerificationResult as VerificationResultType } from "../../types";

const RESULT_STYLE: Record<string, string> = {
  VALID: "bg-green-100 text-green-800 border-green-300",
  REVOKED: "bg-red-100 text-red-800 border-red-300",
  EXPIRED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  INVALID_SIGNATURE: "bg-red-100 text-red-800 border-red-300",
  ISSUER_NOT_TRUSTED: "bg-red-100 text-red-800 border-red-300"
};

export default function VerificationResult() {
  const { token } = useParams();
  const [presentation, setPresentation] = useState<any>(null);
  const [result, setResult] = useState<VerificationResultType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    verifierApi.getPresentation(token).then((res) => setPresentation(res.data)).catch((e) => setError(e?.response?.data?.error || "Not found"));
  }, [token]);

  async function handleVerify() {
    if (!token) return;
    try {
      const { data } = await verifierApi.verify(token);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Verification failed");
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Verification Result</h1>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {presentation && !result && (
        <div className="bg-white border rounded p-4 mb-4">
          <p className="text-sm mb-3">{presentation.credentials?.length} credential(s) shared. Ready to verify.</p>
          <Button onClick={handleVerify}>Verify on-chain</Button>
        </div>
      )}

      {result && (
        <div className={`border rounded p-4 ${RESULT_STYLE[result.result] || ""}`}>
          <p className="text-lg font-bold">
            {result.result === "VALID" ? "✅ Valid" : `❌ ${result.result}`}
          </p>
          <ul className="text-xs mt-2">
            {result.details.map((d) => (
              <li key={d.credential_id}>{d.credential_id.slice(0, 8)}... — {d.liveStatus}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
