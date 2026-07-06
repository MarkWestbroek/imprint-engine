"use client";

import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "./schema-form";

/**
 * The widget composer (UML: Page ◆ PageLayout ◇ Widget*): pick a template,
 * place widgets in its regions, order them, and configure each widget with
 * a form generated from its config schema.
 */

export type LayoutValue = {
  template: string;
  widgets: { type: string; region: string; config: Record<string, unknown> }[];
};

export function PageComposer({
  value,
  onChange,
  templates,
  widgetSchemas,
}: {
  value: LayoutValue | undefined;
  onChange: (v: LayoutValue | undefined) => void;
  templates: Record<string, { regions: string[] }>;
  widgetSchemas: { name: string; label: string; schema: JsonSchema }[];
}) {
  if (!value) {
    return (
      <button
        type="button"
        className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent"
        onClick={() => onChange({ template: "single", widgets: [] })}
      >
        + Add widget layout
      </button>
    );
  }

  const template = templates[value.template] ?? { regions: ["main"] };

  const setWidgets = (widgets: LayoutValue["widgets"]) =>
    onChange({ ...value, widgets });

  const move = (index: number, direction: -1 | 1) => {
    const region = value.widgets[index].region;
    const siblings = value.widgets
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.region === region);
    const pos = siblings.findIndex(({ i }) => i === index);
    const swap = siblings[pos + direction];
    if (!swap) return;
    const next = [...value.widgets];
    [next[index], next[swap.i]] = [next[swap.i], next[index]];
    setWidgets(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            template
          </span>
          <select
            className="mt-1 rounded-md border border-line bg-background px-2.5 py-1.5 text-sm"
            value={value.template}
            onChange={(e) => onChange({ ...value, template: e.target.value })}
          >
            {Object.keys(templates).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-red-400 hover:text-red-400"
          onClick={() => onChange(undefined)}
        >
          Remove layout
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {template.regions.map((region) => (
          <div key={region} className="rounded-xl border border-dashed border-line p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
              {region}
            </h4>
            <div className="space-y-3">
              {value.widgets.map((widget, index) => {
                if (widget.region !== region) return null;
                const def = widgetSchemas.find((w) => w.name === widget.type);
                return (
                  <div key={index} className="rounded-lg border border-line bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {def?.label ?? widget.type}
                      </span>
                      <span className="flex gap-1 text-xs">
                        <IconButton label="↑" onClick={() => move(index, -1)} />
                        <IconButton label="↓" onClick={() => move(index, 1)} />
                        <select
                          className="rounded border border-line bg-background px-1 py-0.5"
                          value={widget.region}
                          title="Move to region"
                          onChange={(e) => {
                            const next = [...value.widgets];
                            next[index] = { ...widget, region: e.target.value };
                            setWidgets(next);
                          }}
                        >
                          {template.regions.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <IconButton
                          label="✕"
                          onClick={() =>
                            setWidgets(value.widgets.filter((_, i) => i !== index))
                          }
                        />
                      </span>
                    </div>
                    {def && (
                      <SchemaForm
                        schema={def.schema}
                        value={widget.config}
                        onChange={(config) => {
                          const next = [...value.widgets];
                          next[index] = { ...widget, config };
                          setWidgets(next);
                        }}
                      />
                    )}
                  </div>
                );
              })}
              <AddWidget
                widgetSchemas={widgetSchemas}
                onAdd={(type) =>
                  setWidgets([...value.widgets, { type, region, config: {} }])
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-accent hover:text-foreground"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AddWidget({
  widgetSchemas,
  onAdd,
}: {
  widgetSchemas: { name: string; label: string }[];
  onAdd: (type: string) => void;
}) {
  return (
    <select
      className="w-full rounded-md border border-dashed border-line bg-background px-2.5 py-1.5 text-sm text-muted"
      value=""
      onChange={(e) => e.target.value && onAdd(e.target.value)}
    >
      <option value="">+ Add widget…</option>
      {widgetSchemas.map((w) => (
        <option key={w.name} value={w.name}>
          {w.label}
        </option>
      ))}
    </select>
  );
}
