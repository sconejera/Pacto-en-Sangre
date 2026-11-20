import {
  CHARACTERS,
  DEPTH_TOLERANCE_Y,
  ENEMY_BASE_STATS,
  LEVEL_SCALING,
  WALK_MAX_Y,
  WALK_MIN_Y,
  WEAPON_STATS,
} from './data';
import type {
  AttackFrameData,
  BossAttackKind,
  BossEntity,
  CharacterId,
  EnemyEntity,
  EnemyType,
  WeaponType,
  WaveSpawn,
} from './types';

export interface BoxXZ {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
}

/**
 * Comprueba colisión 2.5D: |Δy| <= profundidad (por defecto 22 px) y solapamiento en (x, z).
 * x es el centro horizontal; z es la altura desde el suelo (>= 0, hacia arriba).
 */
export function checkHitbox25D(
  attacker: BoxXZ,
  defender: BoxXZ,
  depthTolerance = DEPTH_TOLERANCE_Y
): boolean {
  return overlapsHitbox25D(
    attacker.x,
    attacker.y,
    attacker.z,
    attacker.w,
    attacker.h,
    defender.x,
    defender.y,
    defender.z,
    defender.w,
    defender.h,
    depthTolerance
  );
}

/**
 * Zero-allocation 2.5D hitbox test for hot 60 FPS combat loops.
 */
export function overlapsHitbox25D(
  ax: number,
  ay: number,
  az: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bz: number,
  bw: number,
  bh: number,
  depthTolerance = DEPTH_TOLERANCE_Y
): boolean {
  if (Math.abs(ay - by) > depthTolerance) return false;
  const halfAw = aw * 0.5;
  const halfBw = bw * 0.5;
  if (ax + halfAw < bx - halfBw || ax - halfAw > bx + halfBw) return false;
  return az + ah >= bz && az <= bz + bh;
}

export function clampWalkY(y: number): number {
  return Math.max(WALK_MIN_Y, Math.min(WALK_MAX_Y, y));
}

export function scaleEnemyStats(
  type: EnemyType,
  levelNumber: 1 | 2 | 3 | 4 | 5
): { hp: number; damage: number; speed: number; telegraphTime: number; score: number } {
  const base = ENEMY_BASE_STATS[type];
  const scale = LEVEL_SCALING[levelNumber];
  return {
    hp: Math.round(base.hp * scale.hpMul),
    damage: Math.round(base.damage * scale.dmgMul),
    speed: base.speed,
    telegraphTime: base.telegraphTime,
    score: base.score,
  };
}

export function canActivateSpecial(hp: number, specialCooldown: number): boolean {
  return hp > 8 && specialCooldown <= 0;
}

export function applySpecialCost(hp: number, hitCount: number): number {
  if (hitCount <= 0) return hp;
  // Nunca mata al jugador ni deja <= 0 si tenía > 8
  return Math.max(1, hp - 8);
}

export function getPlayerAttackDamage(
  charId: CharacterId,
  comboStep: 1 | 2 | 3,
  weapon: WeaponType | null
): number {
  if (weapon) {
    return WEAPON_STATS[weapon].damage;
  }
  return CHARACTERS[charId].comboDamage[comboStep - 1];
}

export function recordEnemyHitAndCheckKnockdown(
  recentTimestamps: number[],
  nowSec: number
): { updated: number[]; shouldKnockdown: boolean } {
  const filtered = recentTimestamps.filter((t) => nowSec - t <= 2.0);
  filtered.push(nowSec);
  if (filtered.length >= 3) {
    return { updated: [], shouldKnockdown: true };
  }
  return { updated: filtered, shouldKnockdown: false };
}

/**
 * Zero-allocation in-place variant of recordEnemyHitAndCheckKnockdown for hot combat paths.
 */
export function recordEnemyHitAndCheckKnockdownInPlace(
  recentTimestamps: number[],
  nowSec: number
): boolean {
  let write = 0;
  for (let i = 0; i < recentTimestamps.length; i++) {
    const t = recentTimestamps[i];
    if (nowSec - t <= 2.0) {
      recentTimestamps[write++] = t;
    }
  }
  recentTimestamps.length = write;
  recentTimestamps.push(nowSec);
  if (recentTimestamps.length >= 3) {
    recentTimestamps.length = 0;
    return true;
  }
  return false;
}

export function countActiveAttackers(enemies: Pick<EnemyEntity, 'state'>[]): number {
  let count = 0;
  for (const e of enemies) {
    if (e.state === 'telegraph' || e.state === 'attack') count++;
  }
  return count;
}

export function canRequestAttackToken(
  enemies: Pick<EnemyEntity, 'state'>[],
  maxTokens: number
): boolean {
  return countActiveAttackers(enemies) < maxTokens;
}

export function countCrossedExtraLives(prevScore: number, nextScore: number): number {
  const thresholds = [50000, 150000];
  let gained = 0;
  for (const t of thresholds) {
    if (prevScore < t && nextScore >= t) gained++;
  }
  return gained;
}

