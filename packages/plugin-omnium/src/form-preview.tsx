"use client";

import { useState } from "react";
import { visible, type NeutralForm, type Question } from "./neutral-form";

/**
 * A neutral form as the resident sees it (werkplaats, pane "Effect"; step 5
 * "Voorbeeld"): one step at a time, with the conditions working, so choosing
 * "bestuurder" shows the kenteken. Nothing is sent; there is no submit. Not a
 * Form.io renderer: a plain rendering of the neutral form, so it looks the
 * same whatever engine runs the form later.
 */
export function FormPreview({ form, highlight, compact = false }: { form: NeutralForm; highlight?: string; compact?: boolean }) {
  const start = Math.max(0, highlight ? form.steps.findIndex((st) => st.questions.some((q) => q.key === highlight)) : 0);
  const [step, setStep] = useState(start);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const set = (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: value }));
  const current = form.steps[step];
  if (!current) return <p className="text-sm text-muted">Dit formulier heeft geen stappen.</p>;

  return (
    <div className="text-sm">
      {form.steps.length > 1 && (
        <ol className="mb-3 flex flex-wrap gap-1" aria-label="Stappen van het formulier">
          {form.steps.map((st, n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => setStep(n)}
                aria-current={n === step ? "step" : undefined}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${n === step ? "border-foreground bg-foreground text-background" : "border-line text-muted hover:text-foreground"}`}
              >
                {n + 1}. {st.title}
              </button>
            </li>
          ))}
        </ol>
      )}
      <fieldset className="space-y-3 rounded-lg border border-line bg-white p-4 text-foreground">
        <legend className="px-1 font-semibold">
          {form.steps.length > 1 ? `Stap ${step + 1}: ` : ""}
          {current.title}
        </legend>
        {current.questions.filter((q) => visible(q, answers)).map((q) => (
          <Field key={q.pointer} q={q} value={answers[q.key]} set={set} lit={q.key === highlight} compact={compact} />
        ))}
      </fieldset>
      {form.steps.length > 1 && (
        <div className="mt-3 flex justify-between">
          <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-40">
            ← Vorige
          </button>
          <button
            type="button"
            disabled={step === form.steps.length - 1}
            onClick={() => setStep(step + 1)}
            className="rounded border border-line px-3 py-1 disabled:opacity-40"
          >
            Volgende →
          </button>
        </div>
      )}
    </div>
  );
}

const input = "mt-1 block w-full rounded border border-line bg-white px-2 py-1 disabled:bg-surface";

function Field({ q, value, set, lit, compact }: { q: Question; value: unknown; set: (k: string, v: unknown) => void; lit: boolean; compact: boolean }) {
  const id = `fp-${q.pointer.replace(/[^\w-]+/g, "-")}`;
  const label = (
    <span className="font-medium">
      {q.label || <span className="text-muted">(zonder label)</span>}
      {q.required && <span aria-hidden> *</span>}
      {q.type !== "content" && q.text && <span className="block text-xs font-normal text-muted">{q.text}</span>}
    </span>
  );
  const wrap = `rounded-md ${lit ? "bg-yellow-100 outline outline-2 outline-yellow-400" : ""} ${compact ? "p-1" : "p-1.5"}`;
  const style = { marginLeft: `${q.depth * 0.75}rem` };

  switch (q.type) {
    case "group":
      return (
        <p className={`${wrap} border-b border-line pt-2 font-semibold`} style={style}>
          {q.label}
        </p>
      );
    case "content":
      return (
        <p className={`${wrap} text-muted`} style={style}>
          {q.text}
        </p>
      );
    case "checkbox":
      return (
        <label className={`${wrap} flex items-center gap-2`} style={style}>
          <input type="checkbox" checked={Boolean(value)} disabled={q.readOnly} onChange={(e) => set(q.key, e.target.checked ? "true" : "")} />
          {label}
        </label>
      );
    case "radio":
      return (
        <fieldset className={wrap} style={style}>
          <legend>{label}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {q.choices.map((c) => (
              <label key={c.value} className="flex items-center gap-1.5">
                <input type="radio" name={id} value={c.value} checked={value === c.value} disabled={q.readOnly} onChange={() => set(q.key, c.value)} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "checkboxes":
      return (
        <fieldset className={wrap} style={style}>
          <legend>{label}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {q.choices.map((c) => {
              const list = Array.isArray(value) ? (value as string[]) : [];
              return (
                <label key={c.value} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={list.includes(c.value)}
                    disabled={q.readOnly}
                    onChange={(e) => set(q.key, e.target.checked ? [...list, c.value] : list.filter((x) => x !== c.value))}
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    case "select":
      return (
        <label className={`${wrap} block`} style={style} htmlFor={id}>
          {label}
          <select id={id} className={input} value={String(value ?? "")} disabled={q.readOnly} onChange={(e) => set(q.key, e.target.value)}>
            <option value="">— kies —</option>
            {q.choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      );
    default: {
      const type = { number: "number", date: "date", datetime: "datetime-local", time: "time", file: "file" }[q.type as string] ?? "text";
      return (
        <label className={`${wrap} block`} style={style} htmlFor={id}>
          {label}
          {q.engineType !== "textfield" && q.type === "text" && <span className="ml-2 text-xs text-muted">{q.engineType}</span>}
          {q.type === "textarea" ? (
            <textarea id={id} rows={3} className={input} disabled={q.readOnly} value={String(value ?? "")} onChange={(e) => set(q.key, e.target.value)} />
          ) : (
            <input
              id={id}
              type={type}
              className={input}
              disabled={q.readOnly || type === "file"}
              maxLength={q.maxLength}
              pattern={q.pattern}
              value={type === "file" ? undefined : String(value ?? "")}
              onChange={(e) => set(q.key, e.target.value)}
            />
          )}
        </label>
      );
    }
  }
}
