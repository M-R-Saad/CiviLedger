import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
      <Link to="/" className="font-bold text-lg">CiviLedger</Link>
      <div className="flex gap-4 items-center text-sm">
        {user?.role === "CITIZEN" && <Link to="/citizen">My Wallet</Link>}
        {user?.role === "ISSUER_ADMIN" && <Link to="/issuer">Issuer Dashboard</Link>}
        {user?.role === "VERIFIER_STAFF" && <Link to="/verifier">Verifier Portal</Link>}
        {user?.role === "OVERSIGHT" && <Link to="/oversight">Governance</Link>}
        {user ? (
          <button onClick={logout} className="bg-slate-700 px-3 py-1 rounded">Log out</button>
        ) : (
          <Link to="/login" className="bg-slate-700 px-3 py-1 rounded">Log in</Link>
        )}
      </div>
    </nav>
  );
}