export function computeLevelResults(params: {
  levelNumber: number;
  elapsedSec: number;
  remainingHp: number;
  damageTakenOnBoss: number;
  score: number;
}): {
  timeBonus: number;
  hpBonus: number;
  noDamageBossBonus: number;
  totalScore: number;
} {
  // Objetivo 4-6 min => bonus máximo bajo 240s, decae suavemente hasta 480s
  const targetSec = 240 + params.levelNumber * 20;
  const timeBonus = Math.max(200, Math.round(Math.max(0, targetSec - params.elapsedSec) * 15));
  const hpBonus = Math.max(0, Math.round(params.remainingHp) * 20);
  const noDamageBossBonus = params.damageTakenOnBoss === 0 ? 5000 : 0;
  return {
    timeBonus,
    hpBonus,
    noDamageBossBonus,
    totalScore: params.score + timeBonus + hpBonus + noDamageBossBonus,
  };
}

export function applyAdaptiveDifficultyToSpawns(
  spawns: WaveSpawn[],
  playerLostLifeInZone: boolean
): { spawns: WaveSpawn[]; bonusFood: boolean } {
  if (!playerLostLifeInZone) {
    return { spawns: spawns.map((s) => ({ ...s })), bonusFood: false };
  }
  const cloned = spawns.map((s) => ({ ...s }));
  const total = cloned.reduce((acc, s) => acc + s.count, 0);
  if (total > 1) {
    for (let i = cloned.length - 1; i >= 0; i--) {
      if (cloned[i].count > 1) {
        cloned[i].count -= 1;
        break;
      }
    }
  }
  return { spawns: cloned, bonusFood: true };
}

export function formatTimeMMSS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function lerp(prev: number, curr: number, alpha: number): number {
  return prev + (curr - prev) * Math.max(0, Math.min(1, alpha));
}

export function stepCameraTowards(
  current: number,
  target: number,
  dt: number,
  speed = 11
): number {
  const diff = target - current;
  if (Math.abs(diff) <= 0.35) return target;
  return current + diff * Math.min(1, dt * speed);
}

/**
 * Resolves locked arena horizontal bounds without ever rewinding cameraX backward.
 */
export function resolveZoneArenaBounds(
  currentCamX: number,
  zoneArenaLeft: number,
  zoneArenaRight: number,
  logicalWidth: number,
  levelWidth: number
): { arenaLeft: number; arenaRight: number; needsGlide: boolean } {
  const maxStart = Math.max(0, levelWidth - logicalWidth);
  const arenaLeft = Math.min(maxStart, Math.max(currentCamX, zoneArenaLeft));
  const arenaRight = Math.min(
    levelWidth,
    Math.max(arenaLeft + logicalWidth, zoneArenaRight)
  );
  return {
    arenaLeft,
    arenaRight,
    needsGlide: arenaLeft - currentCamX > 0.5,
  };
}

export function pickNextTrackFromDeck(
  allTracks: readonly string[],
  remainingDeck: string[],
  lastPlayed: string | null,
  rng: () => number = Math.random
): { track: string; nextDeck: string[] } {
  if (allTracks.length === 0) {
    return { track: '', nextDeck: [] };
  }
  let pool = remainingDeck.filter((t) => allTracks.includes(t));
  if (pool.length === 0) {
    pool = [...allTracks];
  }
  const nonRepeating = pool.length > 1 && lastPlayed ? pool.filter((t) => t !== lastPlayed) : pool;
  const candidates = nonRepeating.length > 0 ? nonRepeating : pool;
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  const track = candidates[idx];
  const nextDeck = pool.filter((t) => t !== track);
  return { track, nextDeck };
}

export function findTrimmedSampleRange(
  samples: Float32Array,
  threshold = 0.012
): { start: number; end: number } {
  const len = samples.length;
  if (len === 0) return { start: 0, end: 0 };
  let start = 0;
  while (start < len && Math.abs(samples[start]) < threshold) {
    start++;
  }
  if (start >= len) {
    return { start: 0, end: len };
  }
  let end = len;
  while (end > start + 1 && Math.abs(samples[end - 1]) < threshold) {
    end--;
  }
  return { start, end };
}

/**
 * Normalizes 2D movement input so diagonal motion never exceeds 1.0x speed.
 */
export function normalizeMoveAxesInto(
  out: { nx: number; ny: number },
  mx: number,
  my: number
): void {
  if (mx === 0 && my === 0) {
    out.nx = 0;
    out.ny = 0;
    return;
  }
  const mag = Math.hypot(mx, my);
  if (mag <= 1) {
    out.nx = mx;
    out.ny = my;
    return;
  }
  out.nx = mx / mag;
  out.ny = my / mag;
}

/**
 * Normalizes 2D movement input so diagonal motion never exceeds 1.0x speed.
 */
export function normalizeMoveAxes(mx: number, my: number): { nx: number; ny: number } {
  const out = { nx: 0, ny: 0 };
  normalizeMoveAxesInto(out, mx, my);
  return out;
}

export function stepVelocity2DInto(
  out: { vx: number; vy: number },
  vx: number,
  vy: number,
  targetVx: number,
  targetVy: number,
  accel: number,
  decel: number,
  dt: number
): void {
  const rateX = Math.abs(targetVx) > 0.01 ? accel : decel;
  const rateY = Math.abs(targetVy) > 0.01 ? accel : decel;

  const diffX = targetVx - vx;
  const maxStepX = rateX * dt;
  out.vx = Math.abs(diffX) <= maxStepX ? targetVx : vx + Math.sign(diffX) * maxStepX;

  const diffY = targetVy - vy;
  const maxStepY = rateY * dt;
  out.vy = Math.abs(diffY) <= maxStepY ? targetVy : vy + Math.sign(diffY) * maxStepY;
}

