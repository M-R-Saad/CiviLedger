import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { credentialTypesApi, issuerApi } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastProvider";
import type { CredentialType } from "../../types";

// Pre-filled demo citizens for quick selection during demos
const DEMO_CITIZENS = [
  { label: "Ahnaf Tahmid", wallet: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" },
  { label: "Sumaya Zaman", wallet: "0x976EA74026E726554dB657fA54763abd0C3a0aa9" },
];

export default function IssueCredentialForm() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { run: fetchTypes, data: types } = useApi<CredentialType[]>(credentialTypesApi.list);

  const [typeCode, setTypeCode] = useState("");
  const [citizenWallet, setCitizenWallet] = useState("");
  const [payloadFields, setPayloadFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const selectedType = types?.find((t) => t.code === typeCode);

  function selectDemoCitizen(wallet: string) {
    setCitizenWallet(wallet);
    setLookupStatus(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // The backend will look up citizen_user_id by wallet address.
      // We pass wallet address only — much simpler for the demo.
      const { data } = await issuerApi.issueCredential({
        credential_type_code: typeCode,
        citizen_wallet_address: citizenWallet,
        payload: payloadFields
      });
      addToast(`✅ Credential issued — anchored on-chain (${data.onchain?.anchorId?.slice(0, 12)}...)`, "success");
      navigate("/issuer");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to issue credential");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Issue New Credential</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-white border rounded-xl p-5">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Credential type</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value)}
            required
          >
            <option value="">Select a type</option>
            {types?.map((t) => (
              <option key={t.code} value={t.code}>{t.display_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Citizen wallet address (0x...)</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
            value={citizenWallet}
            onChange={(e) => { setCitizenWallet(e.target.value); setLookupStatus(null); }}
            required
          />
          {lookupStatus && <p className="text-xs text-green-600 mt-1">{lookupStatus}</p>}
        </div>

        {/* Quick-pick demo citizens */}
        <div className="bg-slate-50 rounded-lg p-3 border">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Quick pick — Demo Citizens</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_CITIZENS.map((c) => (
              <button
                key={c.wallet}
                type="button"
                onClick={() => selectDemoCitizen(c.wallet)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  citizenWallet === c.wallet
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {selectedType && (
          <fieldset className="border rounded-lg p-4">
            <legend className="text-xs text-slate-500 px-2 font-medium">Credential fields ({selectedType.display_name})</legend>
            {Object.keys(selectedType.json_schema.fields).map((field) => (
              <div key={field} className="mb-3">
                <label className="text-xs font-medium text-slate-600 block mb-1 capitalize">
                  {field.replace(/_/g, " ")}
                </label>
                <input
                  className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={payloadFields[field] || ""}
                  onChange={(e) => setPayloadFields((prev) => ({ ...prev, [field]: e.target.value }))}
                />
              </div>
            ))}
          </fieldset>
        )}

        {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Issuing (anchoring on-chain)..." : "Issue Credential"}</Button>
      </form>
    </div>
  );
}
