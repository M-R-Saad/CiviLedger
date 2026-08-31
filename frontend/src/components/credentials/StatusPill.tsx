const COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  SUSPENDED: "bg-yellow-100 text-yellow-800",
  REVOKED: "bg-red-100 text-red-800",
  SUPERSEDED: "bg-slate-100 text-slate-600"
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${COLORS[status] || "bg-slate-100"}`}>
      {status}
    </span>
  );
}
