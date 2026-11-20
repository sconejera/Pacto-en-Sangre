import { memo, useEffect, useRef, useState } from 'react';
import { computeTitleFireBeatMotion } from '../game/rules';
import type { EnemyType, SpriteFrameBox } from '../game/types';
import {
  BOSS_SPRITE_SPECS,
  ENEMY_SPRITE_SPECS,
  floodFillRemoveBackgroundRgba,
  HERO_PORTRAIT_PATHS,
  loadImage,
} from '../game/worldSprites';

type CastRole = 'enemy' | 'overlord' | 'boss' | 'hero';

interface CastSlot {
  id: string;
  src: string;
  alt: string;
  role: CastRole;
  className: string;
  preserveAlpha?: boolean;
  extraHoleSeeds?: readonly [number, number][];
  sourceFrame?: SpriteFrameBox;
  /** Normalized height fraction (0..1) where the waist begins for Layer-4 enemy fade/blur */
  waistFrac?: number;
  /** Flip sprite horizontally for symmetric title framing */
  flipX?: boolean;
}

function enemySlot(
  id: EnemyType,
  alt: string,
  className: string,
  waistFrac = 0.54,
  flipX = false
): CastSlot {
  const spec = ENEMY_SPRITE_SPECS[id];
  return {
    id: `enemy-${id}`,
    src: spec.src,
    alt,
    role: 'enemy',
    className,
    preserveAlpha: spec.preserveAlpha,
    extraHoleSeeds: spec.extraHoleSeeds,
    sourceFrame: spec.sourceFrame,
    waistFrac,
    flipX,
  };
}