/**
 * Steps 2D velocity smoothly toward target using crisp acceleration and tighter deceleration.
 */
export function stepVelocity2D(
  vx: number,
  vy: number,
  targetVx: number,
  targetVy: number,
  accel: number,
  decel: number,
  dt: number
): { vx: number; vy: number } {
  const out = { vx: 0, vy: 0 };
  stepVelocity2DInto(out, vx, vy, targetVx, targetVy, accel, decel, dt);
  return out;
}

/**
 * Computes staggered horizontal & vertical street coordinates for enemy spawns
 * so enemies never pop in clumped or stacked on top of walls/each other.
 */
export function computeSpawnStagger(
  edge: 'left' | 'right' | 'sewer',
  spawnIdx: number,
  spawnTotal: number,
  cameraX: number,
  logicalWidth: number,
  walkMinY: number,
  walkMaxY: number,
  rng: () => number = Math.random
): { x: number; y: number } {
  const safeTotal = Math.max(1, spawnTotal);
  const laneMinY = walkMinY + 12;
  const laneMaxY = walkMaxY - 10;
  const laneSpan = Math.max(12, laneMaxY - laneMinY);
  const laneFrac = safeTotal === 1 ? 0.5 : (spawnIdx + 0.5) / safeTotal;
  const jitterY = (rng() - 0.5) * 14;
  const y = Math.max(laneMinY, Math.min(laneMaxY, Math.round(laneMinY + laneSpan * laneFrac + jitterY)));

  if (edge === 'sewer') {
    const minX = cameraX + 200;
    const maxX = cameraX + logicalWidth - 200;
    const xSpan = Math.max(80, maxX - minX);
    const fracX = safeTotal === 1 ? 0.5 : (spawnIdx + 0.5) / safeTotal;
    const jitterX = (rng() - 0.5) * 38;
    return {
      x: Math.round(Math.max(minX, Math.min(maxX, minX + xSpan * fracX + jitterX))),
      y,
    };
  }

  const staggerX = 24 + spawnIdx * 48;
  return {
    x: edge === 'left' ? Math.round(cameraX - staggerX) : Math.round(cameraX + logicalWidth + staggerX),
    y,
  };
}

/**
 * Computes directional ground shadow offset, stretch & opacity relative to the nearest stage light and jump altitude.
 */
export function computeDirectionalShadowInto(
  out: { offsetX: number; rx: number; ry: number; alpha: number },
  entityX: number,
  z: number,
  baseWidth: number,
  alphaMul: number,
  nearestLightX: number | null
): void {
  const heightScale = Math.max(0.55, 1 - (z / 160) * 0.45);
  const alpha = Math.max(0.18 * alphaMul, 0.46 * alphaMul * (1 - z / 400));

  let offsetX = 0;
  let stretch = 1;
  if (nearestLightX !== null) {
    const dx = entityX - nearestLightX;
    const clampedDx = Math.max(-220, Math.min(220, dx));
    offsetX = Math.round(clampedDx * 0.08);
    stretch = 1 + (Math.abs(clampedDx) / 220) * 0.18;
  }

  out.offsetX = offsetX;
  out.rx = Math.max(6, Math.round(baseWidth * 0.5 * heightScale * stretch));
  out.ry = Math.max(4, Math.round(baseWidth * 0.16 * heightScale));
  out.alpha = alpha;
}

/**
 * Computes directional ground shadow offset, stretch & opacity relative to the nearest stage light and jump altitude.
 */
export function computeDirectionalShadow(
  entityX: number,
  z: number,
  baseWidth: number,
  alphaMul: number,
  nearestLightX: number | null
): {
  offsetX: number;
  rx: number;
  ry: number;
  alpha: number;
} {
  const out = { offsetX: 0, rx: 0, ry: 0, alpha: 0 };
  computeDirectionalShadowInto(out, entityX, z, baseWidth, alphaMul, nearestLightX);
  return out;
}

/**
 * Computes normalized [0..1] rhythmic title beat intensity from real FFT bass energy
 * with a crisp urban dembow BPM pulse fallback before audio autoplay unlocks.
 */
export function computeMusicBeatPulse(
  bassEnergy: number,
  timeSec: number,
  isMuted: boolean,
  bpm = 108
): number {
  if (isMuted) return 0;
  const clampedBass = Math.max(0, Math.min(1, bassEnergy));
  if (clampedBass > 0.025) {
    return clampedBass;
  }
  const beatsPerSec = Math.max(40, bpm) / 60;
  const phase = ((timeSec * beatsPerSec) % 1 + 1) % 1;
  const downbeat = Math.pow(Math.max(0, 1 - phase * 2.4), 2.1) * 0.78;
  const offbeatPhase = (phase + 0.375) % 1;
  const dembowKick = Math.pow(Math.max(0, 1 - offbeatPhase * 3.0), 2.4) * 0.42;
  return Math.max(0, Math.min(1, downbeat + dembowKick));
}

export interface TitleFireBeatMotion {
  heightScale: number;
  glowAlpha: number;
  flickerBoost: number;
  vibX: number;
  vibY: number;
}

/**
 * Computes beat-synchronized fire trail amplitude, glow, flicker rate, and pixel vibration.
 */
