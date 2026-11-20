import type { CharacterId, CharacterSpriteMap, SpriteAnimName } from './types';

/**
 * SPRITE_MAP — Mapa de sprites analizado píxel a píxel de las hojas 4x4 (1254x1254 RGBA).
 * Cada hoja tiene 16 poses en rejilla 4x4:
 *   0: Idle 1 | 1: Idle 2 | 2: Walk 1 | 3: Walk 2
 *   4: Squat/Landing | 5: Jump | 6: Guard/Grab | 7: Forward Lean / Run
 *   8: Punch (Golpe 1) | 9: Knee (Golpe 2) | 10: High Kick (Golpe 3) | 11: Shout/Throw/Special
 *   12: Hurt (Daño) | 13: KO (Caído) | 14: Victory / Raise Fist | 15: Low/Air Kick (Patada aérea)
 * Punto de anclaje (ax, ay) en los PIES de cada frame para volteo horizontal limpio sin desplazamiento.
 */
export const SPRITE_MAP: Record<CharacterId, CharacterSpriteMap> = {
  bayron: {
    id: 'bayron',
    sheetSrc: '/assets/aistudio/SPRITES_BAYRON_FIRE_v2_55b0371d.png',
    portraitSrc: '/assets/aistudio/BAYRON_FIRE_ac622317.png',
    sheetWidth: 1254,
    sheetHeight: 1254,
    targetHeightPx: 132,
    // Primer frame de idle recortado (cabeza + chaqueta para HUD)
    portraitCrop: { x: 72, y: 7, w: 163, h: 145, ax: 81, ay: 145 },
    frames: [
      { x: 72, y: 7, w: 163, h: 296, ax: 80, ay: 296 },
      { x: 392, y: 1, w: 158, h: 302, ax: 78, ay: 302 },
      { x: 698, y: 3, w: 181, h: 300, ax: 87, ay: 300 },
      { x: 1029, y: 1, w: 145, h: 302, ax: 63, ay: 302 },
      { x: 80, y: 391, w: 172, h: 227, ax: 73, ay: 227 },
      { x: 398, y: 313, w: 143, h: 255, ax: 62, ay: 255 },
      { x: 711, y: 325, w: 162, h: 294, ax: 81, ay: 294 },
      { x: 984, y: 325, w: 205, h: 294, ax: 103, ay: 294 },
      { x: 35, y: 637, w: 277, h: 289, ax: 86, ay: 289 },
      { x: 396, y: 626, w: 146, h: 300, ax: 59, ay: 300 },
      { x: 643, y: 639, w: 282, h: 289, ax: 93, ay: 289 },
      { x: 976, y: 636, w: 250, h: 290, ax: 116, ay: 290 },
      { x: 36, y: 965, w: 230, h: 276, ax: 130, ay: 276 },
      { x: 323, y: 1078, w: 303, h: 154, ax: 241, ay: 154 },
      { x: 698, y: 938, w: 181, h: 303, ax: 95, ay: 303 },
      { x: 946, y: 1001, w: 276, h: 230, ax: 29, ay: 230 },
    ],
    animations: {
      idle: { frames: [0, 1], fps: 4, loop: true },
      walk: { frames: [2, 0, 3, 1], fps: 8.5, loop: true },
      run: {
        frames: [7, 2, 7, 3],
        fps: 12,
        loop: true,
        procedural: 'leanForward',
      },
      shoulder: {
        frames: [4, 7, 7, 11],
        fps: 12,
        loop: false,
        procedural: 'leanForward',
      },
      attack1: { frames: [7, 8, 8, 0], fps: 18, loop: false },
      attack2: { frames: [4, 9, 9, 7], fps: 18, loop: false },
      attack3: { frames: [7, 10, 10, 4], fps: 16, loop: false },
      airKick: { frames: [5, 15, 15, 4], fps: 16, loop: false },
      jump: { frames: [4, 5, 4], fps: 8, loop: false },
      hurt: { frames: [12, 4], fps: 10, loop: false },
      knockdown: { frames: [12, 13], fps: 10, loop: false },
      getup: { frames: [13, 4, 7, 0], fps: 14, loop: false },
      grab: { frames: [6, 11], fps: 8, loop: false },
      grabHold: { frames: [6], fps: 4, loop: true },
      grabKnee: { frames: [9, 6], fps: 12, loop: false },
      grabThrow: { frames: [11, 14], fps: 10, loop: false },
      special: {
        frames: [4, 14, 11, 14],
        fps: 10,
        loop: false,
        procedural: 'flashOrange',
      },
      guard: { frames: [6], fps: 4, loop: true },
      victory: { frames: [14, 1, 14, 0], fps: 4, loop: true },
    },
  },
  marcianeke: {
    id: 'marcianeke',
    sheetSrc: '/assets/aistudio/SPRITES_MARCIANEKE_v2_25f676f8.png',
    portraitSrc: '/assets/aistudio/MARCIANEKE_f29a32b8.png',
    sheetWidth: 1254,
    sheetHeight: 1254,
    targetHeightPx: 128,
    portraitCrop: { x: 66, y: 8, w: 192, h: 148, ax: 96, ay: 148 },
    frames: [
      { x: 66, y: 8, w: 192, h: 299, ax: 100, ay: 299 },
      { x: 388, y: 0, w: 192, h: 307, ax: 104, ay: 307 },
      { x: 688, y: 7, w: 208, h: 300, ax: 103, ay: 300 },
      { x: 1046, y: 4, w: 132, h: 303, ax: 82, ay: 303 },
      { x: 77, y: 393, w: 158, h: 230, ax: 77, ay: 230 },
      { x: 411, y: 308, w: 136, h: 251, ax: 60, ay: 251 },
      { x: 725, y: 316, w: 180, h: 307, ax: 91, ay: 307 },
      { x: 999, y: 319, w: 222, h: 304, ax: 113, ay: 304 },
      { x: 36, y: 633, w: 268, h: 296, ax: 97, ay: 296 },
      { x: 411, y: 624, w: 145, h: 307, ax: 73, ay: 307 },
      { x: 715, y: 633, w: 201, h: 296, ax: 66, ay: 296 },
      { x: 976, y: 633, w: 269, h: 297, ax: 129, ay: 297 },
      { x: 27, y: 941, w: 253, h: 290, ax: 155, ay: 290 },
      { x: 321, y: 1103, w: 306, h: 121, ax: 119, ay: 121 },
      { x: 724, y: 941, w: 181, h: 299, ax: 87, ay: 299 },
      { x: 969, y: 1015, w: 271, h: 205, ax: 73, ay: 205 },
    ],
    animations: {
      idle: { frames: [0, 1], fps: 4, loop: true },
      walk: { frames: [2, 0, 3, 1], fps: 8.5, loop: true },
      run: {
        frames: [7, 2, 7, 3],
        fps: 12,
        loop: true,
        procedural: 'leanForward',
      },
      shoulder: {
        frames: [4, 7, 7, 11],
        fps: 12,
        loop: false,
        procedural: 'leanForward',
      },
      attack1: { frames: [7, 8, 8, 0], fps: 18, loop: false },
      attack2: { frames: [4, 9, 9, 7], fps: 18, loop: false },
      attack3: { frames: [7, 10, 10, 4], fps: 16, loop: false },
      airKick: { frames: [5, 15, 15, 4], fps: 16, loop: false },
      jump: { frames: [4, 5, 4], fps: 8, loop: false },
      hurt: { frames: [12, 4], fps: 10, loop: false },
      knockdown: { frames: [12, 13], fps: 10, loop: false },
      getup: { frames: [13, 4, 7, 0], fps: 14, loop: false },
      grab: { frames: [6, 11], fps: 8, loop: false },
      grabHold: { frames: [6], fps: 4, loop: true },
      grabKnee: { frames: [9, 6], fps: 12, loop: false },
      grabThrow: { frames: [11, 14], fps: 10, loop: false },
      special: {
        frames: [4, 14, 11, 14],
        fps: 10,
        loop: false,
        procedural: 'flashCyan',
      },
      guard: { frames: [6], fps: 4, loop: true },
      victory: { frames: [14, 1, 14, 0], fps: 4, loop: true },
    },
  },
  crismj: {
    id: 'crismj',
    sheetSrc: '/assets/aistudio/SPRITES_CRIS_MJ_v2_d2cb9f60.png',
    portraitSrc: '/assets/aistudio/CRIS_MJ_669b7616.png',
    sheetWidth: 1254,
    sheetHeight: 1254,
    targetHeightPx: 128,
    portraitCrop: { x: 72, y: 7, w: 182, h: 150, ax: 91, ay: 150 },
    frames: [
      { x: 72, y: 7, w: 182, h: 302, ax: 97, ay: 302 },
      { x: 390, y: 3, w: 176, h: 304, ax: 91, ay: 304 },
      { x: 700, y: 7, w: 196, h: 302, ax: 97, ay: 302 },
      { x: 1035, y: 6, w: 146, h: 303, ax: 70, ay: 303 },
      { x: 73, y: 382, w: 185, h: 239, ax: 79, ay: 239 },
      { x: 393, y: 319, w: 158, h: 250, ax: 68, ay: 250 },
      { x: 715, y: 324, w: 187, h: 297, ax: 95, ay: 297 },
      { x: 988, y: 321, w: 219, h: 300, ax: 116, ay: 300 },
      { x: 16, y: 630, w: 293, h: 286, ax: 126, ay: 286 },
      { x: 392, y: 623, w: 157, h: 301, ax: 73, ay: 301 },
      { x: 658, y: 630, w: 275, h: 292, ax: 89, ay: 292 },
      { x: 971, y: 630, w: 266, h: 292, ax: 131, ay: 292 },
      { x: 27, y: 946, w: 251, h: 281, ax: 145, ay: 281 },
      { x: 333, y: 1078, w: 318, h: 144, ax: 242, ay: 144 },
      { x: 708, y: 934, w: 194, h: 300, ax: 95, ay: 300 },
      { x: 948, y: 986, w: 289, h: 241, ax: 36, ay: 241 },
    ],
    animations: {
      idle: { frames: [0, 1], fps: 4.5, loop: true },
      walk: { frames: [2, 0, 3, 1], fps: 9.5, loop: true },
      run: {
        frames: [7, 2, 7, 3],
        fps: 13,
        loop: true,
        procedural: 'leanForward',
      },
      shoulder: {
        frames: [4, 7, 7, 11],
        fps: 13,
        loop: false,
        procedural: 'leanForward',
      },
      attack1: { frames: [7, 8, 8, 0], fps: 19, loop: false },
      attack2: { frames: [4, 9, 9, 7], fps: 19, loop: false },
      attack3: { frames: [7, 10, 10, 4], fps: 17, loop: false },
      airKick: { frames: [5, 15, 15, 4], fps: 17, loop: false },
      jump: { frames: [4, 5, 4], fps: 8.5, loop: false },
      hurt: { frames: [12, 4], fps: 10, loop: false },
      knockdown: { frames: [12, 13], fps: 10, loop: false },
      getup: { frames: [13, 4, 7, 0], fps: 14, loop: false },
      grab: { frames: [6, 11], fps: 8, loop: false },
      grabHold: { frames: [6], fps: 4, loop: true },
      grabKnee: { frames: [9, 6], fps: 12, loop: false },
      grabThrow: { frames: [11, 14], fps: 10, loop: false },
      special: {
        frames: [4, 14, 11, 14],
        fps: 10,
        loop: false,
        procedural: 'flashGold',
      },
      guard: { frames: [6], fps: 4, loop: true },
      victory: { frames: [14, 1, 14, 0], fps: 4, loop: true },
    },
  },
};

