import {
  ATTACK_FRAME_DATA,
  CHARACTERS,
  ITEM_STATS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PALETTE,
  WALK_MIN_Y,
  WEAPON_STATS,
} from './data';
import {
  buildAttackHitboxInto,
  computeDirectionalShadowInto,
  computeJumpFrameIndex,
  getAttackFrameSlot,
  getAttackPhase,
  getBoss1FrameIndex,
  getBoss2FrameIndex,
  getBoss3FrameIndex,
  getBoss4FrameIndex,
  getBoss5FrameIndex,
  getEnemySheetFrameIndex,
  lerp,
} from './rules';
import { getAnimationFrameIndex, SPRITE_MAP } from './sprites';
import type {
  AttackSlot,
  BossEntity,
  BreakableEntity,
  BossAttackKind,
  CharacterId,
  EnemyEntity,
  FloatingText,
  GameScreen,
  HazardZone,
  LevelDef,
  Particle,
  PickupEntity,
  PlayerEntity,
  ProjectileEntity,
  SpriteAnimName,
  WeaponType,
} from './types';
import type { ProcessedPixelSprite, WorldAssets } from './worldSprites';

export interface RenderWorldState {
  screen: GameScreen;
  level: LevelDef;
  cameraX: number;
  cameraZoom: number;
  renderAlpha: number;
  shakeX: number;
  shakeY: number;
  timeSec: number;
  reduceEffects: boolean;
  debugHitboxes: boolean;
  player: PlayerEntity;
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  breakables: BreakableEntity[];
  pickups: PickupEntity[];
  projectiles: ProjectileEntity[];
  hazards: HazardZone[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  sprites: Partial<Record<CharacterId, HTMLImageElement>>;
  frameCanvases?: Partial<Record<CharacterId, HTMLCanvasElement[]>>;
  worldAssets: WorldAssets;
  specialFx: {
    active: boolean;
    charId: CharacterId;
    x: number;
    y: number;
    timer: number;
    maxTimer: number;
  };
  whiteFlashTimer: number;
  bossDangerActive: boolean;
  bonusRoomActive: boolean;
}

const MAX_RENDER_ENTITIES = 192;
const debugAtkBoxScratch = { x: 0, z: 0, w: 0, h: 0 };

const SHADOW_WIDTH_BY_KIND = {
  player: 44,
  enemy: 44,
  boss: 58,
  breakable: 46,
  pickup: 26,
  projectile: 20,
} as const;

interface ShadowCaster {
  x: number;
  groundY: number;
  z: number;
  baseWidth: number;
  alphaMul: number;
}

type DrawableKind = 'player' | 'enemy' | 'boss' | 'breakable' | 'pickup' | 'projectile';

interface DrawableEntry {
  groundY: number;
  kind: DrawableKind;
  ix: number;
  iy: number;
  iz: number;
  player: PlayerEntity | null;
  enemy: EnemyEntity | null;
  boss: BossEntity | null;
  breakable: BreakableEntity | null;
  pickup: PickupEntity | null;
  projectile: ProjectileEntity | null;
}

const shadowPool: ShadowCaster[] = Array.from({ length: MAX_RENDER_ENTITIES }, () => ({
  x: 0,
  groundY: 0,
  z: 0,
  baseWidth: 48,
  alphaMul: 1,
}));

const drawablePool: DrawableEntry[] = Array.from({ length: MAX_RENDER_ENTITIES }, () => ({
  groundY: 0,
  kind: 'player',
  ix: 0,
  iy: 0,
  iz: 0,
  player: null,
  enemy: null,
  boss: null,
  breakable: null,
  pickup: null,
  projectile: null,
}));

interface QueuedCharLight {
  sx: number;
  sy: number;
  glowX: number;
  glowY: number;
  glowR: number;
  color: string;
  floorAlpha: number;
  glowAlpha: number;
  lightSprite: HTMLCanvasElement | null;
}

const charLightPool: QueuedCharLight[] = Array.from({ length: MAX_RENDER_ENTITIES }, () => ({
  sx: 0,
  sy: 0,
  glowX: 0,
  glowY: 0,
  glowR: 0,
  color: '#FFB74D',
  floorAlpha: 0,
  glowAlpha: 0,
  lightSprite: null,
}));
let charLightCount = 0;

interface StaticGradientCache {
  titleBottomScrim: CanvasGradient;
  titleTopVignette: CanvasGradient;
  bonusSkyGrad: CanvasGradient;
}

const gradientCacheMap = new WeakMap<CanvasRenderingContext2D, StaticGradientCache>();
const bakedTitleCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const characterLightCache = new Map<string, HTMLCanvasElement>();
let cachedDangerVignette: HTMLCanvasElement | null = null;

function getCharacterLightSprite(color: string): HTMLCanvasElement | null {
  const cached = characterLightCache.get(color);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const size = 96;
  const half = size / 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const lctx = c.getContext('2d');
  if (!lctx) return null;
  const grad = lctx.createRadialGradient(half, half, 4, half, half, half);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = grad;
  lctx.fillRect(0, 0, size, size);
  characterLightCache.set(color, c);
  return c;
}

function getDangerVignetteCanvas(): HTMLCanvasElement | null {
  if (cachedDangerVignette) return cachedDangerVignette;
  if (typeof document === 'undefined') return null;
  const w = 480;
  const h = 270;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const dctx = c.getContext('2d');
  if (!dctx) return null;
  const grad = dctx.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, w * 0.62);
  grad.addColorStop(0, 'rgba(193, 18, 31, 0)');
  grad.addColorStop(1, 'rgba(193, 18, 31, 1)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, w, h);
  cachedDangerVignette = c;
  return c;
}

function getStaticGradients(ctx: CanvasRenderingContext2D): StaticGradientCache {
  const existing = gradientCacheMap.get(ctx);
  if (existing) return existing;

  const titleBottomScrim = ctx.createLinearGradient(0, LOGICAL_HEIGHT * 0.45, 0, LOGICAL_HEIGHT);
  titleBottomScrim.addColorStop(0, 'rgba(5, 6, 12, 0)');
  titleBottomScrim.addColorStop(0.65, 'rgba(10, 5, 10, 0.36)');
  titleBottomScrim.addColorStop(1, 'rgba(20, 4, 6, 0.78)');

  const titleTopVignette = ctx.createLinearGradient(0, 0, 0, 120);
  titleTopVignette.addColorStop(0, 'rgba(5, 6, 12, 0.48)');
  titleTopVignette.addColorStop(1, 'rgba(5, 6, 12, 0)');

  const bonusSkyGrad = ctx.createLinearGradient(0, 0, 0, WALK_MIN_Y);
  bonusSkyGrad.addColorStop(0, '#070B18');
  bonusSkyGrad.addColorStop(0.6, '#131836');
  bonusSkyGrad.addColorStop(1, '#1E1B4B');

  const created: StaticGradientCache = {
    titleBottomScrim,
    titleTopVignette,
    bonusSkyGrad,
  };
  gradientCacheMap.set(ctx, created);
  return created;
}

function hashSeed(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function getPlayerSpriteAnim(p: PlayerEntity): SpriteAnimName {
  switch (p.state) {
    case 'walk':
      return 'walk';
    case 'run':
      return 'run';
    case 'shoulder':
      return 'shoulder';
    case 'recover':
      return 'guard';
    case 'jump':
      return 'jump';
    case 'attack1':
      return 'attack1';
    case 'attack2':
      return 'attack2';
    case 'attack3':
      return 'attack3';
    case 'airKick':
      return 'airKick';
    case 'grabHold':
      return 'grabHold';
    case 'grabKnee':
      return 'grabKnee';
    case 'grabThrow':
      return 'grabThrow';
    case 'special':
      return 'special';
    case 'hurt':
    case 'grabbedByEnemy':
      return 'hurt';
    case 'knockdown':
    case 'ko':
      return 'knockdown';
    case 'getup':
      return 'getup';
    default:
      return 'idle';
  }
}

function interpX(ent: { x: number; prevX?: number }, alpha: number): number {
  return ent.prevX !== undefined ? lerp(ent.prevX, ent.x, alpha) : ent.x;
}
function interpY(ent: { y: number; prevY?: number }, alpha: number): number {
  return ent.prevY !== undefined ? lerp(ent.prevY, ent.y, alpha) : ent.y;
}
function interpZ(ent: { z: number; prevZ?: number }, alpha: number): number {
  return ent.prevZ !== undefined ? lerp(ent.prevZ, ent.z, alpha) : ent.z;
}

function getOrBakeTitleComposite(titleBg: HTMLCanvasElement): HTMLCanvasElement {
  const existing = bakedTitleCache.get(titleBg);
  if (existing) return existing;

  const off = document.createElement('canvas');
  off.width = LOGICAL_WIDTH;
  off.height = LOGICAL_HEIGHT;
  const octx = off.getContext('2d');
  if (!octx) return titleBg;

  octx.imageSmoothingEnabled = false;
  octx.drawImage(titleBg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  const grads = getStaticGradients(octx);

  // Shroud the legacy upper-right painted figure completely in smoky night clouds so the real 5 bosses take center stage
  const shroud = octx.createRadialGradient(735, 138, 60, 725, 155, 240);
  shroud.addColorStop(0, 'rgba(9, 4, 10, 0.99)');
  shroud.addColorStop(0.55, 'rgba(13, 5, 12, 0.96)');
  shroud.addColorStop(0.82, 'rgba(16, 6, 14, 0.72)');
  shroud.addColorStop(1, 'rgba(16, 6, 14, 0)');
  octx.fillStyle = shroud;
  octx.fillRect(480, 0, 480, 390);

  // Dramatic centered crimson backlight behind the giant Stage 5 Final Boss silhouette
  const overlordGlow = octx.createRadialGradient(
    LOGICAL_WIDTH * 0.5,
    LOGICAL_HEIGHT * 0.34,
    24,
    LOGICAL_WIDTH * 0.5,
    LOGICAL_HEIGHT * 0.4,
    330
  );
  overlordGlow.addColorStop(0, 'rgba(185, 28, 28, 0.42)');
  overlordGlow.addColorStop(0.55, 'rgba(127, 29, 29, 0.24)');
  overlordGlow.addColorStop(1, 'rgba(8, 5, 14, 0.55)');
  octx.fillStyle = overlordGlow;
  octx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // Subtle top/bottom contrast bands so top logo & bottom menu/marquee remain crisp
  octx.fillStyle = grads.titleBottomScrim;
  octx.fillRect(0, Math.round(LOGICAL_HEIGHT * 0.45), LOGICAL_WIDTH, LOGICAL_HEIGHT);

  octx.fillStyle = grads.titleTopVignette;
  octx.fillRect(0, 0, LOGICAL_WIDTH, 120);

  bakedTitleCache.set(titleBg, off);
  return off;
}

function drawTitleBackdrop(
  ctx: CanvasRenderingContext2D,
  state: RenderWorldState
): void {
  const { titleBg } = state.worldAssets;
  if (!titleBg) return;

  const composite = getOrBakeTitleComposite(titleBg);
  ctx.drawImage(composite, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  if (!state.reduceEffects) {
    // Subtle atmospheric crimson rain streaks behind the cast (single batched path)
    const t = state.timeSec;
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const rx = (hashSeed(i * 19.3) * LOGICAL_WIDTH + t * 70) % LOGICAL_WIDTH;
      const ry = (hashSeed(i * 41.7) * LOGICAL_HEIGHT + t * 420) % LOGICAL_HEIGHT;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 14);
    }
    ctx.stroke();
  }
}

export function renderWorld(ctx: CanvasRenderingContext2D, state: RenderWorldState): void {
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (state.screen === 'MENÚ' && state.worldAssets.titleBg) {
    drawTitleBackdrop(ctx, state);
    ctx.restore();
    return;
  }

  const shakeX = state.reduceEffects ? 0 : Math.round(state.shakeX);
  const shakeY = state.reduceEffects ? 0 : Math.round(state.shakeY);

  if (state.cameraZoom !== 1) {
    ctx.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    ctx.scale(state.cameraZoom, state.cameraZoom);
    ctx.translate(-LOGICAL_WIDTH / 2, -LOGICAL_HEIGHT / 2);
  }

  const camX = Math.round(state.cameraX);
  const alpha = state.renderAlpha;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // 1. Background + Ground
  if (state.bonusRoomActive) {
    drawBonusRoomBackground(ctx, state.timeSec, state.worldAssets.bonusCourtBg);
  } else {
    drawLevelBackground(
      ctx,
      state.level,
      camX,
      state.timeSec,
      state.reduceEffects,
      state.worldAssets.backgrounds[state.level.theme],
      state.worldAssets.backgroundsAlt[state.level.theme],
      state.boss?.phase ?? 1
    );
  }

  for (let i = 0; i < state.hazards.length; i++) {
    drawHazardZone(ctx, state.hazards[i], camX, state.timeSec);
  }

  if (state.specialFx.active) {
    drawSpecialEffect(ctx, state.specialFx, camX);
  }

  // Gather shadows + drawable descriptors in pre-allocated zero-GC buffers
  let shadowCount = 0;
  let drawCount = 0;

  for (let i = 0; i < state.breakables.length && drawCount < MAX_RENDER_ENTITIES; i++) {
    const b = state.breakables[i];
    if (b.broken) continue;
    const sc = shadowPool[shadowCount++];
    sc.x = b.x;
    sc.groundY = b.y;
    sc.z = 0;
    sc.baseWidth = SHADOW_WIDTH_BY_KIND.breakable;
    sc.alphaMul = 1;

    const d = drawablePool[drawCount++];
    d.groundY = b.y;
    d.kind = 'breakable';
    d.ix = b.x;
    d.iy = b.y;
    d.iz = 0;
    d.breakable = b;
    d.player = null;
    d.enemy = null;
    d.boss = null;
    d.pickup = null;
    d.projectile = null;
  }

  for (let i = 0; i < state.pickups.length && drawCount < MAX_RENDER_ENTITIES; i++) {
    const pk = state.pickups[i];
    if (pk.collected) continue;
    const ix = interpX(pk, alpha);
    const iy = interpY(pk, alpha);
    const iz = interpZ(pk, alpha);

    const sc = shadowPool[shadowCount++];
    sc.x = ix;
    sc.groundY = iy;
    sc.z = iz;
    sc.baseWidth = SHADOW_WIDTH_BY_KIND.pickup;
    sc.alphaMul = 1;

    const d = drawablePool[drawCount++];
    d.groundY = iy;
    d.kind = 'pickup';
    d.ix = ix;
    d.iy = iy;
    d.iz = iz;
    d.pickup = pk;
    d.player = null;
    d.enemy = null;
    d.boss = null;
    d.breakable = null;
    d.projectile = null;
  }

  for (let i = 0; i < state.enemies.length && drawCount < MAX_RENDER_ENTITIES; i++) {
    const e = state.enemies[i];
    const ix = interpX(e, alpha);
    const iy = interpY(e, alpha);
    const iz = interpZ(e, alpha);

    const sc = shadowPool[shadowCount++];
    sc.x = ix;
    sc.groundY = iy;
    sc.z = iz;
    sc.baseWidth = SHADOW_WIDTH_BY_KIND.enemy;
    sc.alphaMul = e.fromSewer && e.sewerRise ? 1 - e.sewerRise * 0.6 : 1;

    const d = drawablePool[drawCount++];
    d.groundY = iy;
    d.kind = 'enemy';
    d.ix = ix;
    d.iy = iy;
    d.iz = iz;
    d.enemy = e;
    d.player = null;
    d.boss = null;
    d.breakable = null;
    d.pickup = null;
    d.projectile = null;
  }

  if (state.boss && drawCount < MAX_RENDER_ENTITIES) {
    const b = state.boss;
    const ix = interpX(b, alpha);
    const iy = interpY(b, alpha);
    const iz = interpZ(b, alpha);

    const sc = shadowPool[shadowCount++];
    sc.x = ix;
    sc.groundY = iy;
    sc.z = iz;
    sc.baseWidth = SHADOW_WIDTH_BY_KIND.boss;
    sc.alphaMul = b.defId === 4 && !state.worldAssets.boss4Frames?.length && b.visibleTimer <= 0 && b.state !== 'ko' ? 0.55 : 1;

    const d = drawablePool[drawCount++];
    d.groundY = iy;
    d.kind = 'boss';
    d.ix = ix;
    d.iy = iy;
    d.iz = iz;
    d.boss = b;
    d.player = null;
    d.enemy = null;
    d.breakable = null;
    d.pickup = null;
    d.projectile = null;
  }

  if (drawCount < MAX_RENDER_ENTITIES) {
    const p = state.player;
    const ix = interpX(p, alpha);
    const iy = interpY(p, alpha);
    const iz = interpZ(p, alpha);

    const sc = shadowPool[shadowCount++];
    sc.x = ix;
    sc.groundY = iy;
    sc.z = iz;
    sc.baseWidth = SHADOW_WIDTH_BY_KIND.player;
    sc.alphaMul = 1;

    const d = drawablePool[drawCount++];
    d.groundY = iy;
    d.kind = 'player';
    d.ix = ix;
    d.iy = iy;
    d.iz = iz;
    d.player = p;
    d.enemy = null;
    d.boss = null;
    d.breakable = null;
    d.pickup = null;
    d.projectile = null;
  }

  for (let i = 0; i < state.projectiles.length && drawCount < MAX_RENDER_ENTITIES; i++) {
    const pr = state.projectiles[i];
    const ix = interpX(pr, alpha);
    const iy = interpY(pr, alpha);
    const iz = interpZ(pr, alpha);

    const sc = shadowPool[shadowCount++];
    sc.x = ix;
    sc.groundY = iy;
    sc.z = iz;
    sc.baseWidth = SHADOW_WIDTH_BY_KIND.projectile;
    sc.alphaMul = 0.85;

    const d = drawablePool[drawCount++];
    d.groundY = iy + 1;
    d.kind = 'projectile';
    d.ix = ix;
    d.iy = iy;
    d.iz = iz;
    d.projectile = pr;
    d.player = null;
    d.enemy = null;
    d.boss = null;
    d.breakable = null;
    d.pickup = null;
  }

  // 2. SHADOW PASS: Directional oval shadows relative to nearest stage light BEFORE any entity is rendered
  renderDynamicShadows(ctx, shadowPool, shadowCount, camX, state.level.theme, state.timeSec);

  // 3. ENTITIES Z-SORTED IN-PLACE BY groundY (insertion sort, zero GC)
  charLightCount = 0;
  for (let i = 1; i < drawCount; i++) {
    const cur = drawablePool[i];
    const keyY = cur.groundY;
    let j = i - 1;
    while (j >= 0 && drawablePool[j].groundY > keyY) {
      drawablePool[j + 1] = drawablePool[j];
      j--;
    }
    drawablePool[j + 1] = cur;
  }

  for (let i = 0; i < drawCount; i++) {
    const item = drawablePool[i];
    switch (item.kind) {
      case 'breakable':
        if (item.breakable) {
          drawBreakable(
            ctx,
            item.breakable,
            camX,
            state.worldAssets.breakables[item.breakable.kind]
          );
        }
        break;
      case 'pickup':
        if (item.pickup) {
          drawPickup(
            ctx,
            item.pickup,
            item.ix,
            item.iy,
            item.iz,
            camX,
            state.timeSec,
            state.worldAssets.pickups[item.pickup.type]
          );
        }
        break;
      case 'enemy':
        if (item.enemy) {
          drawEnemy(
            ctx,
            item.enemy,
            item.ix,
            item.iy,
            item.iz,
            camX,
            state.timeSec,
            state.debugHitboxes,
            state.worldAssets.enemies[item.enemy.type],
            state.worldAssets.enemySheets[item.enemy.type],
            state.level.theme,
            state.reduceEffects
          );
        }
        break;
      case 'boss':
        if (item.boss) {
          drawBoss(
            ctx,
            item.boss,
            item.ix,
            item.iy,
            item.iz,
            camX,
            state.timeSec,
            state.debugHitboxes,
            state.worldAssets.bosses[item.boss.defId],
            state.worldAssets.boss1Frames,
            state.worldAssets.boss2Frames,
            state.worldAssets.boss3Frames,
            state.worldAssets.boss4Frames,
            state.worldAssets.boss5Frames,
            state.level.theme,
            state.reduceEffects
          );
        }
        break;
      case 'player':
        if (item.player) {
          drawPlayer(
            ctx,
            item.player,
            item.ix,
            item.iy,
            item.iz,
            state.sprites,
            camX,
            state.timeSec,
            state.debugHitboxes,
            state.frameCanvases,
            state.level.theme,
            state.reduceEffects
          );
        }
        break;
      case 'projectile':
        if (item.projectile) {
          drawProjectile(ctx, item.projectile, item.ix, item.iy, item.iz, camX, state.timeSec);
        }
        break;
    }
  }

  flushDynamicCharacterLights(ctx);

  drawParticles(ctx, state.particles, camX);
  drawFloatingTexts(ctx, state.floatingTexts, camX);

  if (state.whiteFlashTimer > 0 && !state.reduceEffects) {
    ctx.globalAlpha = Math.min(0.65, state.whiteFlashTimer * 3);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-40, -40, LOGICAL_WIDTH + 80, LOGICAL_HEIGHT + 80);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (state.bossDangerActive && !state.reduceEffects) {
    const dangerVignette = getDangerVignetteCanvas();
    if (dangerVignette) {
      ctx.globalAlpha = 0.22 + 0.16 * Math.abs(Math.sin(state.timeSec * 10));
      ctx.drawImage(dangerVignette, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

const stageLightScratch = { x: 0, color: '#FFB74D', intensity: 1 };
const shadowScratch = { offsetX: 0, rx: 0, ry: 0, alpha: 0 };

function fillNearestStageLight(
  theme: LevelDef['theme'],
  worldX: number,
  timeSec: number
): typeof stageLightScratch {
  let step = 360;
  let offset = 180;
  let color = '#FFB74D';
  if (theme === 'feria') {
    step = 320;
    offset = 160;
    color = '#FFD23F';
  } else if (theme === 'metro') {
    step = 320;
    offset = 160;
    color = '#38BDF8';
  } else if (theme === 'discoteca') {
    step = 300;
    offset = 150;
    const idx = Math.round((worldX - offset) / step);
    color = Math.abs(idx) % 2 === 0 ? '#FF2E88' : '#19E3FF';
  } else if (theme === 'torre') {
    step = 340;
    offset = 170;
    color = '#EF4444';
  }

  const slot = Math.round((worldX - offset) / step);
  const lx = slot * step + offset;
  const dist = Math.abs(worldX - lx);
  const pulse = theme === 'discoteca' ? 0.85 + 0.15 * Math.sin(timeSec * 4 + slot) : 1;
  const intensity = Math.max(0.18, 1 - dist / (step * 0.62)) * pulse;
  stageLightScratch.x = lx;
  stageLightScratch.color = color;
  stageLightScratch.intensity = intensity;
  return stageLightScratch;
}

function renderDynamicShadows(
  ctx: CanvasRenderingContext2D,
  casters: readonly ShadowCaster[],
  count: number,
  camX: number,
  theme: LevelDef['theme'],
  timeSec: number
): void {
  if (count <= 0) return;
  ctx.fillStyle = '#05070D';
  for (let i = 0; i < count; i++) {
    const c = casters[i];
    const light = fillNearestStageLight(theme, c.x, timeSec);
    computeDirectionalShadowInto(shadowScratch, c.x, c.z, c.baseWidth, c.alphaMul, light.x);
    const sx = Math.round(c.x - camX + shadowScratch.offsetX);
    if (sx < -120 || sx > LOGICAL_WIDTH + 120) continue;
    const sy = Math.round(c.groundY + 2);

    // Outer soft penumbra
    ctx.globalAlpha = shadowScratch.alpha * 0.45;
    ctx.beginPath();
    ctx.ellipse(sx, sy, Math.round(shadowScratch.rx * 1.24), Math.round(shadowScratch.ry * 1.26), 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp contact shadow core
    ctx.globalAlpha = shadowScratch.alpha;
    ctx.beginPath();
    ctx.ellipse(sx, sy, shadowScratch.rx, shadowScratch.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function enqueueDynamicCharacterLight(
  worldX: number,
  sx: number,
  sy: number,
  iz: number,
  heightPx: number,
  theme: LevelDef['theme'],
  timeSec: number,
  overrideColor?: string,
  extraIntensity = 0
): void {
  if (charLightCount >= MAX_RENDER_ENTITIES) return;
  const light = fillNearestStageLight(theme, worldX, timeSec);
  const color = overrideColor ?? light.color;
  const intensity = Math.min(1, light.intensity + extraIntensity);
  if (intensity <= 0.15) return;

  const dirFromLight = Math.max(-1, Math.min(1, (light.x - worldX) / 140));
  const glowR = Math.round(heightPx * 0.52);
  const slot = charLightPool[charLightCount++];
  slot.sx = sx;
  slot.sy = sy;
  slot.glowX = sx + Math.round(dirFromLight * 12);
  slot.glowY = Math.round(sy - iz - heightPx * 0.56);
  slot.glowR = glowR;
  slot.color = color;
  slot.floorAlpha = 0.09 * intensity;
  slot.glowAlpha = 0.22 * intensity;
  slot.lightSprite = getCharacterLightSprite(color);
}

function flushDynamicCharacterLights(ctx: CanvasRenderingContext2D): void {
  if (charLightCount <= 0) return;
  const prevComp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';

  let lastFill = '';
  for (let i = 0; i < charLightCount; i++) {
    const q = charLightPool[i];
    ctx.globalAlpha = q.floorAlpha;
    if (q.color !== lastFill) {
      lastFill = q.color;
      ctx.fillStyle = q.color;
    }
    ctx.beginPath();
    ctx.ellipse(q.sx, q.sy + 2, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < charLightCount; i++) {
    const q = charLightPool[i];
    if (!q.lightSprite) continue;
    ctx.globalAlpha = q.glowAlpha;
    ctx.drawImage(
      q.lightSprite,
      q.glowX - q.glowR,
      q.glowY - q.glowR,
      q.glowR * 2,
      q.glowR * 2
    );
  }

  ctx.globalCompositeOperation = prevComp;
  ctx.globalAlpha = 1;
  charLightCount = 0;
}

let cachedProceduralBonusCourt: HTMLCanvasElement | null = null;

function getOrBuildProceduralBonusCourt(): HTMLCanvasElement | null {
  if (cachedProceduralBonusCourt) return cachedProceduralBonusCourt;
  if (typeof document === 'undefined') return null;

  const off = document.createElement('canvas');
  off.width = LOGICAL_WIDTH;
  off.height = LOGICAL_HEIGHT;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  const grads = getStaticGradients(ctx);
  ctx.fillStyle = grads.bonusSkyGrad;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, WALK_MIN_Y);

  // Night stars
  ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
  for (let i = 0; i < 28; i++) {
    const sx = Math.round(hashSeed(i * 19.7) * LOGICAL_WIDTH);
    const sy = Math.round(14 + hashSeed(i * 41.3) * 190);
    ctx.fillRect(sx, sy, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
  }

  // Distant urban block silhouettes & Andean ridge
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(0, 320);
  ctx.lineTo(140, 248);
  ctx.lineTo(310, 290);
  ctx.lineTo(480, 234);
  ctx.lineTo(690, 286);
  ctx.lineTo(840, 244);
  ctx.lineTo(LOGICAL_WIDTH, 280);
  ctx.lineTo(LOGICAL_WIDTH, WALK_MIN_Y);
  ctx.lineTo(0, WALK_MIN_Y);
  ctx.closePath();
  ctx.fill();

  // Neighboring poblacion apartments with warm lit windows
  const blocks = [
    { x: 24, w: 120, h: 165 },
    { x: 170, w: 105, h: 138 },
    { x: 675, w: 115, h: 152 },
    { x: 816, w: 120, h: 176 },
  ];
  for (let b = 0; b < blocks.length; b++) {
    const blk = blocks[b];
    const by = WALK_MIN_Y - blk.h - 24;
    ctx.fillStyle = '#181E34';
    ctx.fillRect(blk.x, by, blk.w, blk.h + 24);
    for (let wy = by + 18; wy < WALK_MIN_Y - 52; wy += 24) {
      for (let wx = blk.x + 16; wx < blk.x + blk.w - 18; wx += 22) {
        const lit = hashSeed(wx * 3.1 + wy * 7.7) > 0.48;
        if (!lit) continue;
        ctx.fillStyle = hashSeed(wx + wy) > 0.5 ? '#FBBF24' : '#38BDF8';
        ctx.fillRect(wx, wy, 10, 12);
      }
    }
  }

  // Back retaining wall & chain-link court fence
  const fenceTop = WALK_MIN_Y - 122;
  ctx.fillStyle = '#1E2538';
  ctx.fillRect(0, WALK_MIN_Y - 34, LOGICAL_WIDTH, 34);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, WALK_MIN_Y - 34, LOGICAL_WIDTH, 4);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1.2;
  for (let x = -40; x < LOGICAL_WIDTH + 60; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, fenceTop);
    ctx.lineTo(x + 48, WALK_MIN_Y - 34);
    ctx.moveTo(x + 48, fenceTop);
    ctx.lineTo(x, WALK_MIN_Y - 34);
    ctx.stroke();
  }
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, fenceTop, LOGICAL_WIDTH, 4);
  for (let x = 40; x < LOGICAL_WIDTH; x += 140) {
    ctx.fillRect(x - 3, fenceTop, 6, 92);
  }

  // Sodium floodlight poles (left & right)
  for (const poleX of [136, LOGICAL_WIDTH - 136]) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(poleX - 5, 86, 10, WALK_MIN_Y - 110);
    ctx.fillStyle = '#64748B';
    ctx.fillRect(poleX - 24, 80, 48, 8);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(poleX - 18, 86, 14, 7);
    ctx.fillRect(poleX + 4, 86, 14, 7);
  }

  // Basketball backboard & hoop on the right end
  ctx.fillStyle = '#475569';
  ctx.fillRect(884, 212, 10, 214);
  ctx.fillRect(850, 212, 36, 8);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(840, 174, 14, 58);
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(842, 188, 10, 24);
  ctx.fillStyle = '#EA580C';
  ctx.fillRect(818, 216, 24, 4);

  // Asphalt concrete street court floor + painted lines
  ctx.fillStyle = '#1F2937';
  ctx.fillRect(0, WALK_MIN_Y - 12, LOGICAL_WIDTH, LOGICAL_HEIGHT - WALK_MIN_Y + 12);
  ctx.fillStyle = '#293548';
  ctx.fillRect(36, WALK_MIN_Y, LOGICAL_WIDTH - 72, LOGICAL_HEIGHT - WALK_MIN_Y - 10);

  // Court boundary lines, center line & center circle
  ctx.strokeStyle = PALETTE.yellow;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, WALK_MIN_Y, LOGICAL_WIDTH - 72, LOGICAL_HEIGHT - WALK_MIN_Y - 10);
  ctx.beginPath();
  ctx.moveTo(LOGICAL_WIDTH / 2, WALK_MIN_Y);
  ctx.lineTo(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(LOGICAL_WIDTH / 2, (WALK_MIN_Y + LOGICAL_HEIGHT) / 2 - 4, 78, 28, 0, 0, Math.PI * 2);
  ctx.stroke();

  cachedProceduralBonusCourt = off;
  return off;
}

function drawBonusRoomBackground(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  bonusCourtBg?: HTMLCanvasElement | null
): void {
  const bg = bonusCourtBg ?? getOrBuildProceduralBonusCourt();
  if (bg) {
    ctx.drawImage(bg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  // Lightweight animated sodium floodlight cones aligned with the Chilean court poles
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.055 + 0.015 * Math.sin(timeSec * 3.1);
  ctx.fillStyle = '#FFD666';
  for (const poleX of [192, LOGICAL_WIDTH - 192]) {
    ctx.beginPath();
    ctx.moveTo(poleX - 28, 18);
    ctx.lineTo(poleX + 28, 18);
    ctx.lineTo(poleX + 205, LOGICAL_HEIGHT - 12);
    ctx.lineTo(poleX - 205, LOGICAL_HEIGHT - 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Crisp street-court sign tucked cleanly into the night sky band between the floodlight poles
  ctx.save();
  ctx.fillStyle = 'rgba(11, 15, 30, 0.86)';
  ctx.strokeStyle = PALETTE.yellow;
  ctx.lineWidth = 3;
  ctx.fillRect(260, 56, 440, 54);
  ctx.strokeRect(260, 56, 440, 54);
  ctx.textAlign = 'center';
  ctx.font = 'bold 23px monospace';
  ctx.strokeStyle = '#0B0F1E';
  ctx.lineWidth = 5;
  ctx.strokeText('CANCHA DE LA POBLA', LOGICAL_WIDTH / 2, 82);
  ctx.fillStyle = PALETTE.yellow;
  ctx.fillText('CANCHA DE LA POBLA', LOGICAL_WIDTH / 2, 82);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText('ROMPE LOS CAJONES Y RECUPERA FUERZAS', LOGICAL_WIDTH / 2, 101);
  ctx.restore();
}

function drawLevelBackground(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  cameraX: number,
  timeSec: number,
  reduceEffects: boolean,
  bgCanvas?: HTMLCanvasElement,
  bgAltCanvas?: HTMLCanvasElement,
  bossPhase: 1 | 2 | 3 = 1
): void {
  if (bgCanvas) {
    const scroll = Math.round(cameraX);
    const firstTile = Math.floor(scroll / LOGICAL_WIDTH) - 1;
    for (let t = firstTile; t <= firstTile + 3; t++) {
      const dx = t * LOGICAL_WIDTH - scroll;
      if (dx + LOGICAL_WIDTH < -80 || dx > LOGICAL_WIDTH + 80) continue;
      const isAlt = Math.abs(t) % 2 === 1;
      const tileImg = isAlt && bgAltCanvas ? bgAltCanvas : bgCanvas;
      if (isAlt && !bgAltCanvas) {
        ctx.save();
        ctx.translate(dx + LOGICAL_WIDTH, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(tileImg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.restore();
      } else {
        ctx.drawImage(tileImg, dx, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      }
    }

    drawAnimatedStageDetails(ctx, level, cameraX, timeSec, reduceEffects, bossPhase);
    return;
  }

  // Fallback procedural background if image assets failed
  const sky = ctx.createLinearGradient(0, 0, 0, WALK_MIN_Y);
  sky.addColorStop(0, level.skyTop);
  sky.addColorStop(1, level.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, WALK_MIN_Y);

  const wallTop = WALK_MIN_Y - 108;
  ctx.fillStyle = level.theme === 'torre' ? '#24182B' : '#252A36';
  ctx.fillRect(0, wallTop, LOGICAL_WIDTH, 108);

  const floorGrad = ctx.createLinearGradient(0, WALK_MIN_Y - 12, 0, LOGICAL_HEIGHT);
  floorGrad.addColorStop(0, level.floorTop);
  floorGrad.addColorStop(1, level.floorBottom);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, WALK_MIN_Y - 12, LOGICAL_WIDTH, LOGICAL_HEIGHT - WALK_MIN_Y + 12);
}

function drawAnimatedStageDetails(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  cameraX: number,
  timeSec: number,
  reduceEffects: boolean,
  bossPhase: 1 | 2 | 3
): void {
  if (level.theme === 'poblacion') {
    // 1.25x Foreground powerline cable silhouette along very top edge (single batched path)
    const fgScroll = Math.round(cameraX * 1.25);
    const wireStep = 360;
    const firstWire = Math.floor(fgScroll / wireStep) - 1;
    ctx.strokeStyle = 'rgba(11, 15, 30, 0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = firstWire; i <= firstWire + 4; i++) {
      const x1 = i * wireStep - fgScroll;
      const x2 = x1 + wireStep;
      ctx.moveTo(x1, 10);
      ctx.quadraticCurveTo(x1 + wireStep * 0.5, 32, x2, 10);
    }
    ctx.stroke();
  } else if (level.theme === 'feria') {
    if (!reduceEffects) {
      const step = 160;
      const first = Math.floor(cameraX / step) - 1;
      for (let i = first; i <= first + 8; i++) {
        const bx = Math.round(i * step - cameraX + 40);
        const sway = Math.round(Math.sin(timeSec * 2.2 + i) * 3);
        ctx.fillStyle = i % 2 === 0 ? '#FFE082' : PALETTE.magenta;
        ctx.globalAlpha = 0.65 + 0.25 * Math.sin(timeSec * 3.5 + i);
        ctx.fillRect(bx + sway, 178, 5, 5);
      }
      ctx.globalAlpha = 1;
    }
  } else if (level.theme === 'discoteca') {
    if (!reduceEffects) {
      // Sweeping ceiling stage beams (safe slow rate <= 1.2 Hz)
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 3; i++) {
        const originX = 180 + i * 300;
        const sweep = Math.sin(timeSec * 1.1 + i * 2.1) * 90;
        ctx.fillStyle = i % 2 === 0 ? PALETTE.magenta : PALETTE.cyan;
        ctx.beginPath();
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX - 75 + sweep, 380);
        ctx.lineTo(originX + 75 + sweep, 380);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (level.theme === 'torre') {
    if (!reduceEffects) {
      // Rising crimson embers / contract ash particles
      const emberCount = bossPhase === 3 ? 18 : bossPhase === 2 ? 12 : 7;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < emberCount; i++) {
        const ex = Math.round(hashSeed(i * 31.7) * LOGICAL_WIDTH);
        const speed = 28 + (i % 4) * 14;
        const ey = Math.round(LOGICAL_HEIGHT - ((timeSec * speed + i * 47) % LOGICAL_HEIGHT));
        ctx.fillStyle = i % 3 === 0 ? PALETTE.yellow : '#C1121F';
        ctx.fillRect(ex, ey, 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    // Subtle floating demonic contract scroll at the far right edge of Level 5
    if (cameraX > level.width - 1050) {
      const ox = Math.round(level.width - 150 - cameraX);
      const fy = Math.round(WALK_MIN_Y - 76 + Math.sin(timeSec * 3) * 4);
      ctx.save();
      ctx.fillStyle = 'rgba(193, 18, 31, 0.25)';
      ctx.beginPath();
      ctx.ellipse(ox, fy + 8, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF2F2';
      ctx.strokeStyle = PALETTE.demonRed;
      ctx.lineWidth = 2;
      ctx.fillRect(ox - 16, fy, 32, 16);
      ctx.strokeRect(ox - 16, fy, 32, 16);
      ctx.fillStyle = PALETTE.demonRed;
      ctx.fillRect(ox - 10, fy + 5, 20, 2);
      ctx.fillRect(ox - 10, fy + 10, 14, 2);
      ctx.restore();
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerEntity,
  ix: number,
  iy: number,
  iz: number,
  sprites: Partial<Record<CharacterId, HTMLImageElement>>,
  cameraX: number,
  timeSec: number,
  debugHitboxes: boolean,
  frameCanvases?: Partial<Record<CharacterId, HTMLCanvasElement[]>>,
  theme: LevelDef['theme'] = 'poblacion',
  reduceEffects = false
): void {
  const sx = Math.round(ix) - cameraX;
  const sy = Math.round(iy);

  if (p.invulnTimer > 0 && Math.floor(timeSec * 16) % 2 === 0 && p.state !== 'special') {
    return;
  }

  const sheet = sprites[p.charId];
  const map = SPRITE_MAP[p.charId];
  const animName = getPlayerSpriteAnim(p);
  const atkSlot: AttackSlot | null =
    p.state === 'attack1'
      ? 'combo1'
      : p.state === 'attack2'
      ? 'combo2'
      : p.state === 'attack3'
      ? 'combo3'
      : p.state === 'airKick'
      ? 'airKick'
      : null;
  let frameIdx: number;
  if (p.state === 'grabbedByEnemy') {
    frameIdx = SPRITE_MAP[p.charId].animations.hurt.frames[0]; // pose de daño fija durante el agarre
  } else if (p.state === 'jump') {
    frameIdx = computeJumpFrameIndex(p.z, p.vz);
  } else if (atkSlot !== null) {
    const atkData = ATTACK_FRAME_DATA[p.charId][atkSlot];
    const slot = getAttackFrameSlot(p.attackTick, atkData);
    const animFrames = map.animations[animName].frames;
    frameIdx = animFrames[Math.min(slot, animFrames.length - 1)] ?? 0;
  } else {
    frameIdx = getAnimationFrameIndex(p.charId, animName, p.animTime);
  }
  if (import.meta.env.MODE !== 'production' && typeof window !== 'undefined') {
    (window as unknown as { __NF_DEBUG_PLAYER_FRAME__?: number }).__NF_DEBUG_PLAYER_FRAME__ =
      frameIdx;
  }
  const frame = map.frames[frameIdx] || map.frames[0];
  const preSliced = frameCanvases?.[p.charId]?.[frameIdx];

  const baseH = map.frames[0].h;
  const scale = map.targetHeightPx / baseH;

  ctx.save();
  ctx.translate(sx, Math.round(sy - iz));
  ctx.scale(p.facing * p.squashX, p.squashY);

  if (animName === 'run') {
    ctx.transform(1, 0, 0.12, 1, 0, 0);
  }

  if (preSliced) {
    ctx.drawImage(
      preSliced,
      0,
      0,
      preSliced.width,
      preSliced.height,
      Math.round(-frame.ax * scale),
      Math.round(-frame.ay * scale),
      Math.round(frame.w * scale),
      Math.round(frame.h * scale)
    );
  } else if (sheet) {
    ctx.drawImage(
      sheet,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      Math.round(-frame.ax * scale),
      Math.round(-frame.ay * scale),
      Math.round(frame.w * scale),
      Math.round(frame.h * scale)
    );
  } else {
    ctx.fillStyle = CHARACTERS[p.charId].specialColor;
    ctx.fillRect(-20, -110, 40, 110);
  }

  if (p.weapon && p.state !== 'knockdown' && p.state !== 'hurt') {
    drawHeldWeapon(ctx, p.weapon, p.state);
  }

  ctx.restore();

  if (!reduceEffects) {
    enqueueDynamicCharacterLight(
      ix,
      sx,
      sy,
      iz,
      map.targetHeightPx,
      theme,
      timeSec,
      p.state === 'special' ? CHARACTERS[p.charId].specialColor : undefined,
      p.state === 'special' ? 0.55 : 0.12
    );
  }

  if (p.state === 'grabbedByEnemy') {
    ctx.fillStyle = PALETTE.yellow;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = PALETTE.night;
    ctx.lineWidth = 4;
    ctx.strokeText('¡MACHACA J / A!', sx, sy - iz - 140);
    ctx.fillText('¡MACHACA J / A!', sx, sy - iz - 140);
  }

  if (debugHitboxes) {
    ctx.strokeStyle = '#19E3FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 22, sy - iz - 110, 44, 110);
    if (p.state === 'shoulder') {
      ctx.strokeStyle = '#FF2E88';
      ctx.strokeRect(sx + (p.facing > 0 ? 10 : -72), sy - iz - 90, 62, 60);
    } else if (atkSlot !== null) {
      const atkData = ATTACK_FRAME_DATA[p.charId][atkSlot];
      if (getAttackPhase(p.attackTick, atkData) === 'active') {
        const stats = CHARACTERS[p.charId];
        const extraReach =
          atkSlot === 'airKick'
            ? stats.kickExtraReach
            : (atkSlot === 'combo3' ? stats.kickExtraReach : 0) +
              (p.weapon ? WEAPON_STATS[p.weapon].reachBonus : 0);
        buildAttackHitboxInto(debugAtkBoxScratch, sx, iz, p.facing, atkData, extraReach);
        ctx.strokeStyle = '#FF2E88';
        ctx.strokeRect(
          Math.round(debugAtkBoxScratch.x - debugAtkBoxScratch.w * 0.5),
          Math.round(sy - debugAtkBoxScratch.z - debugAtkBoxScratch.h),
          Math.round(debugAtkBoxScratch.w),
          Math.round(debugAtkBoxScratch.h)
        );
      }
    }
  }
}

function drawHeldWeapon(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponType,
  state: PlayerEntity['state']
): void {
  const swinging = state === 'attack1' || state === 'attack2' || state === 'attack3';
  const color = WEAPON_STATS[weapon].color;
  ctx.save();
  ctx.translate(swinging ? 34 : 18, swinging ? -72 : -62);
  ctx.rotate(swinging ? 0.35 : -0.65);
  ctx.fillStyle = color;
  if (weapon === 'tubo') {
    ctx.fillRect(0, -4, 38, 7);
  } else if (weapon === 'bate') {
    ctx.fillRect(0, -3, 18, 5);
    ctx.fillRect(18, -5, 22, 9);
  } else if (weapon === 'botella') {
    ctx.fillStyle = '#7CFF4F';
    ctx.fillRect(0, -5, 16, 10);
    ctx.fillRect(16, -2, 10, 4);
  } else {
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(22, swinging ? 6 : 16, 46, swinging ? -2 : 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: EnemyEntity,
  ix: number,
  iy: number,
  iz: number,
  cameraX: number,
  timeSec: number,
  debugHitboxes: boolean,
  sprite?: ProcessedPixelSprite,
  sheetFrames?: ProcessedPixelSprite[],
  theme: LevelDef['theme'] = 'poblacion',
  reduceEffects = false
): void {
  const sx = Math.round(ix) - cameraX;
  const sy = Math.round(iy);
  if (sx < -140 || sx > LOGICAL_WIDTH + 140) return;

  const useSheet = sheetFrames && sheetFrames.length === 16;
  const activeSprite = useSheet
    ? sheetFrames[
        getEnemySheetFrameIndex(
          e.type,
          e.state,
          e.animTime,
          e.stateTimer,
          e.z,
          e.vz,
          e.attackId,
          e.fromSewer
        )
      ]
    : sprite;

  const riseOffset = e.fromSewer && e.sewerRise ? e.sewerRise * 96 : 0;
  const hitWhite = e.hitFlashTimer > 0;
  const walkBob =
    !useSheet && (e.state === 'approach' || e.state === 'circle' || e.state === 'fleeing')
      ? Math.abs(Math.sin(e.animTime * 9)) * 4.5
      : 0;
  const walkTilt =
    !useSheet && (e.state === 'approach' || e.state === 'circle' || e.state === 'fleeing')
      ? Math.sin(e.animTime * 9) * 0.04
      : 0;

  ctx.save();
  ctx.translate(sx, Math.round(sy - iz));

  if (riseOffset > 0) {
    ctx.beginPath();
    ctx.rect(-150, -240, 300, 246);
    ctx.clip();
    ctx.translate(0, Math.round(riseOffset));
  }

  ctx.scale(e.facing * e.squashX, e.squashY);

  if (e.state === 'knockdown' || e.state === 'ko' || e.state === 'thrown') {
    if (!useSheet) {
      ctx.translate(0, -18);
      ctx.rotate(-Math.PI / 2);
    }
  } else {
    ctx.translate(0, -walkBob);
    if (e.state === 'telegraph') {
      ctx.scale(1.06, 0.93);
      ctx.rotate(-0.08);
    } else if (e.state === 'attack' || e.state === 'draining') {
      ctx.translate(8, 0);
      ctx.rotate(0.12);
      ctx.scale(1.08, 0.94);
    } else if (e.state === 'hurt' || e.state === 'stunned') {
      ctx.rotate(-0.14);
    } else if (walkTilt !== 0) {
      ctx.rotate(walkTilt);
    } else {
      ctx.scale(1, 1 + Math.sin(timeSec * 4.2 + e.id) * 0.016);
    }
  }

  if (activeSprite) {
    if (e.type === 'chupetona' && (e.state === 'telegraph' || e.state === 'draining')) {
      ctx.fillStyle = 'rgba(255,46,136,0.36)';
      ctx.beginPath();
      ctx.ellipse(0, -56, 30 + Math.sin(timeSec * 8) * 4, 52, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'fan' && e.hysteric) {
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -56, 30, 56, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const baseHeightRef = useSheet ? sheetFrames[0].height : activeSprite.height;
    const scale = activeSprite.targetHeightPx / Math.max(1, baseHeightRef);
    const drawSource = hitWhite ? activeSprite.flashCanvas : activeSprite.canvas;
    ctx.drawImage(
      drawSource,
      Math.round(-activeSprite.ax * scale),
      Math.round(-activeSprite.ay * scale),
      Math.round(activeSprite.width * scale),
      Math.round(activeSprite.height * scale)
    );

    if (
      e.type === 'domestico' &&
      e.isGuardActive &&
      e.state !== 'hurt' &&
      e.state !== 'knockdown' &&
      e.state !== 'ko'
    ) {
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(24, -56, 26, -0.75, 0.75);
      ctx.stroke();
    }
  } else {
    switch (e.type) {
      case 'zombie':
        drawZombieArt(ctx, hitWhite, e.state, timeSec);
        break;
      case 'cachorro':
        drawCachorroArt(ctx, hitWhite, e.state);
        break;
      case 'canero':
        drawCaneroArt(ctx, hitWhite, e.state, e.animTime);
        break;
      case 'domestico':
        drawDomesticoArt(ctx, hitWhite, e.state, e.isGuardActive);
        break;
      case 'chupetona':
        drawChupetonaArt(ctx, hitWhite, e.state, timeSec);
        break;
      case 'fan':
        drawFanArt(ctx, hitWhite, e.state, e.hysteric, timeSec);
        break;
      case 'manager':
        drawManagerArt(ctx, hitWhite, e.state);
        break;
    }
  }

  ctx.restore();

  if (!reduceEffects && e.state !== 'ko') {
    enqueueDynamicCharacterLight(
      ix,
      sx,
      sy,
      iz,
      activeSprite?.targetHeightPx ?? 108,
      theme,
      timeSec,
      e.state === 'telegraph' ? PALETTE.yellow : undefined,
      e.state === 'telegraph' ? 0.3 : 0
    );
  }

  if (e.state === 'telegraph') {
    ctx.fillStyle = e.type === 'chupetona' ? PALETTE.magenta : PALETTE.yellow;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = PALETTE.night;
    ctx.lineWidth = 4;
    ctx.strokeText('!', sx, sy - iz - 118);
    ctx.fillText('!', sx, sy - iz - 118);
  }

  if (e.state === 'stunned') {
    ctx.save();
    ctx.fillStyle = PALETTE.cyan;
    ctx.strokeStyle = PALETTE.night;
    ctx.lineWidth = 3;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const bob = Math.sin(timeSec * 12 + e.id) * 3;
    ctx.strokeText('✦ ATURDIDO ✦', sx, sy - iz - 116 + bob);
    ctx.fillText('✦ ATURDIDO ✦', sx, sy - iz - 116 + bob);
    ctx.restore();
  }

  if (debugHitboxes) {
    ctx.strokeStyle = '#7CFF4F';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 20, sy - iz - 96, 40, 96);
  }
}

function drawOutlinedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
): void {
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function drawZombieArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state'],
  timeSec: number
): void {
  const skin = hitWhite ? '#FFFFFF' : '#65A30D';
  const cloth = hitWhite ? '#FFFFFF' : '#3F6212';
  drawOutlinedRect(ctx, -12, -34, 9, 34, '#1F2937');
  drawOutlinedRect(ctx, 3, -34, 9, 34, '#1F2937');
  drawOutlinedRect(ctx, -15, -72, 30, 40, cloth);
  ctx.fillStyle = '#84CC16';
  ctx.fillRect(-6, -68, 4, 18);
  ctx.fillRect(2, -62, 5, 12);
  drawOutlinedRect(ctx, -8, -94, 22, 22, skin);
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(6, -90, 8, 5);
  ctx.fillStyle = '#7CFF4F';
  ctx.fillRect(8, -89, 5, 3);
  ctx.fillStyle = '#1F2937';
  ctx.fillRect(4, -79, 9, 4);
  const reach = state === 'attack' || state === 'draining' ? 32 : 22 + Math.sin(timeSec * 5) * 3;
  drawOutlinedRect(ctx, 8, -66, reach, 9, skin);
}

function drawCachorroArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state']
): void {
  const hoodie = hitWhite ? '#FFFFFF' : '#374151';
  drawOutlinedRect(ctx, -10, -30, 8, 30, '#111827');
  drawOutlinedRect(ctx, 2, -30, 8, 30, '#111827');
  drawOutlinedRect(ctx, -14, -64, 28, 36, hoodie);
  ctx.fillStyle = PALETTE.yellow;
  ctx.fillRect(-4, -58, 8, 12);
  drawOutlinedRect(ctx, -12, -88, 24, 24, hoodie);
  ctx.fillStyle = hitWhite ? '#FFFFFF' : '#FDBA74';
  ctx.fillRect(-3, -81, 13, 12);
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(3, -78, 5, 3);
  ctx.fillStyle = PALETTE.yellow;
  ctx.fillRect(-8, -89, 22, 5);
  if (state === 'attack') {
    drawOutlinedRect(ctx, 10, -56, 20, 8, PALETTE.yellow);
  } else {
    drawOutlinedRect(ctx, 6, -54, 12, 8, hoodie);
  }
}

function drawCaneroArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state'],
  animTime: number
): void {
  const jacket = hitWhite ? '#FFFFFF' : '#78350F';
  drawOutlinedRect(ctx, -13, -36, 10, 36, '#1E293B');
  drawOutlinedRect(ctx, 3, -36, 10, 36, '#1E293B');
  drawOutlinedRect(ctx, -18, -76, 36, 42, jacket);
  drawOutlinedRect(ctx, -11, -99, 22, 23, hitWhite ? '#FFFFFF' : '#E5A97C');
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(-2, -93, 14, 5);
  ctx.fillStyle = '#451A03';
  ctx.fillRect(0, -83, 10, 6);
  if (state === 'attack') {
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(12, -56);
    ctx.lineTo(88, -56);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, -56);
    ctx.quadraticCurveTo(24, -36 + Math.sin(animTime * 6) * 4, 28, -24);
    ctx.stroke();
  }
}

function drawDomesticoArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state'],
  guardActive: boolean
): void {
  const suit = hitWhite ? '#FFFFFF' : '#334155';
  drawOutlinedRect(ctx, -11, -36, 9, 36, '#0F172A');
  drawOutlinedRect(ctx, 2, -36, 9, 36, '#0F172A');
  drawOutlinedRect(ctx, -16, -75, 32, 40, suit);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-6, -73, 12, 34);
  drawOutlinedRect(ctx, -10, -98, 20, 22, hitWhite ? '#FFFFFF' : '#F3C19D');
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(2, -91, 6, 4);
  if (guardActive && state !== 'hurt' && state !== 'knockdown') {
    drawOutlinedRect(ctx, 14, -76, 8, 44, '#CBD5E1');
  }
}

function drawChupetonaArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state'],
  timeSec: number
): void {
  ctx.fillStyle =
    state === 'telegraph' || state === 'draining'
      ? 'rgba(255,46,136,0.45)'
      : 'rgba(255,46,136,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, -52, 26 + Math.sin(timeSec * 6) * 3, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  const dress = hitWhite ? '#FFFFFF' : '#BE185D';
  drawOutlinedRect(ctx, -9, -34, 7, 34, '#F5B895');
  drawOutlinedRect(ctx, 2, -34, 7, 34, '#F5B895');
  drawOutlinedRect(ctx, -13, -72, 26, 40, dress);
  drawOutlinedRect(ctx, -10, -94, 20, 22, hitWhite ? '#FFFFFF' : '#F5B895');
  ctx.fillStyle = PALETTE.magenta;
  ctx.fillRect(-13, -97, 22, 10);
  ctx.fillRect(2, -88, 6, 4);
  drawOutlinedRect(ctx, 8, -64, 16, 7, '#F5B895');
}

function drawFanArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state'],
  hysteric: boolean,
  timeSec: number
): void {
  if (hysteric) {
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = 3;
    ctx.strokeRect(-22, -104, 44, 102);
  }
  const top = hitWhite ? '#FFFFFF' : hysteric ? '#EC4899' : '#7E22CE';
  drawOutlinedRect(ctx, -9, -34, 7, 34, '#1E1B4B');
  drawOutlinedRect(ctx, 2, -34, 7, 34, '#1E1B4B');
  drawOutlinedRect(ctx, -14, -72, 28, 38, top);
  drawOutlinedRect(ctx, -10, -94, 20, 22, hitWhite ? '#FFFFFF' : '#F5B895');
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(2, -87, 6, 4);
  ctx.save();
  ctx.translate(14, -64);
  ctx.rotate(state === 'attack' ? 0.6 : Math.sin(timeSec * 8) * 0.15);
  drawOutlinedRect(ctx, -2, -26, 18, 22, PALETTE.cyan);
  ctx.restore();
}

function drawManagerArt(
  ctx: CanvasRenderingContext2D,
  hitWhite: boolean,
  state: EnemyEntity['state']
): void {
  const suit = hitWhite ? '#FFFFFF' : '#111827';
  drawOutlinedRect(ctx, -12, -38, 10, 38, suit);
  drawOutlinedRect(ctx, 2, -38, 10, 38, suit);
  drawOutlinedRect(ctx, -18, -82, 36, 46, suit);
  ctx.fillStyle = PALETTE.demonRed;
  ctx.fillRect(-3, -78, 6, 30);
  drawOutlinedRect(ctx, -11, -106, 22, 24, hitWhite ? '#FFFFFF' : '#E5B38D');
  ctx.fillStyle = '#0B0F1E';
  ctx.fillRect(0, -100, 10, 4);
  drawOutlinedRect(ctx, state === 'attack' ? 16 : 12, -52, 22, 16, PALETTE.yellow);
}

function bossTelegraphStyle(kind: BossAttackKind): { color: string; symbol: string; label: string } {
  if (kind === 'stompWave' || kind === 'soundPush' || kind === 'fireWave') {
    return { color: PALETTE.yellow, symbol: '◎', label: 'ÁREA' };
  }
  if (kind === 'noteFan' || kind === 'throwPhone' || kind === 'contractSweep' || kind === 'contractRain') {
    return { color: PALETTE.cyan, symbol: '✦', label: 'PROYECTIL' };
  }
  if (kind === 'signatureGrab' || kind === 'shoulderCharge' || kind === 'radioDash' || kind === 'flyingKick') {
    return { color: PALETTE.magenta, symbol: '↔', label: 'HORIZONTAL' };
  }
  return { color: PALETTE.demonRed, symbol: '!', label: 'GOLPE' };
}

function drawBoss(
  ctx: CanvasRenderingContext2D,
  b: BossEntity,
  ix: number,
  iy: number,
  iz: number,
  cameraX: number,
  timeSec: number,
  debugHitboxes: boolean,
  bossSprite?: ProcessedPixelSprite,
  boss1Frames?: ProcessedPixelSprite[],
  boss2Frames?: ProcessedPixelSprite[],
  boss3Frames?: ProcessedPixelSprite[],
  boss4Frames?: ProcessedPixelSprite[],
  boss5Frames?: ProcessedPixelSprite[],
  theme: LevelDef['theme'] = 'poblacion',
  reduceEffects = false
): void {
  const sx = Math.round(ix) - cameraX;
  const sy = Math.round(iy);

  const useBoss1Sheet = b.defId === 1 && boss1Frames && boss1Frames.length === 16;
  const useBoss2Sheet = b.defId === 2 && boss2Frames && boss2Frames.length === 16;
  const useBoss3Sheet = b.defId === 3 && boss3Frames && boss3Frames.length === 16;
  const useBoss4Sheet = b.defId === 4 && boss4Frames && boss4Frames.length === 16;
  const useBoss5Sheet = b.defId === 5 && boss5Frames && boss5Frames.length === 16;
  const useSheet = useBoss1Sheet || useBoss2Sheet || useBoss3Sheet || useBoss4Sheet || useBoss5Sheet;
  const activeSheet = useBoss5Sheet
    ? boss5Frames
    : useBoss4Sheet
      ? boss4Frames
      : useBoss3Sheet
        ? boss3Frames
        : useBoss2Sheet
          ? boss2Frames
          : useBoss1Sheet
            ? boss1Frames
            : undefined;
  const activeSprite = useBoss5Sheet
    ? boss5Frames[
        getBoss5FrameIndex(
          b.state,
          b.attackKind,
          b.animTime,
          b.stateTimer,
          b.z,
          b.vz,
          b.phase
        )
      ]
    : useBoss4Sheet
      ? boss4Frames[
          getBoss4FrameIndex(
            b.state,
            b.attackKind,
            b.animTime,
            b.stateTimer,
            b.z,
            b.vz
          )
        ]
      : useBoss3Sheet
        ? boss3Frames[
            getBoss3FrameIndex(
              b.state,
              b.attackKind,
              b.animTime,
              b.stateTimer,
              b.z,
              b.vz
            )
          ]
        : useBoss2Sheet
          ? boss2Frames[
              getBoss2FrameIndex(
                b.state,
                b.attackKind,
                b.animTime,
                b.stateTimer,
                b.z,
                b.vz
              )
            ]
          : useBoss1Sheet
            ? boss1Frames[
                getBoss1FrameIndex(
                  b.state,
                  b.attackKind,
                  b.animTime,
                  b.stateTimer,
                  b.z,
                  b.vz
                )
              ]
            : bossSprite;

  ctx.save();
  if (b.defId === 4 && !useBoss4Sheet && b.visibleTimer <= 0 && b.state !== 'ko') {
    ctx.globalAlpha = 0.42;
  }
  ctx.translate(sx, Math.round(sy - iz));
  ctx.scale(b.facing * b.squashX, b.squashY);

  if (b.state === 'knockdown' || b.state === 'ko') {
    if (!useSheet) {
      ctx.translate(0, -24);
      ctx.rotate(-Math.PI / 2);
    }
  } else if (!useSheet) {
    if (b.state === 'chase') {
      ctx.translate(0, -Math.abs(Math.sin(b.animTime * 7.5)) * 4.5);
      ctx.rotate(Math.sin(b.animTime * 7.5) * 0.035);
    } else if (b.state === 'telegraph') {
      ctx.scale(1.06, 0.93);
      ctx.rotate(-0.07);
    } else if (b.state === 'attack') {
      ctx.translate(10, 0);
      ctx.rotate(0.11);
      ctx.scale(1.08, 0.94);
    } else if (b.state === 'hurt') {
      ctx.rotate(-0.12);
    }
  } else {
    // Crisp micro-lean only for active dash charges on 16-frame sprite-sheet bosses
    if (b.state === 'attack' && (b.attackKind === 'shoulderCharge' || b.attackKind === 'radioDash')) {
      ctx.rotate(0.06);
    }
  }

  const hitWhite = b.hitFlashTimer > 0;
  if (b.state === 'telegraph') {
    const telegraph = bossTelegraphStyle(b.attackKind);
    ctx.fillStyle = `${telegraph.color}55`;
    ctx.beginPath();
    const pulse = 1 + Math.sin(timeSec * 18) * 0.08;
    ctx.ellipse(0, -76, 48 * pulse, 76 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = telegraph.color;
    ctx.lineWidth = 3;
    ctx.setLineDash(b.attackKind === 'soundPush' || b.attackKind === 'fireWave' || b.attackKind === 'contractRain' ? [8, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (activeSprite) {
    const phaseScale = b.defId === 5 ? (b.phase === 3 ? 1.12 : b.phase === 2 ? 1.06 : 1) : 1;
    if (b.defId === 5 && (b.phase >= 2 || b.state === 'phaseTransition')) {
      ctx.fillStyle = b.phase === 3 ? 'rgba(193,18,31,0.44)' : 'rgba(193,18,31,0.28)';
      ctx.beginPath();
      ctx.ellipse(
        0,
        -82,
        52 * phaseScale,
        (84 + Math.sin(timeSec * 7) * 5) * phaseScale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (b.defId === 4 && !useBoss4Sheet && b.visibleTimer <= 0) {
      ctx.fillStyle = 'rgba(25,227,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(0, -70, 40, 70, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const baseHeightRef = activeSheet ? activeSheet[0].height : activeSprite.height;
    const scale = (activeSprite.targetHeightPx * phaseScale) / Math.max(1, baseHeightRef);
    const drawSource = hitWhite ? activeSprite.flashCanvas : activeSprite.canvas;
    ctx.drawImage(
      drawSource,
      Math.round(-activeSprite.ax * scale),
      Math.round(-activeSprite.ay * scale),
      Math.round(activeSprite.width * scale),
      Math.round(activeSprite.height * scale)
    );
  } else {
    const demon = b.defId === 5 && b.phase >= 2;
    drawOutlinedRect(ctx, -20, -110, 40, 110, hitWhite ? '#FFFFFF' : demon ? '#7F1D1D' : '#334155');
  }

  ctx.restore();

  if (!reduceEffects && b.state !== 'ko') {
    enqueueDynamicCharacterLight(
      ix,
      sx,
      sy,
      iz,
      activeSprite?.targetHeightPx ?? 150,
      theme,
      timeSec,
      b.state === 'telegraph'
        ? bossTelegraphStyle(b.attackKind).color
        : b.defId === 5 && b.phase >= 2
        ? PALETTE.demonRed
        : undefined,
      b.defId === 5 ? 0.45 : b.state === 'telegraph' ? 0.42 : 0.15
    );
  }

  if (b.state === 'telegraph') {
    const telegraph = bossTelegraphStyle(b.attackKind);
    const unblockable =
      b.attackKind === 'soundPush' ||
      b.attackKind === 'fireWave' ||
      b.attackKind === 'contractRain' ||
      b.attackKind === 'stompWave';
    ctx.fillStyle = telegraph.color;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = PALETTE.night;
    ctx.lineWidth = 4;
    const label = unblockable
      ? `${telegraph.symbol} ¡IMBLOQUEABLE! ${telegraph.symbol}`
      : `${telegraph.symbol} ${telegraph.label}`;
    ctx.strokeText(label, sx, sy - iz - 156);
    ctx.fillText(label, sx, sy - iz - 156);
  } else if (b.state === 'recover' || b.state === 'hurt') {
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = PALETTE.night;
    ctx.lineWidth = 3;
    ctx.strokeText('VULNERABLE', sx, sy - iz - 148);
    ctx.fillText('VULNERABLE', sx, sy - iz - 148);
  }

  if (debugHitboxes) {
    ctx.strokeStyle = '#FFD23F';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 28, sy - iz - 126, 56, 126);
  }
}

function drawBreakable(
  ctx: CanvasRenderingContext2D,
  b: BreakableEntity,
  cameraX: number,
  sprite?: ProcessedPixelSprite
): void {
  const sx = Math.round(b.x) - cameraX;
  const sy = Math.round(b.y);
  if (sx < -100 || sx > LOGICAL_WIDTH + 100) return;

  const flash = b.hitFlashTimer > 0;
  ctx.save();
  ctx.translate(sx, sy);

  if (sprite) {
    const scale = sprite.targetHeightPx / sprite.height;
    const drawSource = flash ? sprite.flashCanvas : sprite.canvas;
    ctx.drawImage(
      drawSource,
      Math.round(-sprite.ax * scale),
      Math.round(-sprite.ay * scale),
      Math.round(sprite.width * scale),
      Math.round(sprite.height * scale)
    );
    ctx.restore();
    return;
  }

  drawOutlinedRect(ctx, -18, -46, 36, 46, flash ? '#FFFFFF' : '#92400E');
  ctx.restore();
}

function drawPickup(
  ctx: CanvasRenderingContext2D,
  pk: PickupEntity,
  ix: number,
  iy: number,
  iz: number,
  cameraX: number,
  timeSec: number,
  sprite?: ProcessedPixelSprite
): void {
  const sx = Math.round(ix) - cameraX;
  const sy = Math.round(iy);
  if (sx < -70 || sx > LOGICAL_WIDTH + 70) return;

  const bob = Math.sin(timeSec * 5 + pk.bobPhase) * 4;
  const isWeapon =
    pk.type === 'tubo' || pk.type === 'bate' || pk.type === 'botella' || pk.type === 'cadena';
  const label = isWeapon
    ? WEAPON_STATS[pk.type as WeaponType].label
    : ITEM_STATS[pk.type as Exclude<PickupEntity['type'], WeaponType>].label;
  const labelColor = isWeapon
    ? PALETTE.yellow
    : ITEM_STATS[pk.type as Exclude<PickupEntity['type'], WeaponType>].color;

  ctx.save();

  if (sprite) {
    const drawY = Math.round(sy - iz - 6 + bob);
    ctx.translate(sx, drawY);

    ctx.fillStyle =
      isWeapon || pk.type === 'disco' || pk.type === '1up'
        ? 'rgba(255, 210, 63, 0.24)'
        : 'rgba(124, 255, 79, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, -sprite.targetHeightPx * 0.45, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const scale = sprite.targetHeightPx / sprite.height;
    ctx.drawImage(
      sprite.canvas,
      Math.round(-sprite.ax * scale),
      Math.round(-sprite.ay * scale),
      Math.round(sprite.width * scale),
      Math.round(sprite.height * scale)
    );

    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = PALETTE.night;
    ctx.lineWidth = 3;
    ctx.strokeText(label, 0, -sprite.targetHeightPx - 5);
    ctx.fillStyle = labelColor;
    ctx.fillText(label, 0, -sprite.targetHeightPx - 5);
    ctx.restore();
    return;
  }

  ctx.translate(sx, Math.round(sy - iz - 12 + bob));
  drawOutlinedRect(ctx, -12, -10, 24, 20, labelColor);
  ctx.fillStyle = labelColor;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, -16);
  ctx.restore();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  pr: ProjectileEntity,
  ix: number,
  iy: number,
  iz: number,
  cameraX: number,
  timeSec: number
): void {
  const sx = Math.round(ix - cameraX);
  const sy = Math.round(iy);
  ctx.save();
  ctx.translate(sx, Math.round(sy - iz));
  ctx.rotate(timeSec * 10);
  if (pr.kind === 'pan') {
    drawOutlinedRect(ctx, -9, -9, 18, 18, '#64748B');
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(8, -2, 10, 4);
  } else if (pr.kind === 'contract' || pr.kind === 'contractBeam') {
    drawOutlinedRect(ctx, -11, -7, 22, 14, '#FEE2E2');
    ctx.fillStyle = PALETTE.demonRed;
    ctx.fillRect(-7, -2, 14, 4);
  } else if (pr.kind === 'phone') {
    drawOutlinedRect(ctx, -6, -10, 12, 20, '#1E293B');
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(-4, -7, 8, 14);
  } else if (pr.kind === 'note') {
    ctx.fillStyle = PALETTE.graffiti;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(4, -14, 4, 14);
  } else {
    ctx.fillStyle = PALETTE.demonRed;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.yellow;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHazardZone(
  ctx: CanvasRenderingContext2D,
  h: HazardZone,
  cameraX: number,
  timeSec: number
): void {
  const sx = Math.round(h.x - cameraX);
  const sy = Math.round(h.y);
  const progress = 1 - Math.max(0, h.timer) / h.maxTimer;
  const hazardColor = h.kind === 'shockwave' ? PALETTE.yellow : h.kind === 'enVivo' ? PALETTE.magenta : PALETTE.cyan;
  ctx.save();
  ctx.strokeStyle = hazardColor;
  ctx.lineWidth = 3;
  ctx.fillStyle = h.kind === 'shockwave' ? 'rgba(255,210,63,0.22)' : h.kind === 'enVivo' ? 'rgba(232,59,255,0.2)' : 'rgba(25,227,255,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, h.radius, h.radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(sx, sy, h.radius * progress, h.radius * 0.42 * progress, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  if (h.kind === 'enVivo') {
    ctx.fillStyle = Math.sin(timeSec * 10) > 0 ? '#FFFFFF' : PALETTE.yellow;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◎ EN VIVO', sx, sy - 6);
  } else if (h.kind === 'contractRain') {
    const fallZ = Math.max(0, (1 - progress) * 260);
    drawOutlinedRect(ctx, sx - 12, sy - fallZ - 20, 24, 30, '#FEF2F2');
    ctx.fillStyle = PALETTE.demonRed;
    ctx.fillRect(sx - 8, sy - fallZ - 8, 16, 4);
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('✦', sx, sy - fallZ - 28);
  } else if (h.kind === 'shockwave') {
    ctx.fillStyle = PALETTE.yellow;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◎', sx, sy - 10);
  }
  ctx.restore();
}

const BOLT_SEGS = 5;
const boltPtsX = new Float32Array(BOLT_SEGS + 1);
const boltPtsY = new Float32Array(BOLT_SEGS + 1);

function drawSpecialEffect(
  ctx: CanvasRenderingContext2D,
  fx: RenderWorldState['specialFx'],
  cameraX: number
): void {
  const sx = Math.round(fx.x - cameraX);
  const sy = Math.round(fx.y);
  const t = Math.max(0, Math.min(1, 1 - fx.timer / Math.max(0.01, fx.maxTimer)));
  const fade = Math.max(0, 1 - Math.pow(t, 1.8));

  ctx.save();
  if (fx.charId === 'bayron') {
    // DEMBOW TOTAL: Seismic street cracks + additive crimson/gold EQ pillars & dual shockwaves
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const yellowGlow = getCharacterLightSprite(PALETTE.yellow);
    const magentaGlow = getCharacterLightSprite(PALETTE.magenta);
    if (magentaGlow) {
      const rx = 210 * (0.45 + t * 0.55);
      const ry = 115 * (0.45 + t * 0.55);
      ctx.globalAlpha = 0.42 * fade;
      ctx.drawImage(magentaGlow, sx - rx, sy - 12 - ry, rx * 2, ry * 2);
    }
    if (yellowGlow) {
      const rx = 140 * (0.4 + t * 0.6);
      const ry = 85 * (0.4 + t * 0.6);
      ctx.globalAlpha = 0.52 * fade;
      ctx.drawImage(yellowGlow, sx - rx, sy - 20 - ry, rx * 2, ry * 2);
    }

    // Vertical heat / bass energy column
    const colW = 72 * (1 - t * 0.35);
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillRect(sx - colW, sy - 240, colW * 2, 250);
    ctx.globalAlpha = 0.32 * fade;
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(sx - colW * 0.45, sy - 240, colW * 0.9, 250);
    ctx.restore();

    // 8 radial street fracture cracks
    const crackReach = 40 + t * 145;
    ctx.globalAlpha = fade * 0.9;
    for (let c = 0; c < 8; c++) {
      const ang = (c / 8) * Math.PI * 2 + 0.18;
      const mx = sx + Math.cos(ang) * crackReach * 0.55;
      const my = sy + Math.sin(ang) * crackReach * 0.23;
      const ex = sx + Math.cos(ang + (c % 2 === 0 ? 0.14 : -0.14)) * crackReach;
      const ey = sy + Math.sin(ang + (c % 2 === 0 ? 0.14 : -0.14)) * crackReach * 0.42;

      ctx.strokeStyle = '#0B0F1E';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = c % 2 === 0 ? PALETTE.yellow : PALETTE.magenta;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Dual staggered expanding bass rings
    for (let r = 0; r < 3; r++) {
      const phase = Math.max(0, t - r * 0.14);
      if (phase <= 0) continue;
      const rad = 18 + phase * 185;
      ctx.globalAlpha = Math.max(0, 1 - phase * 1.15);
      ctx.strokeStyle = r === 0 ? '#FFFFFF' : r === 1 ? PALETTE.yellow : PALETTE.magenta;
      ctx.lineWidth = r === 0 ? 3 : 6;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rad, rad * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 10 rising EQ bass pillars orbiting shockwave perimeter
    ctx.globalAlpha = fade * 0.9;
    for (let b = 0; b < 10; b++) {
      const ang = (b / 10) * Math.PI * 2 + t * 1.4;
      const orbitR = 45 + t * 120;
      const bx = Math.round(sx + Math.cos(ang) * orbitR);
      const by = Math.round(sy + Math.sin(ang) * orbitR * 0.42);
      const bh = Math.round((24 + Math.abs(Math.sin(t * 14 + b)) * 46) * fade);
      if (bh <= 2) continue;
      ctx.fillStyle = b % 2 === 0 ? PALETTE.yellow : PALETTE.magenta;
      ctx.fillRect(bx - 4, by - bh, 8, bh);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - 4, by - bh - 3, 8, 3);
    }
  } else if (fx.charId === 'marcianeke') {
    // AUTOTUNE LETAL: Electric plasma core + sonic rings + jagged multi-segment lightning bolts
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cyanGlow = getCharacterLightSprite(PALETTE.cyan);
    const whiteGlow = getCharacterLightSprite('#FFFFFF');
    if (cyanGlow) {
      ctx.globalAlpha = 0.58 * fade;
      ctx.drawImage(cyanGlow, sx - 185, sy - 54 - 185, 370, 370);
    }
    if (whiteGlow) {
      ctx.globalAlpha = 0.55 * fade;
      ctx.drawImage(whiteGlow, sx - 90, sy - 54 - 90, 180, 180);
    }

    // Tilted ultrasonic soundwave rings
    for (let w = 0; w < 3; w++) {
      const wt = Math.max(0, t - w * 0.12);
      if (wt <= 0) continue;
      const rx = 28 + wt * 155;
      const ry = rx * 0.46;
      ctx.save();
      ctx.translate(sx, sy - 52);
      ctx.rotate((w - 1) * 0.36 + t * 1.8);
      ctx.globalAlpha = Math.max(0, (1 - wt) * 0.9);
      ctx.strokeStyle = w % 2 === 0 ? PALETTE.cyan : '#FFFFFF';
      ctx.lineWidth = w === 0 ? 4 : 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 8 jagged fractal lightning bolts terminating in star impact nodes (zero-alloc point buffer)
    boltPtsX[0] = sx;
    boltPtsY[0] = sy - 52;
    ctx.lineJoin = 'miter';
    for (let b = 0; b < 8; b++) {
      const ang = (b / 8) * Math.PI * 2 + t * 2.4;
      const reach = 95 + Math.sin(t * 16 + b) * 35 + t * 55;
      const ex = sx + Math.cos(ang) * reach;
      const ey = sy - 38 + Math.sin(ang) * reach * 0.48;
      for (let s = 1; s < BOLT_SEGS; s++) {
        const frac = s / BOLT_SEGS;
        const jx = Math.sin(t * 42 + b * 7.3 + s * 5.1) * 20;
        const jy = Math.cos(t * 38 + b * 4.9 + s * 6.7) * 14;
        boltPtsX[s] = sx + (ex - sx) * frac + jx;
        boltPtsY[s] = sy - 52 + (ey - (sy - 52)) * frac + jy;
      }
      boltPtsX[BOLT_SEGS] = ex;
      boltPtsY[BOLT_SEGS] = ey;

      // Outer neon cyan plasma glow pass
      ctx.globalAlpha = fade * 0.6;
      ctx.strokeStyle = b % 2 === 0 ? PALETTE.cyan : PALETTE.magenta;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(boltPtsX[0], boltPtsY[0]);
      for (let s = 1; s <= BOLT_SEGS; s++) ctx.lineTo(boltPtsX[s], boltPtsY[s]);
      ctx.stroke();

      // Inner razor white electric core
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Terminal electric star impact flare
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(Math.round(ex) - 7, Math.round(ey) - 1, 14, 3);
      ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 7, 3, 14);
    }
    ctx.restore();
  } else {
    // LLUVIA DE BILLETES: Golden spotlight cone + rotating VIP rune seal + cyclone vortex ribbons + swirling banknotes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spotGrad = ctx.createLinearGradient(sx, sy - 260, sx, sy + 20);
    spotGrad.addColorStop(0, 'rgba(255, 210, 63, 0)');
    spotGrad.addColorStop(0.55, 'rgba(255, 210, 63, 0.24)');
    spotGrad.addColorStop(1, 'rgba(34, 197, 94, 0.34)');
    ctx.globalAlpha = fade;
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.moveTo(sx - 55, sy - 260);
    ctx.lineTo(sx + 55, sy - 260);
    ctx.lineTo(sx + 165, sy + 22);
    ctx.lineTo(sx - 165, sy + 22);
    ctx.closePath();
    ctx.fill();

    // Expanding rotating gold & magenta VIP star seal on the ground
    const sealR = 45 + Math.min(1, t * 2.2) * 110;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.44);
    ctx.rotate(t * 2.5);
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = PALETTE.yellow;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, sealR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.magenta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, sealR * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // 8-point geometric star crest inside seal
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    for (let sq = 0; sq < 2; sq++) {
      ctx.save();
      ctx.rotate((sq * Math.PI) / 4);
      const side = sealR * 0.68;
      ctx.strokeRect(-side, -side, side * 2, side * 2);
      ctx.restore();
    }
    ctx.restore();

    // Swirling golden cyclone helices rising around Cris MJ
    ctx.globalAlpha = fade * 0.85;
    for (let h = 0; h < 2; h++) {
      ctx.strokeStyle = h === 0 ? PALETTE.yellow : '#4ADE80';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let step = 0; step <= 24; step++) {
        const frac = step / 24;
        const ang = frac * Math.PI * 3.5 + t * 8 + h * Math.PI;
        const rad = 32 + frac * 105;
        const px = sx + Math.cos(ang) * rad;
        const py = sy - frac * 165 + Math.sin(ang) * 18;
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 10 orbiting crisp banknotes spinning through the cyclone
    ctx.globalAlpha = fade;
    for (let b = 0; b < 10; b++) {
      const ang = (b / 10) * Math.PI * 2 + t * 6.5;
      const rad = 55 + ((b * 17) % 85);
      const bx = Math.round(sx + Math.cos(ang) * rad);
      const by = Math.round(sy - 20 - ((b * 23 + t * 140) % 145) + Math.sin(ang) * 16);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.sin(t * 10 + b) * 0.55);
      ctx.fillStyle = '#052E16';
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = b % 3 === 0 ? PALETTE.yellow : '#22C55E';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-2, -3, 4, 6);
      ctx.restore();
    }
  }
  ctx.restore();
}

const floatingFontCache = new Map<number, string>();

function getFloatingFont(px: number): string {
  let font = floatingFontCache.get(px);
  if (!font) {
    font = `bold ${px}px monospace`;
    floatingFontCache.set(px, font);
  }
  return font;
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], cameraX: number): void {
  let ringLineSet = false;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    const sx = Math.round(p.x - cameraX);
    const sy = Math.round(p.y - p.z);
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;

    if (p.kind === 'ring') {
      if (!ringLineSet) {
        ctx.lineWidth = 3;
        ringLineSet = true;
      }
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * (1.8 - alpha), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'bill') {
      const w = Math.max(12, Math.round(p.size * 2.1));
      const h = Math.max(7, Math.round(p.size * 1.1));
      const ang = Math.sin(p.life * 13 + p.x * 0.1) * 0.45;
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = '#052E16';
      ctx.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-2, -h / 2 + 1, 4, h - 2);
      ctx.rotate(-ang);
      ctx.translate(-sx, -sy);
    } else if (p.kind === 'star') {
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size, sy - 2, p.size * 2, 4);
      ctx.fillRect(sx - 2, sy - p.size, 4, p.size * 2);
    } else if (p.kind === 'blood') {
      if (p.z <= 2) {
        const splatW = Math.max(4, Math.round(p.size * 1.6));
        const splatH = Math.max(2, Math.round(p.size * 0.75));
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(sx - Math.round(splatW / 2), sy - Math.round(splatH / 2), splatW, splatH);
        ctx.fillStyle = p.color;
        ctx.fillRect(
          sx - Math.round(splatW / 3),
          sy - Math.round(splatH / 3),
          Math.max(2, Math.round(splatW * 0.66)),
          Math.max(2, Math.round(splatH * 0.66))
        );
      } else {
        const ang = Math.atan2(-p.vz, p.vx);
        const len = Math.max(5, Math.round(p.size * 1.55));
        const thick = Math.max(3, Math.round(p.size * 0.78));
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = '#450A0A';
        ctx.fillRect(-Math.round(len / 2) - 1, -Math.round(thick / 2) - 1, len + 2, thick + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-Math.round(len / 2), -Math.round(thick / 2), len, thick);
        ctx.rotate(-ang);
        ctx.translate(-sx, -sy);
      }
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
  cameraX: number
): void {
  let initialized = false;
  let lastFontPx = -1;
  for (let i = 0; i < texts.length; i++) {
    const ft = texts[i];
    if (!ft.active) continue;
    if (!initialized) {
      initialized = true;
      ctx.textAlign = 'center';
      ctx.strokeStyle = PALETTE.night;
      ctx.lineWidth = 4;
    }
    const sx = Math.round(ft.x - cameraX);
    const sy = Math.round(ft.y - ft.z);
    ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
    const fontPx = Math.round(16 * ft.scale);
    if (fontPx !== lastFontPx) {
      lastFontPx = fontPx;
      ctx.font = getFloatingFont(fontPx);
    }
    ctx.strokeText(ft.text, sx, sy);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, sx, sy);
  }
  if (initialized) {
    ctx.globalAlpha = 1;
  }
}