export function computeTitleFireBeatMotion(
  beatLevel: number,
  timeSec: number,
  reduceEffects: boolean
): TitleFireBeatMotion {
  if (reduceEffects) {
    return {
      heightScale: 1,
      glowAlpha: 0.72,
      flickerBoost: 1,
      vibX: 0,
      vibY: 0,
    };
  }
  const beat = Math.max(0, Math.min(1, beatLevel));
  const vibX = Math.round(Math.sin(timeSec * 36.0) * beat * 4.2);
  const vibY = Math.round(Math.cos(timeSec * 44.0) * beat * 3.4);
  return {
    heightScale: 1 + beat * 0.26,
    glowAlpha: Math.min(1, 0.72 + beat * 0.28),
    flickerBoost: 1 + beat * 1.4,
    vibX,
    vibY,
  };
}

/**
 * Computes proportional crop + left mirrored alley extension so title art fills 100%
 * of the 16:9 frame without flat black margins or stretching.
 */
export function computeTitleBgCropLayout(
  srcW: number,
  srcH: number,
  activeStartX: number,
  dstW: number,
  dstH: number
): {
  activeStartX: number;
  activeW: number;
  mainDrawX: number;
  mainDrawW: number;
  leftFillW: number;
  leftSrcW: number;
} {
  const safeStartX = Math.max(0, Math.min(Math.floor(srcW * 0.45), activeStartX));
  const activeW = Math.max(1, srcW - safeStartX);
  const scale = dstH / Math.max(1, srcH);
  const mainDrawW = Math.min(dstW, Math.max(1, Math.round(activeW * scale)));
  const leftFillW = Math.max(0, dstW - mainDrawW);
  const leftSrcW = Math.min(activeW, Math.max(1, Math.round(leftFillW / Math.max(0.01, scale))));
  return {
    activeStartX: safeStartX,
    activeW,
    mainDrawX: leftFillW,
    mainDrawW,
    leftFillW,
    leftSrcW,
  };
}

/**
 * Preserves horizontal facing inside a small overlap deadzone so AI never flickers when crossing X.
 */
export function resolveDeadzoneFacing(
  dx: number,
  currentFacing: 1 | -1,
  deadzone = 8
): 1 | -1 {
  if (dx > deadzone) return 1;
  if (dx < -deadzone) return -1;
  return currentFacing;
}

/**
 * Syncs jump sprite pose with actual vertical arc instead of switching to landing crouch mid-ascent.
 */
export function computeJumpFrameIndex(z: number, vz: number): 4 | 5 {
  if (z <= 28 && vz < -180) return 4;
  return 5;
}

/**
 * Maps every movement, attack, transition, and damage state of Boss 5 (DISCOGRÁFICA INTERNACIONAL)
 * fluidly across all 16 frames of its 4x4 sprite sheet.
 */
export function getBoss5FrameIndex(
  state: BossEntity['state'],
  attackKind: BossAttackKind,
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number,
  phase: 1 | 2 | 3
): number {
  switch (state) {
    case 'idle':
    case 'intro':
      return Math.floor(animTime * 3.5) % 2 === 0 ? 0 : 1;
    case 'chase': {
      if (z > 10) return 5;
      const rate = phase >= 2 ? 9.5 : 7.5;
      const step = Math.floor(animTime * rate) % 4;
      if (step === 0) return 2;
      if (step === 1) return 3;
      if (step === 2) return phase >= 2 ? 7 : 2;
      return 0;
    }
    case 'recover':
      return stateTimer > 0.35 ? 7 : 0;
    case 'getup':
      return stateTimer > 0.12 ? 4 : 7;
    case 'telegraph':
      if (attackKind === 'fireWave') return 4;
      if (attackKind === 'shoulderCharge') {
        return Math.floor(animTime * 8) % 2 === 0 ? 4 : 6;
      }
      if (attackKind === 'contractSweep' || attackKind === 'contractRain') return 6;
      return 7;
    case 'attack': {
      if (attackKind === 'shoulderCharge') {
        if (stateTimer > 0.42) return 6;
        if (stateTimer > 0.14) return Math.floor(animTime * 12) % 2 === 0 ? 3 : 7;
        return 15;
      }
      if (attackKind === 'briefcaseSwing') {
        if (stateTimer > 0.3) return 8;
        if (stateTimer > 0.15) return 9;
        return 10;
      }
      if (attackKind === 'contractSweep') return 11;
      if (attackKind === 'fireWave') {
        return z > 14 ? 5 : 15;
      }
      if (attackKind === 'signatureGrab') {
        return stateTimer > 0.24 ? 7 : 8;
      }
      if (attackKind === 'contractRain') {
        return stateTimer > 0.28 ? 14 : 11;
      }
      return Math.floor(animTime * 10) % 2 === 0 ? 8 : 10;
    }
    case 'phaseTransition':
      if (z > 18 || vz > 40) return 5;
      if (stateTimer > 1.15) return 15;
      return 14;
    case 'hurt':
      return 12;
    case 'knockdown':
    case 'ko':
      return z > 20 && vz > 0 ? 12 : 13;
    default:
      return 0;
  }
}

/**
 * Maps every movement, telegraph, attack, hurt, and KO state of 16-frame sheet enemies
 * fluidly across all 16 frames [0..15] of their 4x4 sprite sheet.
 */
