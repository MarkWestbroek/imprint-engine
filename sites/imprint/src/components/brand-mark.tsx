type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className, title = "Imprint" }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="8" y="5" width="22" height="36" rx="1" fill="currentColor" opacity="0.28" />
      <rect x="18" y="8" width="22" height="36" rx="1" fill="currentColor" />
      <rect x="25" y="15" width="4" height="22" fill="var(--mark-cut, #f7f4ed)" />
      <circle cx="27" cy="11.5" r="2" fill="var(--mark-accent, #dcff55)" />
    </svg>
  );
}

export function ColophonMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="5" y="5" width="38" height="38" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h6v20h-6zM25 14h9v5h-4v15h-5z" fill="currentColor" />
      <path d="M9 39h30" stroke="var(--mark-accent, #dcff55)" strokeWidth="3" />
    </svg>
  );
}

export function MultiplicityMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M7 8h19v25H7z" fill="currentColor" opacity="0.25" />
      <path d="M15 12h19v25H15z" fill="currentColor" opacity="0.55" />
      <path d="M23 16h19v25H23z" fill="currentColor" />
      <path d="M30 22v13" stroke="var(--mark-cut, #f7f4ed)" strokeWidth="3" />
    </svg>
  );
}
