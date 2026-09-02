import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { StatsCard } from "../../components/ui/StatsCard";
import { verifierApi } from "../../services/api";
import { Html5Qrcode } from "html5-qrcode";

interface VerifierStats {
  totalVerifications: number;
  passed: number;
  failed: number;
}

export default function ScanPresentation() {
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stats, setStats] = useState<VerifierStats | null>(null);
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function extractToken(text: string): string {
    // Handle full URLs like http://localhost:5173/verify/abc123
    const match = text.match(/\/verify\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    // Otherwise treat the whole text as a token
    return text.trim();
  }

  async function startScanning() {
    setCameraError(null);
    setScanning(true);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          const extractedToken = extractToken(decodedText);
          setToken(extractedToken);
          scanner.stop().catch(() => {});
          setScanning(false);
          navigate(`/verifier/result/${extractedToken}`);
        },
        () => {
          // QR code not found in frame — ignore
        }
      );
    } catch (err: any) {
      setCameraError(err?.message || "Camera not available. Use the manual input below.");
      setScanning(false);
    }
  }

  function stopScanning() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Fetch stats on mount
  useEffect(() => {
    verifierApi.stats().then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Verify a Presentation</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatsCard label="Verified" value={stats.totalVerifications} color="accent" />
          <StatsCard label="Passed" value={stats.passed} color="ok" />
          <StatsCard label="Failed" value={stats.failed} color="danger" />
        </div>
      )}

      {/* QR Scanner Section */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">📷 Scan QR Code</h2>
        <p className="text-xs text-slate-500 mb-3">
          Point your camera at the citizen's QR code for instant verification.
        </p>

        {/* QR Reader Container */}
        <div
          id="qr-reader"
          ref={containerRef}
          className="w-full rounded-lg overflow-hidden mb-3"
          style={{ display: scanning ? "block" : "none" }}
        />

        {!scanning ? (
          <Button onClick={startScanning} className="w-full">
            🔍 Start Camera Scanner
          </Button>
        ) : (
          <Button onClick={stopScanning} className="w-full bg-slate-600 hover:bg-slate-500">
            Stop Scanner
          </Button>
        )}

        {cameraError && (
          <p className="text-xs text-red-500 mt-2">{cameraError}</p>
        )}
      </div>

      {/* Manual Input Section */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">✏️ Manual Input</h2>
        <p className="text-xs text-slate-500 mb-3">
          Or paste the share token or link from the citizen.
        </p>
        <input
          className="border rounded px-3 py-2 w-full mb-3 text-sm"
          placeholder="Paste share token or full URL..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && token) {
              const t = extractToken(token);
              navigate(`/verifier/result/${t}`);
            }
          }}
        />
        <Button
          onClick={() => {
            const t = extractToken(token);
            navigate(`/verifier/result/${t}`);
          }}
          disabled={!token}
          className="w-full"
        >
          Verify
        </Button>
      </div>
    </div>
  );
}
