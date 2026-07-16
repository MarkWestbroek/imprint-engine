"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImageItem } from "./registry";

/**
 * Client islands for the photo widgets: a gallery grid with a lightbox, and
 * a carousel. The server shells in components.tsx assemble the image lists
 * (config + subject media + external albums) and hand them here.
 */

/* eslint-disable @next/next/no-img-element -- arbitrary content/asset URLs */

export function Gallery({
  images,
  columns = 3,
}: {
  images: ImageItem[];
  columns?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative overflow-hidden rounded-lg border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={img.caption ?? img.alt}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="aspect-square h-full w-full object-cover transition group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      {open !== null && (
        <Lightbox images={images} index={open} onIndex={setOpen} />
      )}
    </>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
}: {
  images: ImageItem[];
  index: number;
  onIndex: (i: number | null) => void;
}) {
  const step = useCallback(
    (delta: number) => onIndex((index + delta + images.length) % images.length),
    [index, images.length, onIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onIndex, step]);

  const img = images[index];
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-6"
      onClick={() => onIndex(null)}
      role="dialog"
      aria-modal="true"
    >
      <img
        src={img.src}
        alt={img.alt}
        className="max-h-[80vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {(img.caption ?? img.alt) && (
        <p className="mt-3 text-sm text-white/80">{img.caption ?? img.alt}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-sm text-white/80">
        <LbBtn label="←" onClick={(e) => { e.stopPropagation(); step(-1); }} />
        <span>
          {index + 1} / {images.length}
        </span>
        <LbBtn label="→" onClick={(e) => { e.stopPropagation(); step(1); }} />
        <LbBtn label="✕" onClick={(e) => { e.stopPropagation(); onIndex(null); }} />
      </div>
    </div>
  );
}

function LbBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-white/30 px-3 py-1 hover:border-white hover:text-white"
    >
      {label}
    </button>
  );
}

export function Carousel({
  images,
  interval = 0,
}: {
  images: ImageItem[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = images.length;

  useEffect(() => {
    if (interval <= 0 || paused || count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), interval * 1000);
    return () => clearInterval(t);
  }, [interval, paused, count]);

  if (count === 0) return null;
  const img = images[index];

  return (
    <figure
      className="relative overflow-hidden rounded-lg border border-line"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* object-contain: show the whole photo (letterboxed), never crop it. */}
      <img
        src={img.src}
        alt={img.alt}
        className="aspect-video w-full bg-black/40 object-contain"
      />
      {(img.caption ?? img.alt) && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-sm text-white">
          {img.caption ?? img.alt}
        </figcaption>
      )}
      {count > 1 && (
        <>
          <CarouselBtn side="left" onClick={() => setIndex((index - 1 + count) % count)} />
          <CarouselBtn side="right" onClick={() => setIndex((index + 1) % count)} />
          <div className="absolute inset-x-0 top-2 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 w-4 rounded-full transition ${
                  i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </figure>
  );
}

function CarouselBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2.5 py-1.5 text-white hover:bg-black/70 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {side === "left" ? "←" : "→"}
    </button>
  );
}
