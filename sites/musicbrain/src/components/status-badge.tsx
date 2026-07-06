import type { ProductStatus } from "@imprint/content-core";

const LABELS: Record<ProductStatus, string> = {
  "in-development": "In development",
  beta: "Beta",
  available: "Available",
  discontinued: "Discontinued",
};

const STYLES: Record<ProductStatus, string> = {
  "in-development": "bg-amber-400/10 text-amber-300 border-amber-400/30",
  beta: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  available: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  discontinued: "bg-neutral-400/10 text-neutral-400 border-neutral-400/30",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
