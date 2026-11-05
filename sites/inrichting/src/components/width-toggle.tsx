"use client";

import { useState, useSyncExternalStore } from "react";
import { MoveHorizontal } from "lucide-react";

/**
 * The page width: normal (1200px), wide (1600px) or the whole screen. Wide
 * tables (a form, the results of a version) need room on a big monitor, but
 * not every monitor is big. Sets `data-breedte` on <html> and remembers the
 * choice; `WidthInit` applies it before paint, so the page does not jump.
 */

const KEY = "inrichting-breedte";
const STEPS = [
  { value: "normaal", label: "Normale breedte" },
  { value: "breed", label: "Breed" },
  { value: "vol", label: "Volledige breedte" },
] as const;
type Breedte = (typeof STEPS)[number]["value"];

const subscribeNoop = () => () => {};

export function WidthInit() {
  const js =
    `try{var b=localStorage.getItem('${KEY}');` +
    "if(b)document.documentElement.setAttribute('data-breedte',b);}catch(e){}";
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export function WidthToggle() {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [current, setCurrent] = useState<Breedte | null>(null);
  if (!mounted) return null;
  const now = current ?? ((document.documentElement.getAttribute("data-breedte") as Breedte | null) || "normaal");
  const index = STEPS.findIndex((s) => s.value === now);
  const next = STEPS[(index + 1) % STEPS.length]!;
  const label = STEPS[index]?.label ?? STEPS[0].label;

  const apply = () => {
    document.documentElement.setAttribute("data-breedte", next.value);
    setCurrent(next.value);
    try {
      localStorage.setItem(KEY, next.value);
    } catch {
      /* private mode etc.: the switch still works on this page */
    }
  };

  return (
    <button type="button" className="ir-icon-button" onClick={apply} aria-label={`Breedte: ${label}. Wissel naar ${next.label.toLowerCase()}`} title={`Breedte: ${label} → ${next.label.toLowerCase()}`}>
      <MoveHorizontal size={20} aria-hidden />
      <span className="ir-icon-label">{label}</span>
    </button>
  );
}