export function getEnemySheetFrameIndex(
  type: EnemyType,
  state: EnemyEntity['state'],
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number,
  attackId: number,
  fromSewer = false
): number {
  switch (state) {
    case 'entering':
      if (fromSewer) {
        if (stateTimer > 0.45) return 13;
        if (stateTimer > 0.25) return 4;
        return stateTimer > 0.1 ? 7 : 0;
      }
      return [7, 2, 7, 3][Math.floor(animTime * 9) % 4];
    case 'approach':
    case 'circle': {
      const step = Math.floor(animTime * 8.5) % 4;
      return step === 0 ? 2 : step === 1 ? 0 : step === 2 ? 3 : 1;
    }
    case 'fleeing': {
      const step = Math.floor(animTime * 11) % 4;
      return step === 0 ? 7 : step === 1 ? 2 : step === 2 ? 7 : 3;
    }
    case 'telegraph':
      return Math.floor(animTime * 7) % 2 === 0 ? 4 : 6;
    case 'attack': {
      if (type === 'cachorro') {
        if (stateTimer > 0.25) return 6;
        if (stateTimer > 0.14) return 7;
        return stateTimer > 0.06 ? 15 : 7;
      }
      if (attackId % 2 === 0) {
        if (stateTimer > 0.22) return 6;
        if (stateTimer > 0.14) return 8;
        return stateTimer > 0.06 ? 9 : 11;
      }
      if (stateTimer > 0.22) return 4;
      if (stateTimer > 0.14) return 10;
      return stateTimer > 0.06 ? 15 : 7;
    }
    case 'draining':
      return Math.floor(animTime * 6) % 2 === 0 ? 6 : 11;
    case 'hurt':
      return stateTimer > 0.2 ? 12 : 4;
    case 'stunned':
      return Math.floor(animTime * 12) % 2 === 0 ? 4 : 12;
    case 'knockdown':
    case 'ko':
    case 'thrown':
      if (z > 24 && vz > 40) return 5;
      if (z > 12) return 12;
      return 13;
    case 'getup':
      return stateTimer > 0.16 ? 13 : stateTimer > 0.08 ? 4 : 7;
    case 'recover':
      return stateTimer > 0.35 ? 14 : 6;
    case 'grabbed':
      return 12;
    default:
      return Math.floor(animTime * 3.5) % 2 === 0 ? 0 : 1;
  }
}

/**
 * Maps every movement, attack, hurt, and KO state of Boss 1 (TRONCO)
 * fluidly across all 16 frames [0..15] of its 4x4 sprite sheet.
 */
export function getBoss1FrameIndex(
  state: BossEntity['state'],
  attackKind: BossAttackKind,
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number
): number {
  switch (state) {
    case 'idle':
    case 'intro':
      return Math.floor(animTime * 3.5) % 2 === 0 ? 0 : 1;
    case 'chase': {
      if (z > 10) return 5;
      const step = Math.floor(animTime * 8) % 4;
      return step === 0 ? 2 : step === 1 ? 3 : step === 2 ? 7 : 0;
    }
    case 'recover':
      return stateTimer > 0.35 ? 7 : 0;
    case 'getup':
      return stateTimer > 0.16 ? 13 : stateTimer > 0.08 ? 4 : 7;
    case 'telegraph':
      return Math.floor(animTime * 6.5) % 2 === 0 ? 4 : 6;
    case 'attack':
      if (attackKind === 'doublePunch') {
        if (stateTimer > 0.28) return 8;
        if (stateTimer > 0.14) return 9;
        return 10;
      }
      if (attackKind === 'shoulderCharge') {
        if (stateTimer > 0.42) return 6;
        if (stateTimer > 0.14) return Math.floor(animTime * 12) % 2 === 0 ? 7 : 3;
        return 15;
      }
      if (attackKind === 'stompWave') {
        if (stateTimer > 0.26) return 5;
        if (stateTimer > 0.14) return 14;
        return 11;
      }
      if (attackKind === 'flyingKick') return 15;
      return Math.floor(animTime * 9) % 2 === 0 ? 8 : 10;
    case 'phaseTransition':
      return 14;
    case 'hurt':
      return 12;
    case 'knockdown':
    case 'ko':
      if (z > 24 && vz > 40) return 5;
      if (z > 12) return 12;
      return 13;
    default:
      return 0;
  }
}

function resolveRangedBossFrameIndex(
  state: BossEntity['state'],
  attackKind: BossAttackKind,
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number,
  chargeKind: BossAttackKind,
  specialKindA: BossAttackKind,
  specialKindB: BossAttackKind | null,
  specialAttackTimerThreshold: number
): number {
  switch (state) {
    case 'intro':
      return Math.floor(animTime * 4) % 2 === 0 ? 11 : 0;
    case 'idle':
      return Math.floor(animTime * 3.8) % 2 === 0 ? 0 : 1;
    case 'chase': {
      if (z > 10) return 5;
      const step = Math.floor(animTime * 9.5) % 4;
      if (step === 0) return 2;
      if (step === 1) return 3;
      if (step === 2) return 7;
      return 0;
    }
    case 'recover':
      return stateTimer > 0.4 ? 7 : 0;
    case 'getup':
      return stateTimer > 0.16 ? 13 : stateTimer > 0.08 ? 4 : 7;
    case 'telegraph':
      if (attackKind === 'flyingKick') return 4;
      if (attackKind === specialKindA || attackKind === specialKindB) return 11;
      if (attackKind === chargeKind) {
        return Math.floor(animTime * 8) % 2 === 0 ? 4 : 6;
      }
      if (attackKind === 'stompWave') return 6;
      return 7;
    case 'attack':
      if (attackKind === chargeKind) {
        if (stateTimer > 0.42) return 6;
        if (stateTimer > 0.14) return Math.floor(animTime * 14) % 2 === 0 ? 3 : 7;
        return 15;
      }
      if (attackKind === 'flyingKick') {
        if (z > 18 && vz > 40) return 5;
        if (stateTimer > 0.12) return 10;
        return 15;
      }
      if (attackKind === specialKindA || attackKind === specialKindB) {
        return stateTimer > specialAttackTimerThreshold ? 11 : 14;
      }
      if (attackKind === 'doublePunch') {
        if (stateTimer > 0.28) return 8;
        if (stateTimer > 0.14) return 9;
        return 10;
      }
      if (attackKind === 'stompWave') {
        return stateTimer > 0.22 ? 14 : 15;
      }
      return Math.floor(animTime * 10) % 2 === 0 ? 8 : 10;
    case 'phaseTransition':
      return 14;
    case 'hurt':
      return 12;
    case 'knockdown':
    case 'ko':
      if (z > 24 && vz > 40) return 5;
      if (z > 12) return 12;
      return 13;
    default:
      return 0;
  }
}

