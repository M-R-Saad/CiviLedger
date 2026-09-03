import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  /** Rendered in a full-width cell when there are no rows and not loading. */
  empty?: ReactNode;
  /** Accessible table description. */
  caption?: ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  skeletonRows = 5,
  empty,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-container border border-line">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-surface-sunken text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-2.5 font-medium text-ink-muted ${
                  col.align === "right" ? "text-right" : ""
                } ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-t border-line">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[10rem]" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && empty && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                {empty}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-t border-line">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-middle text-ink ${
                      col.align === "right" ? "text-right" : ""
                    } ${col.className ?? ""}`}
                  >
                    {col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