export interface LoadedCharacterSprites {
  sheets: Partial<Record<CharacterId, HTMLImageElement>>;
  frameCanvases: Partial<Record<CharacterId, HTMLCanvasElement[]>>;
  available: CharacterId[];
  error: string | null;
}

export function validateSpriteMapEntry(
  map: CharacterSpriteMap,
  imgWidth: number,
  imgHeight: number
): string | null {
  if (imgWidth !== map.sheetWidth || imgHeight !== map.sheetHeight) {
    return `SPRITE_MAP mismatch para ${map.id}: esperado ${map.sheetWidth}x${map.sheetHeight}, recibido ${imgWidth}x${imgHeight}.`;
  }
  for (let i = 0; i < map.frames.length; i++) {
    const f = map.frames[i];
    if (f.x < 0 || f.y < 0 || f.x + f.w > imgWidth || f.y + f.h > imgHeight) {
      return `SPRITE_MAP frame ${i} fuera de límites en ${map.id}.`;
    }
  }
  return null;
}

export function getAnimationFrameIndex(
  charId: CharacterId,
  anim: SpriteAnimName,
  elapsedSec: number
): number {
  const def = SPRITE_MAP[charId].animations[anim];
  if (!def || def.frames.length === 0) return 0;
  const idx = Math.floor(elapsedSec * def.fps);
  if (def.loop) {
    return def.frames[idx % def.frames.length];
  }
  return def.frames[Math.min(idx, def.frames.length - 1)];
}