const CAST_SLOTS: readonly CastSlot[] = [
  // Layer 4 (Farthest back): All 7 level enemies aligned at head height behind Layer 2 bosses & flanking Boss 5,
  // normalized so head/torso proportions appear uniform, clear waist-up (~5% softer than Layer 2) with full bottom fade.
  enemySlot(
    'canero',
    'Papi Micky Zombie',
    'left-1/2 top-[26.5vh] z-[8] h-[27.5vh] max-h-[255px] -translate-x-[calc(50%+min(44vw,65vh))] opacity-[0.92]',
    0.49
  ),
  enemySlot(
    'chupetona',
    'Tronco Oficinista',
    'left-1/2 top-[26.5vh] z-[8] h-[27.5vh] max-h-[255px] -translate-x-[calc(50%+min(35vw,51vh))] opacity-[0.92]',
    0.49
  ),
  enemySlot(
    'zombie',
    'Zombie del Pantano',
    'left-1/2 top-[26.5vh] z-[9] h-[47vh] max-h-[440px] -translate-x-[calc(50%+min(26vw,38vh))] opacity-[0.92]',
    0.41
  ),
  enemySlot(
    'domestico',
    'Tronco Renacentista',
    'left-1/2 top-[26.5vh] z-[9] h-[28vh] max-h-[260px] -translate-x-[calc(50%+min(17.5vw,25vh))] opacity-[0.92]',
    0.49
  ),
  enemySlot(
    'cachorro',
    'Cachorro',
    'left-1/2 top-[26.5vh] z-[9] h-[48vh] max-h-[450px] -translate-x-[calc(50%-min(18.5vw,26.5vh))] opacity-[0.92]',
    0.41
  ),
  enemySlot(
    'fan',
    'Tio Rene Zombie',
    'left-1/2 top-[26.5vh] z-[9] h-[27vh] max-h-[250px] -translate-x-[calc(50%-min(30vw,43.5vh))] opacity-[0.92]',
    0.49,
    true
  ),
  enemySlot(
    'manager',
    'Tronco Manager',
    'left-1/2 top-[26.5vh] z-[9] h-[48vh] max-h-[450px] -translate-x-[calc(50%-min(43.5vw,63vh))] opacity-[0.92]',
    0.40
  ),

  // Layer 3: Stage 5 Final Boss looming huge behind the 4 stage bosses
  {
    id: 'boss5',
    src: BOSS_SPRITE_SPECS[5].src,
    alt: 'Discográfica Internacional',
    role: 'overlord',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[11vh] z-[11] h-[72vh] max-h-[670px] -translate-x-1/2 [filter:drop-shadow(0_0_30px_rgba(220,38,38,0.82))_drop-shadow(0_10px_24px_rgba(0,0,0,0.98))]',
  },

  // Layer 2: 4 Stage Bosses in front of Boss 5 and enemies, emerging from the shadows
  {
    id: 'boss1',
    src: BOSS_SPRITE_SPECS[1].src,
    alt: 'Tronco',
    role: 'boss',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[14.5vh] z-[12] h-[46vh] max-h-[435px] -translate-x-[calc(50%+min(36vw,54vh))] [filter:drop-shadow(0_0_16px_rgba(220,38,38,0.52))_drop-shadow(0_8px_18px_rgba(0,0,0,0.95))]',
  },
  {
    id: 'boss2',
    src: BOSS_SPRITE_SPECS[2].src,
    alt: 'Payola',
    role: 'boss',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[22vh] z-[13] h-[44vh] max-h-[415px] -translate-x-[calc(50%+min(22vw,33vh))] [filter:drop-shadow(0_0_16px_rgba(220,38,38,0.52))_drop-shadow(0_8px_18px_rgba(0,0,0,0.95))]',
  },
  {
    id: 'boss3',
    src: BOSS_SPRITE_SPECS[3].src,
    alt: 'Ivan Martinez',
    role: 'boss',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[22vh] z-[13] h-[45vh] max-h-[425px] -translate-x-[calc(50%-min(22vw,33vh))] [filter:drop-shadow(0_0_16px_rgba(220,38,38,0.52))_drop-shadow(0_8px_18px_rgba(0,0,0,0.95))]',
  },
  {
    id: 'boss4',
    src: BOSS_SPRITE_SPECS[4].src,
    alt: 'El JC Que Le Dicen',
    role: 'boss',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[14.5vh] z-[12] h-[46vh] max-h-[435px] -translate-x-[calc(50%-min(36vw,54vh))] [filter:drop-shadow(0_0_16px_rgba(220,38,38,0.52))_drop-shadow(0_8px_18px_rgba(0,0,0,0.95))]',
  },

  // Layer 1 (Foreground): 3 Main Playable Heroes raised cleanly above the menu dock
  {
    id: 'bayron',
    src: HERO_PORTRAIT_PATHS.bayron,
    alt: 'Bayron Fire',
    role: 'hero',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[10.5vh] z-[15] h-[51vh] max-h-[485px] -translate-x-[calc(50%+min(17vw,22.5vh))] [filter:drop-shadow(0_0_14px_rgba(245,158,11,0.4))_drop-shadow(0_10px_14px_rgba(5,7,13,0.96))]',
  },
  {
    id: 'crismj',
    src: HERO_PORTRAIT_PATHS.crismj,
    alt: 'Cris MJ',
    role: 'hero',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[10.5vh] z-[15] h-[52vh] max-h-[495px] -translate-x-[calc(50%-min(17vw,22.5vh))] [filter:drop-shadow(0_0_14px_rgba(25,227,255,0.4))_drop-shadow(0_10px_14px_rgba(5,7,13,0.96))]',
  },
  {
    id: 'marcianeke',
    src: HERO_PORTRAIT_PATHS.marcianeke,
    alt: 'Marcianeke',
    role: 'hero',
    preserveAlpha: true,
    className:
      'left-1/2 bottom-[10vh] z-[16] h-[55vh] max-h-[520px] -translate-x-1/2 [filter:drop-shadow(0_0_18px_rgba(232,59,255,0.46))_drop-shadow(0_12px_16px_rgba(5,7,13,0.98))]',
  },
];

let cachedCutoutsPromise: Promise<Record<string, string>> | null = null;

