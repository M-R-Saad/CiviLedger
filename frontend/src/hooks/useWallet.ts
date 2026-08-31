import { useState, useCallback } from "react";
import { BrowserProvider } from "ethers";

/**
 * Minimal MetaMask connect + sign hook. Extend signMessage() usage in
 * ShareCredential.tsx to produce the consent_signature / consent_hash
 * sent to POST /citizen/presentations.
 */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (!(window as any).ethereum) {
      setError("MetaMask not detected. Please install the MetaMask extension.");
      return null;
    }
    try {
      setConnecting(true);
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      return accounts[0] as string;
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const signMessage = useCallback(async (message: string) => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    return signer.signMessage(message);
  }, []);

  return { address, connecting, error, connect, signMessage };
}
