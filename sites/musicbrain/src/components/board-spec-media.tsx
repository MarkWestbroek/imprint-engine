"use client";

import { useState } from "react";
import type { DerivedBoardConfig } from "@imprint/content-core";
import { BoardCanvas } from "@/widgets/board-canvas";
import { Model3D } from "@/components/model-3d";

/**
 * The board render, hybrid (Mark's idea): the rich static overview by default,
 * a toggle to an interactive hover view when the spec carries hotspot points,
 * and a "3D" view when the spec ships a GLB model (MMB-request 3D-tab). The
 * GLB only loads when the 3D view is first activated. No points and no model
 * = just the overview, no toggles.
 */

type View = "overview" | "interactive" | "3d";

export function BoardSpecMedia({
  overview,
  board,
  model3d,
}: {
  overview?: string;
  board: DerivedBoardConfig;
  model3d?: { src: string; poster?: string; alt: string };
}) {
  const hasHotspots = board.image !== "" && board.points.length > 0;
  const [view, setView] = useState<View>("overview");

  const views: { id: View; label: string }[] = [{ id: "overview", label: "Overview" }];
  if (hasHotspots) views.push({ id: "interactive", label: "Interactive" });
  if (model3d) views.push({ id: "3d", label: "3D" });

  const staticView = overview ? (
    <StaticImage src={overview} />
  ) : hasHotspots ? (
    <BoardCanvas image={board.image} alt={board.alt} points={board.points} mode="hover" />
  ) : board.image ? (
    <StaticImage src={board.image} />
  ) : null;

  if (views.length === 1) return staticView;

  return (
    <div>
      <div className="mb-2 flex gap-1 text-xs">
        {views.map((v) => (
          <Toggle key={v.id} active={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </Toggle>
        ))}
      </div>
      {view === "3d" && model3d ? (
        <Model3D src={model3d.src} poster={model3d.poster} alt={model3d.alt} />
      ) : view === "interactive" && hasHotspots ? (
        <BoardCanvas image={board.image} alt={board.alt} points={board.points} mode="hover" />
      ) : (
        staticView
      )}
    </div>
  );
}

function StaticImage({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- stored render (SVG/PNG)
  return <img src={src} alt="Board overview" className="h-auto max-w-full rounded-lg" />;
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 ${
        active ? "bg-accent text-background" : "border border-line text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
