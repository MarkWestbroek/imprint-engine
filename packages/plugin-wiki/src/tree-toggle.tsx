"use client";

import { useState } from "react";

/** "Alles uitklappen" / "Alles inklappen" for the `<details>` in the wiki tree with this id. */
export function TreeToggle({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
      onClick={() => {
        const next = !open;
        document.getElementById(target)?.querySelectorAll("details").forEach((d) => (d.open = next));
        setOpen(next);
      }}
    >
      {open ? "Alles inklappen" : "Alles uitklappen"}
    </button>
  );
}
