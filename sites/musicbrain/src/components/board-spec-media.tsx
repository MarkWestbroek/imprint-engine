"use client";

import { useState } from "react";
import type { DerivedBoardConfig } from "@imprint/content-core";
import { BoardCanvas } from "@/widgets/board-canvas";

/**
 * The board render, hybrid (Mark's idea): the rich static overview by default,
 * and — only when the spec carries hotspot points — a toggle to an interactive
 * hover view. No points = just the overview, no toggle.
 */
export function BoardSpecMedia({
  overview,
  board,
}: {
  overview?: string;
  board: DerivedBoardConfig;
}) {
  const hasHotspots = board.image !== "" && board.points.length > 0;
  const [interactive, setInteractive] = useState(false);

  if (!hasHotspots) {
    return overview ? <StaticImage src={overview} /> : null;
  }

  return (
    <div>
      <div className="mb-2 flex gap-1 text-xs">
        <Toggle active={!interactive} onClick={() => setInteractive(false)}>
          Overview
        </Toggle>
        <Toggle active={interactive} onClick={() => setInteractive(true)}>
          Interactive
        </Toggle>
      </div>
      {interactive ? (
        <BoardCanvas
          image={board.image}
          alt={board.alt}
          points={board.points}
          mode="hover"
        />
      ) : overview ? (
        <StaticImage src={overview} />
      ) : (
        <BoardCanvas image={board.image} alt={board.alt} points={board.points} mode="hover" />
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