async function bakeCastCutout(img: HTMLImageElement, slot: CastSlot): Promise<string> {
  const srcX = slot.sourceFrame ? slot.sourceFrame.x : 0;
  const srcY = slot.sourceFrame ? slot.sourceFrame.y : 0;
  const natW = slot.sourceFrame ? slot.sourceFrame.w : img.naturalWidth || 400;
  const natH = slot.sourceFrame ? slot.sourceFrame.h : img.naturalHeight || 600;
  const maxWorkH = slot.role === 'overlord' ? 760 : slot.role === 'enemy' ? 380 : 620;
  const scale = Math.min(1, maxWorkH / natH);
  const workW = Math.max(1, Math.round(natW * scale));
  const workH = Math.max(1, Math.round(natH * scale));

  const work = document.createElement('canvas');
  work.width = workW;
  work.height = workH;
  const wctx = work.getContext('2d');
  if (!wctx) return img.src;
  wctx.imageSmoothingEnabled = false;
  wctx.drawImage(img, srcX, srcY, natW, natH, 0, 0, workW, workH);

  const imgData = wctx.getImageData(0, 0, workW, workH);
  const data = imgData.data;

  // Strip white background on opaque enemy JPGs via existing BFS flood-fill keyer
  if (!slot.preserveAlpha) {
    floodFillRemoveBackgroundRgba(data, workW, workH, slot.extraHoleSeeds ?? []);
  }

  // Strip near-zero alpha noise and locate exact tight opaque bounding box
  let minX = workW;
  let minY = workH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < workH; y++) {
    for (let x = 0; x < workW; x++) {
      const off = (y * workW + x) * 4;
      const a = data[off + 3];
      if (a <= 12) {
        data[off + 3] = 0;
        continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return img.src;
  }

  // Grade bosses and distant enemies into atmospheric dark night shadows
  if (slot.role === 'overlord' || slot.role === 'boss' || slot.role === 'enemy') {
    const bgR = slot.role === 'overlord' ? 14 : slot.role === 'enemy' ? 10 : 9;
    const bgG = slot.role === 'overlord' ? 2 : slot.role === 'enemy' ? 6 : 7;
    const bgB = slot.role === 'overlord' ? 8 : slot.role === 'enemy' ? 15 : 16;
    const keepRatio = slot.role === 'overlord' ? 0.28 : slot.role === 'enemy' ? 0.29 : 0.34;
    const mixRatio = 1 - keepRatio;
    const shadeStart = slot.role === 'enemy' ? (slot.waistFrac ?? 0.45) : 0.45;

    for (let y = minY; y <= maxY; y++) {
      const rowNorm = (y - minY) / Math.max(1, maxY - minY);
      const shadeSpan = Math.max(0.01, 1 - shadeStart);
      const heightShade =
        rowNorm > shadeStart
          ? Math.max(0.14, 1 - ((rowNorm - shadeStart) / shadeSpan) * (slot.role === 'enemy' ? 0.86 : 0.42))
          : 1;
      for (let x = minX; x <= maxX; x++) {
        const off = (y * workW + x) * 4;
        if (data[off + 3] === 0) continue;
        const r = data[off];
        const g = data[off + 1];
        const b = data[off + 2];
        const isCrimsonAccent =
          slot.role === 'overlord' && r > 155 && r > g * 1.55 && r > b * 1.55;
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const highlightBoost = isCrimsonAccent ? 1.55 : lum > 165 ? 1.15 : 1;
        data[off] = Math.min(
          255,
          Math.round((r * keepRatio * highlightBoost + bgR * mixRatio) * heightShade)
        );
        data[off + 1] = Math.min(
          255,
          Math.round(
            (g * keepRatio * (isCrimsonAccent ? 0.85 : highlightBoost) + bgG * mixRatio) *
              heightShade
          )
        );
        data[off + 2] = Math.min(
          255,
          Math.round(
            (b * keepRatio * (isCrimsonAccent ? 0.85 : highlightBoost) + bgB * mixRatio) *
              heightShade
          )
        );
      }
    }
  }

  wctx.putImageData(imgData, 0, 0);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const blurPad = slot.role === 'enemy' ? 4 : 0;
  const outW = cw + blurPad * 2;
  const outH = ch + blurPad * 2;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d');
  if (!octx) return img.src;
  if (slot.role === 'enemy') {
    // Upper body (waist up): ~5% softer than Layer 2 bosses so silhouettes read crisply
    octx.imageSmoothingEnabled = true;
    octx.filter = 'blur(0.95px)';
    if (slot.flipX) {
      octx.save();
      octx.translate(outW, 0);
      octx.scale(-1, 1);
    }
    octx.drawImage(work, minX, minY, cw, ch, blurPad, blurPad, cw, ch);
    if (slot.flipX) {
      octx.restore();
    }
    octx.filter = 'none';

    // Lower body (from waist down): progressive soft blur dissolve
    const softBottom = document.createElement('canvas');
    softBottom.width = outW;
    softBottom.height = outH;
    const sbCtx = softBottom.getContext('2d');
    if (sbCtx) {
      sbCtx.imageSmoothingEnabled = true;
      sbCtx.filter = 'blur(4.2px)';
      if (slot.flipX) {
        sbCtx.save();
        sbCtx.translate(outW, 0);
        sbCtx.scale(-1, 1);
      }
      sbCtx.drawImage(work, minX, minY, cw, ch, blurPad, blurPad, cw, ch);
      if (slot.flipX) {
        sbCtx.restore();
      }
      sbCtx.filter = 'none';
      sbCtx.globalCompositeOperation = 'destination-in';
      const waistY = outH * Math.max(0.32, (slot.waistFrac ?? 0.45) - 0.05);
      const blurGrad = sbCtx.createLinearGradient(0, waistY, 0, outH * 0.85);
      blurGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      blurGrad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
      sbCtx.fillStyle = blurGrad;
      sbCtx.fillRect(0, 0, outW, outH);
      octx.drawImage(softBottom, 0, 0);
    }
  } else {
    octx.imageSmoothingEnabled = false;
    if (slot.flipX) {
      octx.save();
      octx.translate(outW, 0);
      octx.scale(-1, 1);
    }
    octx.drawImage(work, minX, minY, cw, ch, 0, 0, cw, ch);
    if (slot.flipX) {
      octx.restore();
    }
  }

  // Smooth bottom mist fade so distant enemies & bosses dissolve cleanly into the alley darkness
  octx.save();
  octx.globalCompositeOperation = 'destination-in';
  const fadeStart =
    slot.role === 'enemy'
      ? Math.max(0.32, (slot.waistFrac ?? 0.45) - 0.05)
      : slot.role === 'overlord'
        ? 0.62
        : slot.role === 'boss'
          ? 0.68
          : 0.92;
  const grad = octx.createLinearGradient(0, outH * fadeStart, 0, outH);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  if (slot.role === 'enemy') {
    grad.addColorStop(0.32, 'rgba(255, 255, 255, 0.58)');
    grad.addColorStop(0.62, 'rgba(255, 255, 255, 0.16)');
    grad.addColorStop(0.84, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  } else {
    grad.addColorStop(
      0.72,
      slot.role === 'hero' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.34)'
    );
    grad.addColorStop(
      1,
      slot.role === 'hero' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.02)'
    );
  }
  octx.fillStyle = grad;
  octx.fillRect(0, 0, outW, outH);
  octx.restore();

  if (slot.role === 'hero') {
    octx.save();
    octx.globalCompositeOperation = 'source-atop';
    const fireBounce = octx.createLinearGradient(0, outH * 0.72, 0, outH);
    fireBounce.addColorStop(0, 'rgba(249, 115, 22, 0)');
    fireBounce.addColorStop(1, 'rgba(249, 115, 22, 0.28)');
    octx.fillStyle = fireBounce;
    octx.fillRect(0, 0, outW, outH);
    octx.restore();
  }

  return new Promise<string>((resolve) => {
    if (typeof out.toBlob === 'function') {
      out.toBlob(
        (blob) => resolve(blob ? URL.createObjectURL(blob) : out.toDataURL('image/png')),
        'image/png'
      );
    } else {
      resolve(out.toDataURL('image/png'));
    }
  });
}