/**
 * Maps every movement, telegraph, attack, buff, hurt, and KO state of Boss 2
 * fluidly across all 16 frames [0..15] of its 4x4 sprite sheet.
 */
export function getBoss2FrameIndex(
  state: BossEntity['state'],
  attackKind: BossAttackKind,
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number
): number {
  return resolveRangedBossFrameIndex(
    state,
    attackKind,
    animTime,
    stateTimer,
    z,
    vz,
    'radioDash',
    'jingleBuff',
    null,
    0.24
  );
}

/**
 * Maps every movement, telegraph, attack, hurt, getup, and KO state of Boss 3
 * (IVAN MARTINEZ - El sepulturero) fluidly across all 16 frames [0..15] of its 4x4 sprite sheet.
 */
export function getBoss3FrameIndex(
  state: BossEntity['state'],
  attackKind: BossAttackKind,
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number
): number {
  return resolveRangedBossFrameIndex(
    state,
    attackKind,
    animTime,
    stateTimer,
    z,
    vz,
    'shoulderCharge',
    'throwPhone',
    'enVivoMark',
    0.2
  );
}

/**
 * Maps every movement, telegraph, attack, hurt, getup, and KO state of Boss 4
 * (EL JC QUE LE DICEN) fluidly across all 16 frames [0..15] of its 4x4 sprite sheet.
 */
export function getBoss4FrameIndex(
  state: BossEntity['state'],
  attackKind: BossAttackKind,
  animTime: number,
  stateTimer: number,
  z: number,
  vz: number
): number {
  return resolveRangedBossFrameIndex(
    state,
    attackKind,
    animTime,
    stateTimer,
    z,
    vz,
    'shoulderCharge',
    'noteFan',
    'soundPush',
    0.2
  );
}

export interface GamepadButtonLike {
  pressed: boolean;
  value?: number;
}

export interface GamepadLike {
  id: string;
  mapping?: string;
  connected?: boolean;
  axes: ArrayLike<number>;
  buttons: ArrayLike<GamepadButtonLike | undefined>;
}

export interface GamepadSnapshotState {
  connected: boolean;
  id: string;
  isXbox: boolean;
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  jumpPressed: boolean;
  specialPressed: boolean;
  sprintHeld: boolean;
  confirmPressed: boolean;
  cancelPressed: boolean;
  startPressed: boolean;
  mutePressed: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
}

export function createEmptyGamepadSnapshot(): GamepadSnapshotState {
  return {
    connected: false,
    id: '',
    isXbox: false,
    moveX: 0,
    moveY: 0,
    attackPressed: false,
    jumpPressed: false,
    specialPressed: false,
    sprintHeld: false,
    confirmPressed: false,
    cancelPressed: false,
    startPressed: false,
    mutePressed: false,
    dpadUp: false,
    dpadDown: false,
    dpadLeft: false,
    dpadRight: false,
  };
}

export function isXboxGamepadId(id: string): boolean {
  if (!id) return false;
  return /xbox|xinput|045e|microsoft|series\s*[xs]|360/i.test(id);
}

function isGamepadBtnPressed(btn: GamepadButtonLike | undefined): boolean {
  if (!btn) return false;
  return Boolean(btn.pressed || (typeof btn.value === 'number' && btn.value > 0.5));
}

