import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api";
import { Button } from "../../components/common/Button";

export default function ConnectWallet() {
  const { connect, connecting, error: walletError, signMessage } = useWallet();
  const { loginWithWallet } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const address = await connect();
      if (!address) return;
      // Challenge / response: the server sends a message, the wallet signs it.
      const { data } = await authApi.walletNonce(address);
      const signature = await signMessage(data.message);
      await loginWithWallet(address, signature);
      navigate("/citizen");
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (err as { message?: string })?.message ||
        "Wallet login failed. Try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 bg-white rounded-lg shadow-sm border text-center">
      <h1 className="text-xl font-bold mb-4">Citizen wallet login</h1>
      <p className="text-sm text-slate-500 mb-6">
        Connect MetaMask and sign a one-time message to prove the wallet is yours.
      </p>
      <Button onClick={handleConnect} disabled={connecting || busy}>
        {connecting ? "Connecting..." : busy ? "Waiting for signature..." : "Connect MetaMask"}
      </Button>
      {(error || walletError) && (
        <p className="text-red-600 text-sm mt-3">{error || walletError}</p>
      )}
    </div>
  );
}
