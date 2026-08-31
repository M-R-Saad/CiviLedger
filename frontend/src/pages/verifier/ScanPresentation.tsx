import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";

// For the prototype, "scanning" a QR just means the citizen's link opens this page's
// route (/verify/:token) or the verifier pastes the token manually. A real camera-based
// QR scanner library (e.g. react-qr-reader) can be dropped in here later if time allows.
export default function ScanPresentation() {
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Verify a Presentation</h1>
      <p className="text-sm text-slate-500 mb-3">Paste the share token or link from the citizen, or scan their QR code.</p>
      <input
        className="border rounded px-3 py-2 w-full mb-3"
        placeholder="Share token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Button onClick={() => navigate(`/verifier/result/${token}`)} disabled={!token}>
        Check
      </Button>
    </div>
  );
}
