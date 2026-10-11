/**
 * The Omnium mark (the ring with six facets around the hub), after
 * public/brand/mark.svg, inline so it takes the page's colours: the ring keeps
 * the brand gradient, the word next to it is plain text in the chrome.
 */
export function OmniumMark({ className, title = "Omnium" }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="om-ring" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="om-hub" x1="18" y1="18" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill="none" stroke="url(#om-ring)" strokeWidth="3" />
      <circle cx="24" cy="6" r="3.4" fill="#2563eb" />
      <circle cx="39.59" cy="15" r="3.4" fill="#4f46e5" />
      <circle cx="39.59" cy="33" r="3.4" fill="#7c3aed" />
      <circle cx="24" cy="42" r="3.4" fill="#0891b2" />
      <circle cx="8.41" cy="33" r="3.4" fill="#0284c7" />
      <circle cx="8.41" cy="15" r="3.4" fill="#0ea5e9" />
      <rect x="19.5" y="19.5" width="9" height="9" rx="2.2" transform="rotate(45 24 24)" fill="url(#om-hub)" />
    </svg>
  );
}
