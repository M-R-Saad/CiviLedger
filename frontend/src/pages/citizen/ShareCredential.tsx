import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { citizenApi } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useWallet } from "../../hooks/useWallet";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastProvider";
import type { Credential } from "../../types";
import { ethers } from "ethers";

export default function ShareCredential() {
  const location = useLocation();
  const preselect = (location.state as any)?.preselect as string | undefined;

  const { run: fetchCredentials, data: credentials } = useApi<Credential[]>(citizenApi.listMyCredentials);
  const { signMessage } = useWallet();
  const { addToast } = useToast();

  const [selected, setSelected] = useState<string[]>(preselect ? [preselect] : []);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMetaMask = typeof window !== "undefined" && !!(window as any).ethereum;

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleShare() {
    setBusy(true);
    setError(null);
    try {
      const message = `CiviLedger consent to share credentials: ${selected.join(",")} at ${new Date().toISOString()}`;
      const consentHash = ethers.keccak256(ethers.toUtf8Bytes(message));

      let signature: string;
      if (hasMetaMask) {
        // Production path: citizen signs consent with their MetaMask wallet
        signature = await signMessage(message);
      } else {
        // Demo path: no MetaMask — consent is still recorded on-chain by the backend
        // (the backend relays it using the admin signer for the prototype)
        signature = "demo-consent-" + Date.now();
      }

      const { data } = await citizenApi.createPresentation({
        credential_ids: selected,
        consent_signature: signature,
        consent_hash: consentHash,
        expiry_minutes: expiryMinutes
      });

      setShareUrl(data.shareUrl);
      setShareToken(data.shareUrl?.replace("/verify/", "") || null);
      setQrDataUrl(data.qrDataUrl);
      addToast("📋 Share link generated — consent recorded on-chain", "success");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to create share link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Share Credentials</h1>
      <p className="text-sm text-slate-500 mb-4">
        Select the credentials you want to share, then generate a share link. The verifier will use this link to verify your credentials against the blockchain.
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {credentials?.map((c) => (
          <label key={c.id} className={`flex items-center gap-3 bg-white border rounded-lg px-4 py-3 cursor-pointer transition-all ${
            selected.includes(c.id) ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "hover:border-slate-300"
          }`}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="w-4 h-4 text-blue-600"
            />
            <div>
              <span className="font-medium text-sm">{c.CredentialType?.display_name || c.credential_type_id}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                c.status_cache === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {c.status_cache}
              </span>
            </div>
          </label>
        ))}
      </div>

      {!hasMetaMask && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-3">
          ℹ️ MetaMask not detected — consent will be recorded on-chain by the backend (demo mode).
          In production, citizens would sign consent with their own wallet.
        </p>
      )}

      {/* Expiry Time Picker */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <label className="text-sm font-medium text-slate-700 block mb-2">Link expires after</label>
        <div className="flex gap-2">
          {[{ val: 15, label: "15 minutes" }, { val: 60, label: "1 hour" }, { val: 1440, label: "24 hours" }].map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setExpiryMinutes(opt.val)}
              className={`text-xs px-3 py-2 rounded-lg border transition-all ${
                expiryMinutes === opt.val
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 hover:bg-blue-50 hover:border-blue-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleShare} disabled={!selected.length || busy}>
        {busy ? "Creating share link..." : hasMetaMask ? "Generate Share Link (sign with MetaMask)" : "Generate Share Link"}
      </Button>

      {error && <p className="text-red-600 text-sm mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {shareUrl && (
        <div className="mt-6 p-5 bg-white border rounded-xl">
          <h2 className="text-sm font-semibold mb-3">✅ Share link created!</h2>

          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1">Share this URL with the verifier:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all bg-slate-50 px-3 py-2 rounded-lg flex-1 border">
                {window.location.origin}{shareUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
                  addToast("📋 Share link copied to clipboard", "info");
                }}
                className="text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>

          {shareToken && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Or paste this token on the Verifier Portal:</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-green-50 px-3 py-2 rounded-lg flex-1 border border-green-200 text-green-800 select-all">
                  {shareToken}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareToken);
                    addToast("📋 Token copied to clipboard", "info");
                  }}
                  className="text-xs px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap"
                >
                  Copy Token
                </button>
              </div>
            </div>
          )}

          {qrDataUrl && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">QR Code (scan with verifier app):</p>
              <img src={qrDataUrl} alt="Presentation QR code" className="w-40 h-40 border rounded-lg" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
