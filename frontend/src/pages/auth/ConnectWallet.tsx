import { useNavigate } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/common/Button";

export default function ConnectWallet() {
  const { address, connect, connecting, error: walletError } = useWallet();
  const { loginWithWallet } = useAuth();
  const navigate = useNavigate();

  async function handleConnect() {
    const addr = await connect();
    if (addr) {
      await loginWithWallet(addr);
      navigate("/citizen");
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 bg-white rounded-lg shadow-sm border text-center">
      <h1 className="text-xl font-bold mb-4">Citizen Wallet Login</h1>
      <p className="text-sm text-slate-500 mb-6">Connect your MetaMask wallet to view and share your credentials.</p>
      <Button onClick={handleConnect} disabled={connecting}>
        {connecting ? "Connecting..." : address ? address : "Connect MetaMask"}
      </Button>
      {walletError && <p className="text-red-600 text-sm mt-3">{walletError}</p>}
    </div>
  );
}
