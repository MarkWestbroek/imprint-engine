"use client";

/**
 * Visual editor for Menu/MenuItem (UML): a nestable list of items, each
 * pointing to a Page (picked from the actual pages), an external URL, or
 * nothing (a group label with children).
 */

export type MenuItemV = {
  label: string;
  page?: string;
  url?: string;
  children?: MenuItemV[];
};

export function MenuEditor({
  items,
  onChange,
  pages,
}: {
  items: MenuItemV[];
  onChange: (items: MenuItemV[]) => void;
  pages: { slug: string; title: string }[];
}) {
  return (
    <div className="space-y-2">
      <ItemList items={items} onChange={onChange} pages={pages} />
      <AddButton label="+ menu item" onClick={() => onChange([...items, { label: "" }])} />
    </div>
  );
}

function ItemList({
  items,
  onChange,
  pages,
}: {
  items: MenuItemV[];
  onChange: (items: MenuItemV[]) => void;
  pages: { slug: string; title: string }[];
}) {
  const update = (i: number, item: MenuItemV) =>
    onChange(items.map((it, idx) => (idx === i ? item : it)));
  const move = (i: number, delta: -1 | 1) => {
    const to = i + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const linkKind = item.page !== undefined ? "page" : item.url !== undefined ? "url" : "none";
        return (
          <li key={i} className="rounded-lg border border-line bg-background p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input
                placeholder="Label"
                className="w-40 rounded-md border border-line bg-background px-2 py-1"
                value={item.label}
                onChange={(e) => update(i, { ...item, label: e.target.value })}
              />
              <select
                className="rounded-md border border-line bg-background px-2 py-1"
                value={linkKind}
                onChange={(e) => {
                  const { label, children } = item;
                  if (e.target.value === "page")
                    update(i, { label, children, page: pages[0]?.slug ?? "" });
                  else if (e.target.value === "url")
                    update(i, { label, children, url: "/" });
                  else update(i, { label, children });
                }}
              >
                <option value="none">no link</option>
                <option value="page">page</option>
                <option value="url">URL</option>
              </select>
              {linkKind === "page" && (
                <select
                  className="min-w-40 rounded-md border border-line bg-background px-2 py-1"
                  value={item.page}
                  onChange={(e) => update(i, { ...item, page: e.target.value })}
                >
                  {pages.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.title} (/{p.slug})
                    </option>
                  ))}
                </select>
              )}
              {linkKind === "url" && (
                <input
                  placeholder="https://… or /path#anchor"
                  className="min-w-52 flex-1 rounded-md border border-line bg-background px-2 py-1"
                  value={item.url}
                  onChange={(e) => update(i, { ...item, url: e.target.value })}
                />
              )}
              <span className="ml-auto flex gap-1 text-xs">
                <Mini label="↑" onClick={() => move(i, -1)} />
                <Mini label="↓" onClick={() => move(i, 1)} />
                <Mini
                  label="+ sub"
                  title="Add sub-item"
                  onClick={() =>
                    update(i, { ...item, children: [...(item.children ?? []), { label: "" }] })
                  }
                />
                <Mini
                  label="✕"
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                />
              </span>
            </div>
            {item.children && item.children.length > 0 && (
              <div className="mt-2 border-l border-line pl-3">
                <ItemList
                  items={item.children}
                  onChange={(children) =>
                    update(i, { ...item, children: children.length ? children : undefined })
                  }
                  pages={pages}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Mini({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-accent hover:text-foreground"
    >
      {label}
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}