function preSliceCharacterFrames(
  img: HTMLImageElement,
  map: CharacterSpriteMap
): HTMLCanvasElement[] {
  const baseH = map.frames[0]?.h || 300;
  const sliceScale = Math.min(1, (map.targetHeightPx * 2) / Math.max(1, baseH));
  return map.frames.map((frame) => {
    const dw = Math.max(1, Math.round(frame.w * sliceScale));
    const dh = Math.max(1, Math.round(frame.h * sliceScale));
    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh);
      try {
        const imgData = ctx.getImageData(0, 0, dw, dh);
        const px = imgData.data;
        let dirty = false;
        for (let a = 3; a < px.length; a += 4) {
          if (px[a] > 0 && px[a] <= 12) {
            px[a] = 0;
            dirty = true;
          }
        }
        if (dirty) ctx.putImageData(imgData, 0, 0);
      } catch {
        // Ignore cross-origin pixel checks
      }
    }
    return c;
  });
}

export async function loadAllCharacterSprites(): Promise<LoadedCharacterSprites> {
  const ids: CharacterId[] = ['bayron', 'marcianeke', 'crismj'];
  const sheets: Partial<Record<CharacterId, HTMLImageElement>> = {};
  const frameCanvases: Partial<Record<CharacterId, HTMLCanvasElement[]>> = {};
  const available: CharacterId[] = [];
  const errors: string[] = [];

  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve) => {
          const map = SPRITE_MAP[id];
          const img = new Image();
          img.onload = () => {
            const err = validateSpriteMapEntry(map, img.naturalWidth, img.naturalHeight);
            if (err) {
              errors.push(err);
            } else {
              sheets[id] = img;
              frameCanvases[id] = preSliceCharacterFrames(img, map);
              available.push(id);
            }
            resolve();
          };
          img.onerror = () => {
            errors.push(`No se pudo cargar el sprite de ${id} (${map.sheetSrc}).`);
            resolve();
          };
          img.src = map.sheetSrc;
        })
    )
  );

  // Preserve canonical order
  const ordered = ids.filter((id) => available.includes(id));
  return {
    sheets,
    frameCanvases,
    available: ordered,
    error: ordered.length === 0 ? errors.join(' | ') : errors.length > 0 ? errors.join(' | ') : null,
  };
}
