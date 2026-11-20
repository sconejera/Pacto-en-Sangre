import { memo, useEffect, useRef } from 'react';
import { getAnimationFrameIndex, SPRITE_MAP } from '../game/sprites';
import type { CharacterId } from '../game/types';
import { loadImage } from '../game/worldSprites';

interface AnimatedSpriteProps {
  charId: CharacterId;
  width?: number;
  height?: number;
}

export const CharacterIdlePreview = memo(function CharacterIdlePreview({
  charId,
  width = 120,
  height = 140,
}: AnimatedSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const map = SPRITE_MAP[charId];
    let timerId = 0;
    let alive = true;
    const start = performance.now();
    const cachedFrames: Record<number, HTMLCanvasElement> = {};
    let lastDrawnFrame = -1;

    const renderFrame = () => {
      if (!alive || document.hidden) return;
      const elapsed = (performance.now() - start) / 1000;
      const frameIdx = getAnimationFrameIndex(charId, 'idle', elapsed);
      if (frameIdx === lastDrawnFrame) return;
      const cached = cachedFrames[frameIdx];
      if (!cached) return;
      lastDrawnFrame = frameIdx;
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cached, 0, 0);
    };

    void loadImage(map.sheetSrc)
      .then((img) => {
        if (!alive) return;
        const idleIndices = map.animations.idle.frames;
        for (const idx of idleIndices) {
          if (cachedFrames[idx]) continue;
          const f = map.frames[idx] || map.frames[0];
          const off = document.createElement('canvas');
          off.width = width;
          off.height = height;
          const octx = off.getContext('2d');
          if (octx) {
            octx.imageSmoothingEnabled = false;
            const scale = Math.min((height - 12) / f.h, (width - 12) / f.w);
            const dw = Math.round(f.w * scale);
            const dh = Math.round(f.h * scale);
            const dx = Math.round(width / 2 - f.ax * scale);
            const dy = Math.round(height - 6 - f.ay * scale);
            octx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
            cachedFrames[idx] = off;
          }
        }
        renderFrame();
        timerId = window.setInterval(renderFrame, 220);
      })
      .catch(() => {});

    return () => {
      alive = false;
      if (timerId) clearInterval(timerId);
    };
  }, [charId, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pixel-canvas mx-auto block"
      aria-label={`Sprite animado de ${charId}`}
    />
  );
});

export const CharacterPortraitCrop = memo(function CharacterPortraitCrop({
  charId,
  size = 48,
}: {
  charId: CharacterId;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const map = SPRITE_MAP[charId];
    let alive = true;
    void loadImage(map.sheetSrc)
      .then((img) => {
        if (!alive) return;
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        const c = map.portraitCrop;
        ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, size, size);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [charId, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="pixel-canvas block shrink-0 border-2 border-[#FFD23F] bg-[#1A0B2E]"
      aria-label={`Retrato de ${charId}`}
    />
  );
});
