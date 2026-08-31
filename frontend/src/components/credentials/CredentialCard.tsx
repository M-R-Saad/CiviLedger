import { StatusPill } from "./StatusPill";
import type { Credential } from "../../types";

export function CredentialCard({ credential, children }: { credential: Credential; children?: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">{credential.CredentialType?.display_name || credential.credential_type_id}</h3>
        <StatusPill status={credential.status_cache} />
      </div>
      <p className="text-xs text-slate-500">Issued by {credential.issuer?.name || credential.issuer_org_id}</p>
      <p className="text-xs text-slate-400">Issued: {new Date(credential.issued_at).toLocaleDateString()}</p>
      {children}
    </div>
  );
}
