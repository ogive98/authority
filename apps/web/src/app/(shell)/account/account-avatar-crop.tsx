"use client";

import { useEffect, useRef, useState } from "react";
import { AButton } from "@/components/a";

type Props = {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
};

const OUT = 512;

/** Contiental circle crop — canvas only, no extra deps (D158). */
export function AccountAvatarCrop({ file, onCancel, onCropped }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function exportCrop() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const view = 280;
    const scale =
      (Math.max(img.naturalWidth, img.naturalHeight) / view) / zoom;
    const srcSize = view * scale;
    const cx = img.naturalWidth / 2 - offset.x * scale;
    const cy = img.naturalHeight / 2 - offset.y * scale;
    const sx = Math.max(0, Math.min(img.naturalWidth - srcSize, cx - srcSize / 2));
    const sy = Math.max(
      0,
      Math.min(img.naturalHeight - srcSize, cy - srcSize / 2),
    );

    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUT, OUT);

    canvas.toBlob(
      (blob) => {
        if (blob) onCropped(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--a-z-modal,80)] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-[var(--a-radius-md)] bg-a-surface-1 p-5 shadow-[var(--a-shadow-panel)]">
        <h3 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
          Ajuster la photo
        </h3>
        <div
          className="relative mx-auto h-[280px] w-[280px] cursor-grab overflow-hidden rounded-full bg-a-surface-3 active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              ox: offset.x,
              oy: offset.y,
            };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset({
              x: drag.current.ox + (e.clientX - drag.current.x),
              y: drag.current.oy + (e.clientY - drag.current.y),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            />
          ) : null}
        </div>
        <label className="block text-[length:var(--a-text-xs)] text-a-fg-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--a-accent)]"
          />
        </label>
        <div className="flex justify-end gap-2">
          <AButton type="button" size="sm" variant="ghost" onClick={onCancel}>
            Annuler
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={exportCrop}
          >
            Utiliser
          </AButton>
        </div>
      </div>
    </div>
  );
}
