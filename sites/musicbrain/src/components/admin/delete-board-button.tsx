"use client";

import { useRef } from "react";
import { deletePlanningAction } from "@/app/admin/planning/actions";
import { confirmDialog } from "./dialog";

/** Delete a planning board (and its cards). Confirms first — history is kept,
 * so a mistaken delete is restorable via admin History. */
export function DeleteBoardButton({ slug, cardCount }: { slug: string; cardCount: number }) {
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  return (
    <form
      ref={form}
      action={deletePlanningAction}
      className="ml-auto"
      onSubmit={(e) => {
        if (confirmed.current) {
          confirmed.current = false;
          return; // doorlaten: de dialoog heeft al ja gezegd
        }
        e.preventDefault();
        const msg =
          cardCount > 0
            ? `Delete board "${slug}" and its ${cardCount} card(s)?\nHistory is kept — restorable via admin.`
            : `Delete board "${slug}"?`;
        void confirmDialog(msg, { confirmLabel: "Delete", danger: true }).then((ok) => {
          if (!ok) return;
          confirmed.current = true;
          form.current?.requestSubmit();
        });
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <button className="rounded border border-line px-2.5 py-1 text-sm text-muted hover:border-red-400 hover:text-red-400">
        Delete board
      </button>
    </form>
  );
}