function hasGamepadActivity(gp: GamepadLike): boolean {
  const bLen = gp.buttons?.length ?? 0;
  for (let i = 0; i < bLen; i++) {
    if (isGamepadBtnPressed(gp.buttons[i])) return true;
  }
  const aLen = Math.min(4, gp.axes?.length ?? 0);
  for (let i = 0; i < aLen; i++) {
    if (Math.abs(gp.axes[i] ?? 0) > 0.35) return true;
  }
  if (gp.mapping !== 'standard') {
    const axesLen = gp.axes?.length ?? 0;
    if (axesLen >= 8 && (Math.abs(gp.axes[6] ?? 0) > 0.5 || Math.abs(gp.axes[7] ?? 0) > 0.5)) {
      return true;
    }
    if (axesLen >= 10) {
      const hat = gp.axes[9] ?? 0;
      if (Number.isFinite(hat) && Math.abs(hat) > 0.05 && hat >= -1.08 && hat <= 1.08) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Automatically selects the best connected Xbox or standard gamepad.
 * Prefers controllers with active input, then Xbox IDs, then standard mappings.
 */
export function pickPrimaryGamepad(
  gamepads: ArrayLike<GamepadLike | null> | null | undefined
): GamepadLike | null {
  if (!gamepads) return null;
  let best: GamepadLike | null = null;
  let bestScore = -1;

  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (!gp || gp.connected === false) continue;
    const isStd = gp.mapping === 'standard';
    const hasInputs = (gp.axes?.length ?? 0) >= 2 && (gp.buttons?.length ?? 0) >= 4;
    if (!isStd && !hasInputs) continue;

    let score = 1;
    if (isStd) score += 2;
    if (isXboxGamepadId(gp.id)) score += 4;
    if (hasGamepadActivity(gp)) score += 8;

    if (score > bestScore) {
      bestScore = score;
      best = gp;
    }
  }
  return best;
}

function applyAxisDeadzone(raw: number, deadzone: number): number {
  const abs = Math.abs(raw);
  if (abs <= deadzone) return 0;
  const scaled = (abs - deadzone) / Math.max(0.01, 1 - deadzone);
  const clamped = Math.min(1, Math.max(0, scaled));
  return raw < 0 ? -clamped : clamped;
}

/**
 * Reads an Xbox / W3C Standard Gamepad into a pre-allocated GamepadSnapshotState
 * without allocating any objects per frame.
 *
 * Auto-assigned Xbox layout:
 * - Left Stick / D-Pad: 8-way movement & menu navigation
 * - A (0) / X (2): Attack / Combo / Pickup (A = Confirm in menus)
 * - B (1): Jump / Air kick (Back / Close in menus)
 * - Y (3) / LB (4) / RB (5): Special move (in addition to A+B)
 * - LT (6) / RT (7): Hold to sprint while moving
 * - View/Back (8): Mute toggle
 * - Menu/Start (9): Pause / Resume / Confirm
 */
export function readGamepadInto(
  gp: GamepadLike | null,
  out: GamepadSnapshotState,
  deadzone = 0.24
): GamepadSnapshotState {
  if (!gp || gp.connected === false) {
    out.connected = false;
    out.id = '';
    out.isXbox = false;
    out.moveX = 0;
    out.moveY = 0;
    out.attackPressed = false;
    out.jumpPressed = false;
    out.specialPressed = false;
    out.sprintHeld = false;
    out.confirmPressed = false;
    out.cancelPressed = false;
    out.startPressed = false;
    out.mutePressed = false;
    out.dpadUp = false;
    out.dpadDown = false;
    out.dpadLeft = false;
    out.dpadRight = false;
    return out;
  }

  const b = gp.buttons;
  const aBtn = isGamepadBtnPressed(b[0]);
  const bBtn = isGamepadBtnPressed(b[1]);
  const xBtn = isGamepadBtnPressed(b[2]);
  const yBtn = isGamepadBtnPressed(b[3]);
  const lbBtn = isGamepadBtnPressed(b[4]);
  const rbBtn = isGamepadBtnPressed(b[5]);
  const ltBtn = isGamepadBtnPressed(b[6]);
  const rtBtn = isGamepadBtnPressed(b[7]);
  const viewBtn = isGamepadBtnPressed(b[8]);
  const menuBtn = isGamepadBtnPressed(b[9]);
  let dpadUp = isGamepadBtnPressed(b[12]);
  let dpadDown = isGamepadBtnPressed(b[13]);
  let dpadLeft = isGamepadBtnPressed(b[14]);
  let dpadRight = isGamepadBtnPressed(b[15]);

  // Support non-standard D-pad (cruceta) encodings: axes[6]/axes[7] (xpad) & axes[9] (POV hat)
  if (gp.mapping !== 'standard') {
    const axesLen = gp.axes?.length ?? 0;
    if (axesLen >= 8) {
      const ax6 = gp.axes[6] ?? 0;
      const ax7 = gp.axes[7] ?? 0;
      if (ax6 < -0.5) dpadLeft = true;
      else if (ax6 > 0.5) dpadRight = true;
      if (ax7 < -0.5) dpadUp = true;
      else if (ax7 > 0.5) dpadDown = true;
    }
    if (axesLen >= 10) {
      const hat = gp.axes[9];
      if (typeof hat === 'number' && Number.isFinite(hat) && Math.abs(hat) > 0.05 && hat >= -1.08 && hat <= 1.08) {
        if (hat <= -0.58 || hat >= 0.85) dpadUp = true;
        if (hat >= -0.85 && hat <= -0.05) dpadRight = true;
        if (hat >= -0.28 && hat <= 0.56) dpadDown = true;
        if (hat >= 0.29 && hat <= 1.08) dpadLeft = true;
      }
    }
  }

  let mx = applyAxisDeadzone(gp.axes[0] ?? 0, deadzone);
  let my = applyAxisDeadzone(gp.axes[1] ?? 0, deadzone);
  if (dpadLeft !== dpadRight) {
    mx = dpadLeft ? -1 : 1;
  }
  if (dpadUp !== dpadDown) {
    my = dpadUp ? -1 : 1;
  }

  out.connected = true;
  out.id = gp.id ?? '';
  out.isXbox = isXboxGamepadId(out.id);
  out.moveX = mx;
  out.moveY = my;
  out.attackPressed = aBtn || xBtn;
  out.jumpPressed = bBtn;
  out.specialPressed = yBtn || lbBtn || rbBtn;
  out.sprintHeld = ltBtn || rtBtn;
  out.confirmPressed = aBtn;
  out.cancelPressed = bBtn;
  out.startPressed = menuBtn;
  out.mutePressed = viewBtn;
  out.dpadUp = dpadUp;
  out.dpadDown = dpadDown;
  out.dpadLeft = dpadLeft;
  out.dpadRight = dpadRight;
  return out;
}

export interface HitstopBudgetResult {
  hitstopTimer: number;
  hitstopCooldown: number;
}

/**
 * Grants crisp hitstop on impact without chain-freezing simulation across dense enemy crowds.
 */
export function resolveHitstopBudget(
  currentTimer: number,
  cooldownRemaining: number,
  heavy: boolean
): HitstopBudgetResult {
  if (cooldownRemaining > 0) {
    return {
      hitstopTimer: currentTimer,
      hitstopCooldown: cooldownRemaining,
    };
  }
  return {
    hitstopTimer: Math.max(currentTimer, heavy ? 0.085 : 0.055),
    hitstopCooldown: 0.22,
  };
}

export interface GrabbedByEnemyEvalInput {
  stateTimer: number;
  dt: number;
  mashBreakCount: number;
  hasActiveDrainer: boolean;
  specialEscape: boolean;
}

export interface GrabbedByEnemyEvalResult {
  nextTimer: number;
  shouldRelease: boolean;
  usedSpecial: boolean;
}

/**
 * Prevents permanent softlocks in grabbedByEnemy when drainers disappear, die, or time out.
 */
export function evaluateGrabbedByEnemyState(
  input: GrabbedByEnemyEvalInput
): GrabbedByEnemyEvalResult {
  if (input.specialEscape) {
    return { nextTimer: 0, shouldRelease: true, usedSpecial: true };
  }
  if (!input.hasActiveDrainer || input.mashBreakCount >= 4) {
    return { nextTimer: 0, shouldRelease: true, usedSpecial: false };
  }
  const nextTimer = Math.max(0, input.stateTimer - Math.max(0, input.dt));
  return {
    nextTimer,
    shouldRelease: nextTimer <= 0,
    usedSpecial: false,
  };
}

export interface CrowdGrabDisengageInput {
  facing: 1 | -1;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attackJustPressed: boolean;
  jumpJustPressed: boolean;
  disengageTimer: number;
  dt: number;
}

export interface CrowdGrabDisengageResult {
  shouldRelease: boolean;
  nextDisengageTimer: number;
}

/**
 * Allows the player to voluntarily break out of walk-in grabHold by holding away or dodging
 * vertically, while preserving immediate opposite+Attack back-throw and Jump overhead-throw.
 */
export function shouldReleaseCrowdGrabHold(
  input: CrowdGrabDisengageInput
): CrowdGrabDisengageResult {
  if (input.attackJustPressed || input.jumpJustPressed) {
    return { shouldRelease: false, nextDisengageTimer: 0 };
  }
  const holdingOpposite =
    (input.facing === 1 && input.left && !input.right) ||
    (input.facing === -1 && input.right && !input.left);
  const holdingVertical = input.up !== input.down;
  if (!holdingOpposite && !holdingVertical) {
    return { shouldRelease: false, nextDisengageTimer: 0 };
  }
  const next = input.disengageTimer + Math.max(0, input.dt);
  if (next >= 0.16) {
    return { shouldRelease: true, nextDisengageTimer: 0 };
  }
  return { shouldRelease: false, nextDisengageTimer: next };
}

export type AttackPhase = 'startup' | 'active' | 'recovery' | 'done';

export function getAttackTotalTicks(data: AttackFrameData): number {
  return data.startupTicks + data.activeTicks + data.recoveryTicks;
}

export function getAttackPhase(tick: number, data: AttackFrameData): AttackPhase {
  if (tick < data.startupTicks) return 'startup';
  const activeEnd = data.startupTicks + data.activeTicks;
  if (tick < activeEnd) return 'active';
  const total = activeEnd + data.recoveryTicks;
  if (tick < total) return 'recovery';
  return 'done';
}

export function canChainFromTick(tick: number, data: AttackFrameData): boolean {
  return tick >= data.startupTicks + data.activeTicks;
}

export function getAttackFrameSlot(tick: number, data: AttackFrameData): 0 | 1 | 2 | 3 {
  const phase = getAttackPhase(tick, data);
  if (phase === 'startup') return 0;
  if (phase === 'active') return 1;
  if (phase === 'recovery') {
    const recOffset = tick - (data.startupTicks + data.activeTicks);
    const firstHalf = Math.ceil(data.recoveryTicks / 2);
    return recOffset < firstHalf ? 2 : 3;
  }
  return 3;
}

export function buildAttackHitboxInto(
  out: { x: number; z: number; w: number; h: number },
  playerX: number,
  playerZ: number,
  facing: 1 | -1,
  data: AttackFrameData,
  extraReach = 0
): void {
  const startX = data.hitStartX;
  const endX = data.hitEndX + Math.max(0, extraReach);
  const w = Math.max(1, endX - startX);
  const centerOffset = (startX + endX) * 0.5;
  out.x = playerX + facing * centerOffset;
  out.z = playerZ;
  out.w = w;
  out.h = data.hitHeight;
}
