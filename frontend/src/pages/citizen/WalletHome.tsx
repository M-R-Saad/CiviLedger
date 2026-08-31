import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { citizenApi } from "../../services/api";
import { CredentialCard } from "../../components/credentials/CredentialCard";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import type { Credential } from "../../types";

export default function WalletHome() {
  const { run, data: credentials, loading } = useApi<Credential[]>(citizenApi.listMyCredentials);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">My Credentials</h1>
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