function loadAllCutouts(): Promise<Record<string, string>> {
  if (!cachedCutoutsPromise) {
    cachedCutoutsPromise = Promise.all(
      CAST_SLOTS.map(async (slot) => {
        try {
          const img = await loadImage(slot.src);
          return [slot.id, await bakeCastCutout(img, slot)] as const;
        } catch {
          return [slot.id, slot.src] as const;
        }
      })
    ).then((entries) => Object.fromEntries(entries));
  }
  return cachedCutoutsPromise;
}

function hashSeed(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

let cachedTitleGlowStrip: HTMLCanvasElement | null = null;

function getTitleGlowStrip(): HTMLCanvasElement | null {
  if (cachedTitleGlowStrip) return cachedTitleGlowStrip;
  if (typeof document === 'undefined') return null;
  const strip = document.createElement('canvas');
  strip.width = 1;
  strip.height = 256;
  const gctx = strip.getContext('2d');
  if (!gctx) return null;
  const grad = gctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(220, 38, 38, 0)');
  grad.addColorStop(0.42, 'rgba(193, 18, 31, 0.22)');
  grad.addColorStop(0.76, 'rgba(249, 115, 22, 0.44)');
  grad.addColorStop(1, 'rgba(255, 210, 63, 0.58)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 1, 256);
  cachedTitleGlowStrip = strip;
  return strip;
}

const MAX_FIRE_COLS = 320; // 1280 / 4px step
const colOuterH = new Int16Array(MAX_FIRE_COLS);
const colMidH = new Int16Array(MAX_FIRE_COLS);
const colCoreH = new Int16Array(MAX_FIRE_COLS);
const colStepX = new Int16Array(MAX_FIRE_COLS);
const colStepH = new Int16Array(MAX_FIRE_COLS);
const colTipX = new Int16Array(MAX_FIRE_COLS);
const colTipH = new Int16Array(MAX_FIRE_COLS);

const NOOP_BEAT = () => 0;

const TitleFireTrails = memo(function TitleFireTrails({
  reduceEffects,
  getBeatLevel,
}: {
  reduceEffects: boolean;
  getBeatLevel: () => number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beatGetterRef = useRef(getBeatLevel);
  beatGetterRef.current = getBeatLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const LOGICAL_H = 540;
    let logicalW = 960;
    let rafId = 0;
    let lastNow = performance.now();
    let flamePhase = 0;

    const draw = (now: number) => {
      if (document.hidden && !reduceEffects) {
        lastNow = now;
        rafId = requestAnimationFrame(draw);
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      const timeSec = now / 1000;
      const beat = reduceEffects ? 0 : Math.max(0, Math.min(1, beatGetterRef.current()));
      const motion = computeTitleFireBeatMotion(beat, timeSec, reduceEffects);

      if (!reduceEffects) {
        flamePhase += dt * motion.flickerBoost;
      }

      const t = reduceEffects ? 0 : flamePhase;
      const w = logicalW;
      const h = LOGICAL_H;

      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      // Ambient magma glow reaching uniformly up to Layer 1 hero waist height
      const glowH = Math.round(195 * (0.95 + beat * 0.14));
      const glowStrip = getTitleGlowStrip();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (glowStrip) {
        ctx.globalAlpha = motion.glowAlpha;
        ctx.drawImage(glowStrip, 0, h - glowH, w, glowH);
      }

      const px = 4;
      const baseLineY = h - 22 + motion.vibY;
      const vibOffsetX = Math.round(motion.vibX * 0.5);

      // Continuous molten rim across street floor
      ctx.globalAlpha = 0.5 * motion.glowAlpha;
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(0, baseLineY - 22, w, 46);
      ctx.globalAlpha = 0.6 * motion.glowAlpha;
      ctx.fillStyle = '#F97316';
      ctx.fillRect(0, baseLineY - 12, w, 36);

      // Precompute column heights once, then draw in 5 batched fillStyle/globalAlpha passes
      const colCount = Math.min(MAX_FIRE_COLS, Math.ceil(w / px));
      const heightScale = motion.heightScale;
      const swayAmp = 2.5 + beat * 3.5;

      for (let i = 0; i < colCount; i++) {
        const x = i * px;
        const swell = (Math.sin(x * 0.02 + t * 3.2) + 1) * 0.5;
        const plumeSin = Math.sin(x * 0.036 - t * 4.2 + Math.cos(x * 0.015 + t * 2.0));
        const plumeWave = plumeSin > 0 ? Math.pow(plumeSin, 1.85) : 0;
        const lickASin = Math.sin(x * 0.068 - t * 6.4 + swell * 1.9);
        const lickA = lickASin > 0 ? Math.pow(lickASin, 2.2) : 0;
        const lickBCos = Math.cos(x * 0.125 + t * 8.6);
        const lickB = lickBCos > 0 ? Math.pow(lickBCos, 2.5) * 0.8 : 0;

        const baseOuterH = Math.round((64 + swell * 22 + plumeWave * 20 + (lickA + lickB) * 18) * heightScale);
        colOuterH[i] = baseOuterH;
        colMidH[i] = Math.round((42 + swell * 14 + plumeWave * 14 + (lickA * 0.8 + lickB * 0.65) * 14) * heightScale);
        colCoreH[i] = Math.round((18 + swell * 10 + plumeWave * 8 + lickA * 10) * heightScale);

        const tongueReach = plumeWave > lickA ? plumeWave : lickA;
        if (tongueReach > 0.34) {
          const sway = Math.round(Math.sin(t * 7.2 + x * 0.04) * swayAmp) + motion.vibX;
          const stepH = Math.round(baseOuterH + tongueReach * 18 * heightScale);
          colStepX[i] = x + vibOffsetX + Math.round(sway * 0.45);
          colStepH[i] = stepH;
          if (tongueReach > 0.58) {
            colTipX[i] = x + vibOffsetX + Math.round(sway * 0.85);
            colTipH[i] = Math.round(stepH + (tongueReach - 0.48) * 14 * heightScale);
          } else {
            colTipH[i] = -1;
          }
        } else {
          colStepH[i] = -1;
          colTipH[i] = -1;
        }
      }

      // Pass 1: Outer crimson flame body
      ctx.globalAlpha = 0.46 * motion.glowAlpha;
      ctx.fillStyle = '#DC2626';
      for (let i = 0; i < colCount; i++) {
        const ch = colOuterH[i];
        ctx.fillRect(i * px + vibOffsetX, baseLineY - ch, px, ch + 24);
      }

      // Pass 2: Connected mid-height stepped tongues
      ctx.globalAlpha = 0.38 * motion.glowAlpha;
      ctx.fillStyle = '#EF4444';
      for (let i = 0; i < colCount; i++) {
        const stepH = colStepH[i];
        if (stepH > 0) {
          ctx.fillRect(colStepX[i], baseLineY - stepH, px, stepH - colOuterH[i] + 10);
        }
      }

      // Pass 3: Tapered sharp pixel tips + mid bright orange flame layer
      ctx.globalAlpha = 0.44 * motion.glowAlpha;
      ctx.fillStyle = '#F97316';
      for (let i = 0; i < colCount; i++) {
        const tipH = colTipH[i];
        if (tipH > 0) {
          ctx.fillRect(colTipX[i], baseLineY - tipH, 3, tipH - colStepH[i] + 8);
        }
      }

      ctx.globalAlpha = 0.64 * motion.glowAlpha;
      for (let i = 0; i < colCount; i++) {
        const ch = colMidH[i];
        ctx.fillRect(i * px + vibOffsetX, baseLineY - ch, px, ch + 24);
      }

      // Pass 4: Hot gold core along bottom horizon
      ctx.globalAlpha = 0.78 * motion.glowAlpha;
      ctx.fillStyle = '#FFD23F';
      for (let i = 0; i < colCount; i++) {
        const ch = colCoreH[i];
        ctx.fillRect(i * px + vibOffsetX, baseLineY - ch, px, ch + 24);
      }

      // Sweeping diagonal pixel-art fire trails ("estelas de fuego") peaking uniformly at waist height
      const trailCount = 12;
      const steps = 18;
      for (let k = 0; k < trailCount; k++) {
        const originX = ((k + 0.5) / trailCount) * w + Math.sin(t * 2.1 + k * 1.9) * 14;
        const trailLen = Math.round((78 + (k % 3) * 16) * heightScale);
        for (let s = 0; s < steps; s++) {
          const frac = s / (steps - 1);
          const riseY = baseLineY - 26 - frac * trailLen;
          const curveX =
            originX +
            Math.sin(t * 5.2 + k * 2.1 - frac * 3.8) * (9 + frac * 12 + beat * 6) +
            motion.vibX;
          const blockSize = frac < 0.35 ? 4 : frac < 0.72 ? 3 : 2;
          ctx.globalAlpha = (1 - frac) * 0.42 * motion.glowAlpha;
          ctx.fillStyle = frac < 0.28 ? '#FFD23F' : frac < 0.65 ? '#F97316' : '#EF4444';
          ctx.fillRect(Math.round(curveX), Math.round(riseY), blockSize, blockSize + 1);
        }
      }

      // Rising fiery sparks & ember flecks vibrating on beat
      if (!reduceEffects) {
        const sparkCount = 38;
        const fastAlpha = 0.76 + beat * 0.24;
        const midAlpha = 0.72 + beat * 0.25;
        const lowAlpha = 0.68 + beat * 0.25;
        for (let i = 0; i < sparkCount; i++) {
          const baseX = hashSeed(i * 23.7) * w;
          const wobble = Math.sin(t * 2.8 + i * 1.3) * (12 + beat * 6) + motion.vibX;
          const ex = ((baseX + wobble) % w + w) % w;
          const speed = (i < 24 ? 64 + (i % 5) * 18 : 42 + (i % 4) * 12) * (1 + beat * 0.3);
          const maxRise = i < 24 ? 190 : 235;
          const ey = h - 18 - ((t * speed + i * 37) % maxRise) + motion.vibY;
          const size = i < 20 ? 4 : 3;
          if (i % 3 === 0) {
            ctx.fillStyle = '#FEF08A';
            ctx.globalAlpha = fastAlpha;
          } else if (i % 2 === 0) {
            ctx.fillStyle = '#F97316';
            ctx.globalAlpha = midAlpha;
          } else {
            ctx.fillStyle = '#DC2626';
            ctx.globalAlpha = lowAlpha;
          }
          ctx.fillRect(Math.round(ex), Math.round(ey), size, size);
        }
      }

      ctx.restore();
      if (!reduceEffects) {
        rafId = requestAnimationFrame(draw);
      }
    };

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 16 / 9;
      logicalW = Math.max(320, Math.min(1280, Math.round(LOGICAL_H * aspect)));
      if (canvas.width !== logicalW || canvas.height !== LOGICAL_H) {
        canvas.width = logicalW;
        canvas.height = LOGICAL_H;
      }
      if (reduceEffects) {
        draw(performance.now());
      }
    };
    syncCanvasSize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncCanvasSize) : null;
    ro?.observe(canvas);
    window.addEventListener('resize', syncCanvasSize);

    if (!reduceEffects) {
      rafId = requestAnimationFrame(draw);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, [reduceEffects]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="title-fire-trails"
      aria-hidden="true"
      className="pixel-canvas pointer-events-none absolute inset-0 z-[14] h-full w-full"
    />
  );
});

export const TitleCastBackdrop = memo(function TitleCastBackdrop({
  reduceEffects,
  getBeatLevel = NOOP_BEAT,
}: {
  reduceEffects: boolean;
  getBeatLevel?: () => number;
}) {
  const [cutouts, setCutouts] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let active = true;
    loadAllCutouts().then((result) => {
      if (active) setCutouts(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      data-testid="title-cast-backdrop"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none"
    >
      {/* Dramatic crimson shadow aura behind Stage 5 Boss & distant enemies */}
      <div
        className="absolute top-[10vh] left-1/2 z-[7] h-[64vh] w-[84vh] -translate-x-1/2 rounded-full opacity-75 blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(220, 38, 38, 0.42) 0%, rgba(127, 29, 29, 0.24) 48%, rgba(5, 7, 13, 0) 76%)',
        }}
      />

      {CAST_SLOTS.map((slot) => {
        const imgSrc = cutouts?.[slot.id];
        if (!imgSrc) return null;
        const motionClass = reduceEffects
          ? ''
          : slot.role === 'overlord'
            ? 'arcade-title-overlord-breathe'
            : slot.role === 'hero'
              ? 'arcade-title-hero-breathe'
              : '';
        return (
          <img
            key={slot.id}
            data-testid={`title-cast-${slot.id}`}
            src={imgSrc}
            alt=""
            className={`pixel-canvas absolute w-auto object-contain ${
              slot.role === 'enemy' ? 'object-top' : 'object-bottom'
            } will-change-transform ${slot.className} ${motionClass}`}
          />
        );
      })}

      {/* Dark street shadow scrim anchoring enemy & boss layers behind the enlarged fire trails */}
      <div
        className="absolute inset-x-0 bottom-0 z-[13] h-[24vh]"
        style={{
          background:
            'linear-gradient(180deg, rgba(5, 7, 13, 0) 0%, rgba(12, 4, 10, 0.56) 54%, rgba(5, 7, 13, 0.9) 100%)',
        }}
      />

      {/* Beat-reactive enlarged fire trails ABOVE all enemies & bosses, BEHIND Layer 1 heroes */}
      <TitleFireTrails reduceEffects={reduceEffects} getBeatLevel={getBeatLevel} />

      {/* Subtle lower rim wash right behind bottom menu dock & footer marquee */}
      <div
        className="absolute inset-x-0 bottom-0 z-[17] h-[11vh]"
        style={{
          background:
            'linear-gradient(180deg, rgba(5, 7, 13, 0) 0%, rgba(5, 7, 13, 0.65) 65%, rgba(5, 7, 13, 0.9) 100%)',
        }}
      />
    </div>
  );
});
