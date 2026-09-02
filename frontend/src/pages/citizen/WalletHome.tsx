import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { citizenApi } from "../../services/api";
import { CredentialCard } from "../../components/credentials/CredentialCard";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { StatsCard } from "../../components/ui/StatsCard";
import type { Credential } from "../../types";

interface CitizenStats {
  totalCredentials: number;
  activeCredentials: number;
  expiredCredentials: number;
  totalShared: number;
}

export default function WalletHome() {
  const { run, data: credentials, loading } = useApi<Credential[]>(citizenApi.listMyCredentials);
  const [stats, setStats] = useState<CitizenStats | null>(null);

  useEffect(() => {
    run();
    citizenApi.stats().then((r) => setStats(r.data)).catch(() => {});
  }, [run]);

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">My Credentials</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatsCard label="Total Held" value={stats.totalCredentials} color="accent" />
          <StatsCard label="Active" value={stats.activeCredentials} color="ok" />
          <StatsCard label="Expired" value={stats.expiredCredentials} color="warn" />
          <StatsCard label="Times Shared" value={stats.totalShared} color="default" />
        </div>
      )}

      {loading && <LoadingSpinner />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {credentials?.map((c) => (
          <CredentialCard key={c.id} credential={c}>
            <Link to="/citizen/share" state={{ preselect: c.id }} className="text-sm underline text-slate-700">
              Share this credential
            </Link>
          </CredentialCard>
        ))}
      </div>
      {!loading && credentials?.length === 0 && (
        <p className="text-slate-500 text-sm">No credentials yet. Ask an issuer to issue one to your wallet address.</p>
      )}
    </div>
  );
}
