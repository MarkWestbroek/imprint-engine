"use client";

import { deletePlanningAction } from "@/app/admin/planning/actions";

/** Delete a planning board (and its cards). Confirms first — history is kept,
 * so a mistaken delete is restorable via admin History. */
export function DeleteBoardButton({ slug, cardCount }: { slug: string; cardCount: number }) {
  return (
    <form
      action={deletePlanningAction}
      className="ml-auto"
      onSubmit={(e) => {
        const msg =
          cardCount > 0
            ? `Delete board "${slug}" and its ${cardCount} card(s)? History is kept — restorable via admin.`
            : `Delete board "${slug}"?`;
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <button className="rounded border border-line px-2.5 py-1 text-sm text-muted hover:border-red-400 hover:text-red-400">
        Delete board
      </button>
    </form>
  );
}
