import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAdaptiveDifficultyToSpawns,
  applySpecialCost,
  canActivateSpecial,
  canRequestAttackToken,
  checkHitbox25D,
  clampWalkY,
  computeDirectionalShadow,
  computeDirectionalShadowInto,
  computeJumpFrameIndex,
  computeLevelResults,
  computeMusicBeatPulse,
  computeSpawnStagger,
  computeTitleBgCropLayout,
  computeTitleFireBeatMotion,
  countCrossedExtraLives,
  createEmptyGamepadSnapshot,
  findTrimmedSampleRange,
  getBoss1FrameIndex,
  getBoss2FrameIndex,
  getBoss3FrameIndex,
  getBoss4FrameIndex,
  getBoss5FrameIndex,
  getEnemySheetFrameIndex,
  getPlayerAttackDamage,
  isXboxGamepadId,
  lerp,
  normalizeMoveAxes,
  normalizeMoveAxesInto,
  overlapsHitbox25D,
  pickNextTrackFromDeck,
  pickPrimaryGamepad,
  readGamepadInto,
  recordEnemyHitAndCheckKnockdown,
  recordEnemyHitAndCheckKnockdownInPlace,
  resolveDeadzoneFacing,
  resolveZoneArenaBounds,
  scaleEnemyStats,
  stepCameraTowards,
  stepVelocity2D,
  stepVelocity2DInto,
  resolveHitstopBudget,
  evaluateGrabbedByEnemyState,
  shouldReleaseCrowdGrabHold,
} from './rules';
import fs from 'node:fs';
import path from 'node:path';
import { MUSIC_TRACKS, SFX_PATHS } from './audio';
import { CHARACTERS, LEVELS, BOSSES, ENEMY_BASE_STATS, STORY, WALK_MIN_Y, WALK_MAX_Y } from './data';
import { SPRITE_MAP, validateSpriteMapEntry } from './sprites';
import {
  BOSS1_SHEET_SPEC,
  BOSS2_SHEET_SPEC,
  BOSS3_SHEET_SPEC,
  BOSS4_SHEET_SPEC,
  BOSS5_SHEET_SPEC,
  BOSS_SPRITE_SPECS,
  BONUS_COURT_BG_PATH,
  BREAKABLE_SPRITE_SPECS,
  CHAR_SELECT_BG_PATH,
  ENEMY_SHEET_SPECS,
  ENEMY_SPRITE_SPECS,
  HERO_PORTRAIT_PATHS,
  PICKUP_SPRITE_SPECS,
  STAGE_BG_PATHS,
  TITLE_BG_PATH,
  TITLE_LOGO_PATH,
  floodFillRemoveBackgroundRgba,
} from './worldSprites';

function resolvePublicOrSrcPath(webPath: string): string {
  const rel = webPath.startsWith('/') ? webPath.slice(1) : webPath;
  const direct = path.resolve(process.cwd(), rel);
  if (fs.existsSync(direct)) return direct;
  return path.resolve(process.cwd(), 'public', rel);
}

test('2.5D hitbox respects depth tolerance <= 22px and (x, z) overlap', () => {
  const atk = { x: 200, y: 440, z: 0, w: 60, h: 80 };
  const closeDef = { x: 230, y: 462, z: 0, w: 40, h: 80 }; // |Δy| = 22
  const farDef = { x: 230, y: 463, z: 0, w: 40, h: 80 }; // |Δy| = 23
  const highDef = { x: 230, y: 440, z: 90, w: 40, h: 80 }; // jumping above

  assert.equal(checkHitbox25D(atk, closeDef), true);
  assert.equal(checkHitbox25D(atk, farDef), false);
  assert.equal(checkHitbox25D(atk, highDef), false);
});

test('walkable band clamps strictly between street limits WALK_MIN_Y (436) and WALK_MAX_Y (528)', () => {
  assert.equal(WALK_MIN_Y, 436);
  assert.equal(WALK_MAX_Y, 528);
  assert.equal(clampWalkY(300), WALK_MIN_Y);
  assert.equal(clampWalkY(480), 480);
  assert.equal(clampWalkY(600), WALK_MAX_Y);
  for (const lvl of LEVELS) {
    for (const br of lvl.breakables) {
      assert.ok(
        br.y >= WALK_MIN_Y && br.y <= WALK_MAX_Y,
        `Level ${lvl.levelNumber} breakable ${br.kind} at y=${br.y} outside street band [${WALK_MIN_Y}, ${WALK_MAX_Y}]`
      );
    }
  }
});

test('special rules: cannot use at <= 8 HP, only drains 8 HP when hitting >= 1 enemy, never kills', () => {
  assert.equal(canActivateSpecial(8, 0), false);
  assert.equal(canActivateSpecial(9, 0), true);
  assert.equal(canActivateSpecial(50, 0.2), false);

  assert.equal(applySpecialCost(50, 0), 50);
  assert.equal(applySpecialCost(50, 2), 42);
  assert.equal(applySpecialCost(9, 1), 1);
});

test('character stats & combo damages match spec', () => {
  assert.deepEqual(CHARACTERS.bayron.comboDamage, [7, 7, 11]);
  assert.deepEqual(CHARACTERS.marcianeke.comboDamage, [6, 6, 10]);
  assert.deepEqual(CHARACTERS.crismj.comboDamage, [5, 5, 9]);
  assert.equal(CHARACTERS.crismj.name, 'CRIS MJ');
  assert.equal(getPlayerAttackDamage('bayron', 3, null), 11);
  assert.equal(getPlayerAttackDamage('crismj', 1, 'bate'), 16);
});

test('3 hits within 2 seconds triggers knockdown and resets recent timestamps', () => {
  let res = recordEnemyHitAndCheckKnockdown([], 10.0);
  assert.equal(res.shouldKnockdown, false);
  assert.equal(res.updated.length, 1);

  res = recordEnemyHitAndCheckKnockdown(res.updated, 11.0);
  assert.equal(res.shouldKnockdown, false);
  assert.equal(res.updated.length, 2);

  res = recordEnemyHitAndCheckKnockdown(res.updated, 11.8);
  assert.equal(res.shouldKnockdown, true);
  assert.equal(res.updated.length, 0);

  // Old hit > 2s ago expires
  const expired = recordEnemyHitAndCheckKnockdown([5.0, 6.0], 9.0);
  assert.equal(expired.shouldKnockdown, false);
  assert.deepEqual(expired.updated, [9.0]);
});

test('attack token director enforces simultaneous attacker limit', () => {
  const enemies = [
    { state: 'attack' as const },
    { state: 'telegraph' as const },
    { state: 'approach' as const },
  ];
  assert.equal(canRequestAttackToken(enemies, 2), false);
  assert.equal(canRequestAttackToken(enemies, 3), true);
});

test('enemy scaling & extra life score thresholds', () => {
  const n1Zombie = scaleEnemyStats('zombie', 1);
  const n5Zombie = scaleEnemyStats('zombie', 5);
  assert.equal(n1Zombie.hp, 30);
  assert.equal(n1Zombie.damage, 5);
  assert.equal(n5Zombie.hp, 51);
  assert.equal(n5Zombie.damage, 7);

  assert.equal(countCrossedExtraLives(49900, 50100), 1);
  assert.equal(countCrossedExtraLives(40000, 160000), 2);
  assert.equal(countCrossedExtraLives(51000, 60000), 0);
});

test('adaptive difficulty reduces 1 enemy and adds bonus food after losing a life in zone', () => {
  const orig = [{ type: 'zombie' as const, count: 3 }];
  const adj = applyAdaptiveDifficultyToSpawns(orig, true);
  assert.equal(adj.bonusFood, true);
  assert.equal(adj.spawns[0].count, 2);
  assert.equal(orig[0].count, 3); // original immutable
});

test('level results & all 5 levels / 5 bosses / SPRITE_MAP integrity', () => {
  const res = computeLevelResults({
    levelNumber: 1,
    elapsedSec: 160,
    remainingHp: 80,
    damageTakenOnBoss: 0,
    score: 12000,
  });
  assert.equal(res.noDamageBossBonus, 5000);
  assert.equal(res.hpBonus, 1600);
  assert.ok(res.timeBonus > 0);
  assert.equal(res.totalScore, 12000 + res.timeBonus + 1600 + 5000);

  assert.equal(LEVELS.length, 5);
  assert.equal(Object.keys(BOSSES).length, 5);
  assert.equal(BOSSES[5].maxHp, 1000);

  for (const id of ['bayron', 'marcianeke', 'crismj'] as const) {
    assert.equal(SPRITE_MAP[id].frames.length, 16);
    assert.equal(validateSpriteMapEntry(SPRITE_MAP[id], 1254, 1254), null);
  }
});

test('all 7 enemy sprites & 16-frame sheets, zombie spawns across N1-N5 (no tronco enemy), 5 boss sprites, and parallax stage backgrounds exist on disk', () => {
  const enemyTypes = Object.keys(ENEMY_BASE_STATS) as (keyof typeof ENEMY_BASE_STATS)[];
  assert.equal(enemyTypes.length, 7);
  assert.equal('tronco' in ENEMY_BASE_STATS, false);
  assert.equal(ENEMY_BASE_STATS.canero.label, 'PAPI MICKY ZOMBIE');
  assert.equal(ENEMY_BASE_STATS.domestico.label, 'TRONCO RENACENTISTA');
  assert.equal(ENEMY_BASE_STATS.chupetona.label, 'TRONCO OFICINISTA');
  assert.equal(ENEMY_BASE_STATS.fan.label, 'TIO RENE ZOMBIE');
  assert.equal(ENEMY_BASE_STATS.manager.label, 'TRONCO MANAGER');
  for (const t of enemyTypes) {
    const spec = ENEMY_SPRITE_SPECS[t];
    assert.ok(spec, `missing enemy sprite spec for ${t}`);
    assert.ok(spec.targetHeightPx > 80 && spec.targetHeightPx <= 140);
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(spec.src)), `missing file ${spec.src}`);
  }

  for (const t of ['zombie', 'cachorro', 'canero', 'domestico', 'chupetona', 'fan', 'manager'] as const) {
    const sheet = ENEMY_SHEET_SPECS[t];
    assert.ok(sheet, `missing enemy sheet spec for ${t}`);
    assert.equal(sheet.frames.length, 16);
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(sheet.sheetSrc)), `missing sheet ${sheet.sheetSrc}`);
    if (t === 'canero' || t === 'domestico' || t === 'chupetona' || t === 'fan') {
      assert.equal(sheet.portraitSrc, undefined);
      assert.ok(ENEMY_SPRITE_SPECS[t].sourceFrame, `${t} title fallback should crop frame 0 from spritesheet`);
    } else {
      assert.ok(
        sheet.portraitSrc && fs.existsSync(resolvePublicOrSrcPath(sheet.portraitSrc)),
        `missing portrait ${sheet.portraitSrc}`
      );
      assert.equal(ENEMY_SPRITE_SPECS[t].sourceFrame, undefined);
    }
    for (let i = 0; i < sheet.frames.length; i++) {
      const f = sheet.frames[i];
      assert.ok(
        f.x >= 0 && f.y >= 0 && f.w > 0 && f.h > 0 && f.x + f.w <= sheet.sheetWidth && f.y + f.h <= sheet.sheetHeight,
        `${t} frame ${i} out of bounds`
      );
    }
  }

  assert.equal(ENEMY_SPRITE_SPECS.canero.src, '/assets/aistudio/3_Papi_Micky_Zombie_a4e1373d.png');
  assert.equal(ENEMY_SPRITE_SPECS.domestico.src, '/assets/aistudio/4_Tronco_Renacentista_b09832bc.png');
  assert.equal(ENEMY_SPRITE_SPECS.chupetona.src, '/assets/aistudio/5_Tronco_Oficinista_642a2db3.png');
  assert.equal(ENEMY_SPRITE_SPECS.fan.src, '/assets/aistudio/6_Tio_Rene_Zombie_7be13d43.png');
  assert.equal(ENEMY_SPRITE_SPECS.manager.src, '/assets/aistudio/7_troncomanager_54fd0bb0.png');
  assert.equal(ENEMY_SHEET_SPECS.manager?.portraitSrc, '/assets/aistudio/7_troncomanager_54fd0bb0.png');

  // Zombie appears in all 5 levels (N1-N5) and Tronco is never spawned as a common enemy
  for (const lvl of LEVELS) {
    assert.ok(lvl.dripPool.includes('zombie'), `N${lvl.levelNumber} dripPool should include zombie`);
    assert.equal((lvl.dripPool as string[]).includes('tronco'), false, `N${lvl.levelNumber} dripPool must not include tronco`);
    const stageSpawns = lvl.zones.flatMap((z) => z.spawns.map((s) => s.type));
    assert.ok(stageSpawns.includes('zombie'), `N${lvl.levelNumber} zones should spawn zombie`);
    assert.equal((stageSpawns as string[]).includes('tronco'), false, `N${lvl.levelNumber} zones must not spawn tronco`);
  }

  for (const id of [1, 2, 3, 4, 5] as const) {
    const spec = BOSS_SPRITE_SPECS[id];
    assert.ok(spec, `missing boss sprite spec for ${id}`);
    assert.ok(spec.targetHeightPx >= 130 && spec.targetHeightPx <= 180);
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(spec.src)), `missing file ${spec.src}`);
  }

  assert.equal(BOSSES[1].name, 'EL TRONCO');
  assert.equal(BOSSES[1].title, 'El Licenciado Máximo del Codo');
  assert.equal(BOSSES[2].name, 'CARLITOS RUN');
  assert.equal(BOSSES[2].title, 'La Guagua');
  assert.equal(BOSSES[3].name, 'IVAN MARTINEZ');
  assert.equal(BOSSES[3].title, 'El Hombre de Cera');
  assert.equal(BOSSES[4].name, 'EL JC QUE LE DICEN');
  assert.equal(BOSSES[4].title, 'El Patrón del Morbo');
  assert.equal(BOSSES[5].name, 'DEVIL GONZALEZ');
  assert.equal(BOSSES[5].title, 'El Amo del Contrato y los Androides');
  assert.equal(STORY.prologue.length, 4);
  for (const char of Object.values(CHARACTERS)) {
    assert.ok(char.specialName.length > 0);
    assert.ok(char.comboName.length > 0);
    assert.equal(char.comboSteps.length, 3);
  }
  assert.equal(CHARACTERS.bayron.specialName, 'TUU MALDITO');
  assert.equal(CHARACTERS.bayron.comboName, 'ME PONGO BONITO');
  assert.equal(CHARACTERS.marcianeke.specialName, 'QUE SABEN DE CORTE');
  assert.equal(CHARACTERS.marcianeke.comboName, 'MARCIANEKEE');
  assert.equal(CHARACTERS.crismj.specialName, 'QUE VIVA EL MONEY');
  assert.equal(CHARACTERS.crismj.comboName, 'FLOW GATA ONLY');
  assert.equal(fs.existsSync(resolvePublicOrSrcPath('/src/assets/images/boss_el_firmado_1795063877726.jpg')), false);
  assert.equal(fs.existsSync(resolvePublicOrSrcPath('/src/assets/images/boss_discografica_1795063877148.jpg')), false);
  assert.equal(BOSS_SPRITE_SPECS[2].src, '/assets/aistudio/CARLITOSRUN_f314eaac.png');
  assert.equal(BOSS2_SHEET_SPEC.sheetSrc, '/assets/aistudio/sprites_CARLITOSRUN_1cafd635.png');
  assert.equal(BOSS2_SHEET_SPEC.portraitSrc, '/assets/aistudio/CARLITOSRUN_f314eaac.png');
  assert.equal(BOSS_SPRITE_SPECS[3].src, '/assets/aistudio/ivanmartinez_2150299d.webp');
  assert.equal(BOSS3_SHEET_SPEC.sheetSrc, '/assets/aistudio/sprites_ivanmartinez_db38e6e6.webp');
  assert.equal(BOSS3_SHEET_SPEC.portraitSrc, '/assets/aistudio/ivanmartinez_2150299d.webp');
  assert.equal(BOSS_SPRITE_SPECS[4].src, '/assets/aistudio/jc_1cbc4bd2.webp');
  assert.equal(BOSS4_SHEET_SPEC.sheetSrc, '/assets/aistudio/sprites_jc_b5fed4ae.png');
  assert.equal(BOSS4_SHEET_SPEC.portraitSrc, '/assets/aistudio/jc_1cbc4bd2.webp');
  assert.equal(BOSS_SPRITE_SPECS[5].src, '/assets/aistudio/jefe_final_514a85e9.png');
  assert.equal(BOSS5_SHEET_SPEC.sheetSrc, '/assets/aistudio/sprites_jefe_final_f79c6b76.png');
  assert.equal(BOSS5_SHEET_SPEC.portraitSrc, '/assets/aistudio/jefe_final_514a85e9.png');

  for (const lvl of LEVELS) {
    const bgPath = STAGE_BG_PATHS[lvl.theme];
    assert.ok(bgPath && fs.existsSync(resolvePublicOrSrcPath(bgPath)), `missing bg ${bgPath}`);
  }
  assert.equal(BONUS_COURT_BG_PATH, '/src/assets/images/bg_bonus_cancha_chile_1795125605513.jpg');
  assert.ok(fs.existsSync(resolvePublicOrSrcPath(BONUS_COURT_BG_PATH)), `missing bonus bg ${BONUS_COURT_BG_PATH}`);
});

test('all 6 breakables, 10 pickups, title backdrop/logo, character select assets, Boss 1 & Boss 5 16-frame sheets, SFX, and 7 music tracks exist on disk', () => {
  const breakableKeys = ['barril', 'cajon', 'tacho', 'carrito', 'bolsa', 'parlante'] as const;
  for (const k of breakableKeys) {
    const spec = BREAKABLE_SPRITE_SPECS[k];
    assert.ok(spec, `missing breakable spec for ${k}`);
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(spec.src)), `missing breakable file ${spec.src}`);
  }

  const pickupKeys = [
    'empanada',
    'sandwich',
    'energia',
    'billete',
    'disco',
    '1up',
    'tubo',
    'bate',
    'botella',
    'cadena',
  ] as const;
  for (const k of pickupKeys) {
    const spec = PICKUP_SPRITE_SPECS[k];
    assert.ok(spec, `missing pickup spec for ${k}`);
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(spec.src)), `missing pickup file ${spec.src}`);
  }

  assert.ok(fs.existsSync(resolvePublicOrSrcPath(TITLE_BG_PATH)), `missing title background ${TITLE_BG_PATH}`);
  assert.ok(fs.existsSync(resolvePublicOrSrcPath(TITLE_LOGO_PATH)), `missing title logo ${TITLE_LOGO_PATH}`);
  assert.ok(fs.existsSync(resolvePublicOrSrcPath(CHAR_SELECT_BG_PATH)), `missing char select bg ${CHAR_SELECT_BG_PATH}`);
  for (const [cid, hp] of Object.entries(HERO_PORTRAIT_PATHS)) {
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(hp)), `missing hero portrait ${cid}: ${hp}`);
  }

  for (const [label, spec] of [
    ['Boss 1 Tronco', BOSS1_SHEET_SPEC],
    ['Boss 2 CarlitosRun', BOSS2_SHEET_SPEC],
    ['Boss 3 Ivan Martinez', BOSS3_SHEET_SPEC],
    ['Boss 4 El JC Que Le Dicen', BOSS4_SHEET_SPEC],
    ['Boss 5 Discográfica Final', BOSS5_SHEET_SPEC],
  ] as const) {
    assert.equal(spec.frames.length, 16);
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(spec.sheetSrc)), `missing ${label} sheet`);
    assert.ok(spec.portraitSrc && fs.existsSync(resolvePublicOrSrcPath(spec.portraitSrc)), `missing ${label} portrait`);
    for (let i = 0; i < spec.frames.length; i++) {
      const f = spec.frames[i];
      assert.ok(
        f.x >= 0 &&
          f.y >= 0 &&
          f.w > 0 &&
          f.h > 0 &&
          f.x + f.w <= spec.sheetWidth &&
          f.y + f.h <= spec.sheetHeight,
        `${label} frame ${i} out of bounds`
      );
    }
  }

  assert.equal(Object.keys(SFX_PATHS).length, 5);
  assert.equal(SFX_PATHS.ruuun, '/assets/aistudio/RUUUN_e92d817e.mp3');
  assert.equal(SFX_PATHS.matorun, '/assets/aistudio/MATORUN_5c2650ec.mp3');
  for (const [key, sfxPath] of Object.entries(SFX_PATHS)) {
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(sfxPath)), `missing SFX ${key}: ${sfxPath}`);
  }

  assert.equal(MUSIC_TRACKS.length, 7);
  for (const trackPath of MUSIC_TRACKS) {
    assert.ok(fs.existsSync(resolvePublicOrSrcPath(trackPath)), `missing music track ${trackPath}`);
  }
});

test('camera interpolation, smooth glide, non-rewinding zone bounds, non-repeating music deck, and PCM silence trimming', () => {
  assert.equal(lerp(100, 200, 0), 100);
  assert.equal(lerp(100, 200, 0.25), 125);
  assert.equal(lerp(100, 200, 1), 200);

  const glide1 = stepCameraTowards(535, 420, 1 / 60, 10);
  assert.ok(glide1 < 535 && glide1 > 420);
  assert.equal(stepCameraTowards(420.2, 420, 1 / 60, 10), 420);

  // Zone arena lock never rewinds cameraX backward when currentCamX > zoneArenaLeft
  const noRewind = resolveZoneArenaBounds(620, 480, 1440, 960, 4800);
  assert.equal(noRewind.arenaLeft, 620);
  assert.equal(noRewind.arenaRight, 1580);
  assert.equal(noRewind.needsGlide, false);

  // When player crosses trigger early, camera glides forward only
  const forwardGlide = resolveZoneArenaBounds(430, 480, 1440, 960, 4800);
  assert.equal(forwardGlide.arenaLeft, 480);
  assert.equal(forwardGlide.arenaRight, 1440);
  assert.equal(forwardGlide.needsGlide, true);

  // Shuffled deck draws all tracks before repeating and avoids back-to-back repeats
  const tracks = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
  let deck: string[] = [];
  let prev: string | null = null;
  const firstCycle = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const res = pickNextTrackFromDeck(tracks, deck, prev, () => 0.37);
    assert.notEqual(res.track, prev);
    firstCycle.add(res.track);
    deck = res.nextDeck;
    prev = res.track;
  }
  assert.equal(firstCycle.size, 7);
  const nextCyclePick = pickNextTrackFromDeck(tracks, deck, prev, () => 0);
  assert.notEqual(nextCyclePick.track, prev);

  // Sample trimming strips leading & trailing digital silence cleanly
  const samples = new Float32Array([0, 0.001, -0.002, 0.4, -0.6, 0.2, 0.003, 0]);
  const range = findTrimmedSampleRange(samples, 0.012);
  assert.deepEqual(range, { start: 3, end: 6 });
});

test('floodFillRemoveBackgroundRgba strips outer white, preserves interior white & neon glow, and crops tightly', () => {
  // 9x9 sprite: outer white border (255,255,255), black outline box at [2..6, 2..6],
  // interior white pixel at (4,4) (e.g. apron), plus saturated magenta pixel at (7,4)
  const w = 9;
  const h = 9;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const setPx = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    const off = (y * w + x) * 4;
    rgba[off] = r;
    rgba[off + 1] = g;
    rgba[off + 2] = b;
    rgba[off + 3] = a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setPx(x, y, 255, 255, 255, 255);
    }
  }
  // Black outline rectangle x=2..6, y=2..6
  for (let y = 2; y <= 6; y++) {
    for (let x = 2; x <= 6; x++) {
      if (x === 2 || x === 6 || y === 2 || y === 6) {
        setPx(x, y, 10, 10, 10, 255);
      }
    }
  }
  // Interior white apron pixels at (3..5, 3..5) stay untouched!
  // Saturated magenta glow pixel at (7, 4) right outside outline stays opaque!
  setPx(7, 4, 255, 46, 136, 255);

  const bounds = floodFillRemoveBackgroundRgba(rgba, w, h);

  // Outer white corner (0,0) cleared
  assert.equal(rgba[3], 0);
  // Interior white apron (4,4) preserved!
  assert.equal(rgba[(4 * w + 4) * 4 + 3], 255);
  // Saturated magenta glow (7,4) preserved!
  assert.equal(rgba[(4 * w + 7) * 4 + 3], 255);
  // Tight bounding box: x=2..7 (width 6), y=2..6 (height 5)
  assert.equal(bounds.minX, 2);
  assert.equal(bounds.minY, 2);
  assert.equal(bounds.cropWidth, 6);
  assert.equal(bounds.cropHeight, 5);
  assert.equal(bounds.ay, 5);

  // When an explicit hole seed targets an enclosed pure-white region, it clears it
  const holeBounds = floodFillRemoveBackgroundRgba(rgba, w, h, [[4 / (w - 1), 4 / (h - 1)]]);
  assert.equal(rgba[(4 * w + 4) * 4 + 3], 0);
  assert.equal(holeBounds.cropWidth, 6);
});

test('movement normalization, smooth velocity stepping, staggered enemy spawns, and directional dynamic shadows', () => {
  const zero = normalizeMoveAxes(0, 0);
  assert.deepEqual(zero, { nx: 0, ny: 0 });
  const diag = normalizeMoveAxes(1, 1);
  assert.ok(Math.abs(Math.hypot(diag.nx, diag.ny) - 1) < 1e-6);
  const cardinal = normalizeMoveAxes(-1, 0);
  assert.deepEqual(cardinal, { nx: -1, ny: 0 });

  // Acceleration and tighter deceleration converge smoothly
  const acc1 = stepVelocity2D(0, 0, 170, 0, 2600, 3200, 0.02);
  assert.ok(acc1.vx > 0 && acc1.vx < 170);
  const accDone = stepVelocity2D(acc1.vx, 0, 170, 0, 2600, 3200, 0.2);
  assert.equal(accDone.vx, 170);
  const dec1 = stepVelocity2D(170, 0, 0, 0, 2600, 3200, 0.02);
  assert.ok(dec1.vx < 170 && dec1.vx > 0);
  const decDone = stepVelocity2D(dec1.vx, 0, 0, 0, 2600, 3200, 0.2);
  assert.equal(decDone.vx, 0);

  // Staggered spawn coordinates keep waves inside walkable street and prevent overlapping
  const rngZero = () => 0.5;
  const s0 = computeSpawnStagger('right', 0, 3, 200, 960, WALK_MIN_Y, WALK_MAX_Y, rngZero);
  const s1 = computeSpawnStagger('right', 1, 3, 200, 960, WALK_MIN_Y, WALK_MAX_Y, rngZero);
  const s2 = computeSpawnStagger('right', 2, 3, 200, 960, WALK_MIN_Y, WALK_MAX_Y, rngZero);
  assert.notEqual(s0.x, s1.x);
  assert.notEqual(s1.x, s2.x);
  assert.ok(s0.y >= WALK_MIN_Y && s0.y <= WALK_MAX_Y);
  assert.ok(s1.y >= WALK_MIN_Y && s1.y <= WALK_MAX_Y);
  assert.ok(s2.y >= WALK_MIN_Y && s2.y <= WALK_MAX_Y);
  assert.ok(s1.y > s0.y && s2.y > s1.y);

  const sewer = computeSpawnStagger('sewer', 0, 2, 400, 960, WALK_MIN_Y, WALK_MAX_Y, rngZero);
  assert.ok(sewer.x >= 600 && sewer.x <= 1160);
  assert.ok(sewer.y >= WALK_MIN_Y && sewer.y <= WALK_MAX_Y);

  // Directional shadows shift opposite the nearest lamp and shrink on jump
  const groundRightOfLamp = computeDirectionalShadow(520, 0, 56, 1, 400);
  const groundLeftOfLamp = computeDirectionalShadow(280, 0, 56, 1, 400);
  const airborne = computeDirectionalShadow(520, 120, 56, 1, 400);
  assert.ok(groundRightOfLamp.offsetX > 0);
  assert.ok(groundLeftOfLamp.offsetX < 0);
  assert.ok(airborne.rx < groundRightOfLamp.rx);
  assert.ok(airborne.alpha < groundRightOfLamp.alpha);
});

test('music beat pulse & full-bleed title crop layout eliminate black margins proportionally', () => {
  // Muted suppresses beat pulse; real FFT bass overrides fallback; fallback oscillates between 0 and 1
  assert.equal(computeMusicBeatPulse(0.8, 1.2, true), 0);
  assert.equal(computeMusicBeatPulse(0.74, 1.2, false), 0.74);
  const pulseA = computeMusicBeatPulse(0, 0.01, false, 108);
  const pulseB = computeMusicBeatPulse(0, 0.45, false, 108);
  assert.ok(pulseA > 0.4 && pulseA <= 1);
  assert.ok(pulseB >= 0 && pulseB < pulseA);

  // 1376x768 title backdrop with left 31% (426px) black padding expands cleanly to 960x540
  const layout = computeTitleBgCropLayout(1376, 768, 426, 960, 540);
  assert.equal(layout.activeStartX, 426);
  assert.equal(layout.mainDrawX + layout.mainDrawW, 960);
  assert.equal(layout.leftFillW, layout.mainDrawX);
  assert.ok(layout.leftFillW > 200 && layout.mainDrawW > 600);

  // Beat-reactive fire motion scales height, glow, flicker rate, and vibration with beat; disabled when reduceEffects=true
  const calmFire = computeTitleFireBeatMotion(0, 0.25, false);
  const peakFire = computeTitleFireBeatMotion(0.9, 0.04, false);
  const reducedFire = computeTitleFireBeatMotion(0.9, 0.04, true);
  assert.equal(calmFire.heightScale, 1);
  assert.equal(calmFire.vibX, 0);
  assert.ok(peakFire.heightScale > calmFire.heightScale);
  assert.ok(peakFire.glowAlpha > calmFire.glowAlpha);
  assert.ok(peakFire.flickerBoost > calmFire.flickerBoost);
  assert.ok(Math.abs(peakFire.vibX) > 0 || Math.abs(peakFire.vibY) > 0);
  assert.equal(reducedFire.heightScale, 1);
  assert.equal(reducedFire.vibX, 0);
  assert.equal(reducedFire.vibY, 0);
});

test('Boss 5 16-frame pose mapping, anti-jitter deadzone facing, jump arc pose, and zero-alloc 2.5D hitbox overlap', () => {
  // Zero-alloc 2.5D overlap matches checkHitbox25D
  assert.equal(overlapsHitbox25D(200, 440, 0, 60, 80, 230, 462, 0, 40, 80), true);
  assert.equal(overlapsHitbox25D(200, 440, 0, 60, 80, 230, 463, 0, 40, 80), false);

  // Deadzone keeps previous facing within +-8px overlap to eliminate sprite flip flicker
  assert.equal(resolveDeadzoneFacing(3, -1, 8), -1);
  assert.equal(resolveDeadzoneFacing(-5, 1, 8), 1);
  assert.equal(resolveDeadzoneFacing(14, -1, 8), 1);
  assert.equal(resolveDeadzoneFacing(-14, 1, 8), -1);

  // Jump frame stays airborne tucked (5) during rise/apex and crouches (4) only on final touchdown
  assert.equal(computeJumpFrameIndex(18, 220), 5);
  assert.equal(computeJumpFrameIndex(56, -240), 5);
  assert.equal(computeJumpFrameIndex(20, -240), 4);

  // Boss 5 uses all 16 distinct frames cleanly across its states & attacks
  const seen = new Set<number>();
  seen.add(getBoss5FrameIndex('idle', 'doublePunch', 0.0, 0, 0, 0, 1));
  seen.add(getBoss5FrameIndex('idle', 'doublePunch', 0.3, 0, 0, 0, 1));
  for (let t = 0; t < 0.8; t += 0.12) {
    seen.add(getBoss5FrameIndex('chase', 'doublePunch', t, 0, 0, 0, 2));
  }
  seen.add(getBoss5FrameIndex('telegraph', 'fireWave', 0.1, 0.3, 0, 0, 2));
  seen.add(getBoss5FrameIndex('phaseTransition', 'fireWave', 0.1, 1.5, 45, 180, 2));
  seen.add(getBoss5FrameIndex('telegraph', 'contractSweep', 0.1, 0.3, 0, 0, 1));
  seen.add(getBoss5FrameIndex('attack', 'briefcaseSwing', 0.05, 0.4, 0, 0, 1));
  seen.add(getBoss5FrameIndex('attack', 'briefcaseSwing', 0.2, 0.22, 0, 0, 1));
  seen.add(getBoss5FrameIndex('attack', 'briefcaseSwing', 0.38, 0.08, 0, 0, 1));
  seen.add(getBoss5FrameIndex('attack', 'contractSweep', 0.1, 0.3, 0, 0, 1));
  seen.add(getBoss5FrameIndex('hurt', 'doublePunch', 0.1, 0.2, 0, 0, 1));
  seen.add(getBoss5FrameIndex('knockdown', 'doublePunch', 0.1, 0.4, 0, 0, 1));
  seen.add(getBoss5FrameIndex('phaseTransition', 'fireWave', 1.2, 0.4, 0, 0, 2));
  seen.add(getBoss5FrameIndex('attack', 'fireWave', 0.3, 0.1, 0, 0, 2));

  assert.equal(seen.size, 16, `Expected all 16 Boss 5 frames to be utilized, saw ${[...seen].sort((a, b) => a - b).join(',')}`);
});

test('all 3 playable heroes, 16-frame sheet enemies, and Boss 1 utilize all 16 sprite sheet frames [0..15]', () => {
  // 1. Playable characters (bayron, marcianeke, crismj)
  for (const charId of ['bayron', 'marcianeke', 'crismj'] as const) {
    const used = new Set<number>();
    for (const anim of Object.values(SPRITE_MAP[charId].animations)) {
      for (const f of anim.frames) {
        used.add(f);
      }
    }
    assert.equal(
      used.size,
      16,
      `Expected ${charId} animations to use all 16 frames, saw ${[...used].sort((a, b) => a - b).join(',')}`
    );
  }

  // 2. 16-frame enemy sheets (zombie, canero, domestico, chupetona, fan, manager)
  for (const enemyType of ['zombie', 'canero', 'domestico', 'chupetona', 'fan', 'manager'] as const) {
    const enemySeen = new Set<number>();
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'entering', 0.0, 0.5, 0, 0, 0, true));
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'entering', 0.1, 0.05, 0, 0, 0, true));
    for (let t = 0; t < 0.8; t += 0.1) {
      enemySeen.add(getEnemySheetFrameIndex(enemyType, 'approach', t, 0, 0, 0, 0));
    }
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'telegraph', 0.0, 0.3, 0, 0, 0));
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'telegraph', 0.16, 0.2, 0, 0, 0));
    for (const st of [0.25, 0.18, 0.1, 0.02]) {
      enemySeen.add(getEnemySheetFrameIndex(enemyType, 'attack', 0.1, st, 0, 0, 0));
      enemySeen.add(getEnemySheetFrameIndex(enemyType, 'attack', 0.1, st, 0, 0, 1));
    }
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'hurt', 0.05, 0.3, 0, 0, 0));
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'thrown', 0.05, 0.4, 30, 120, 0));
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'knockdown', 0.05, 0.4, 0, 0, 0));
    enemySeen.add(getEnemySheetFrameIndex(enemyType, 'recover', 0.05, 0.5, 0, 0, 0));
    assert.equal(
      enemySeen.size,
      16,
      `Expected all 16 ${enemyType} sheet frames to be utilized, saw ${[...enemySeen].sort((a, b) => a - b).join(',')}`
    );
  }

  // 3. Boss 1 (Tronco)
  const boss1Seen = new Set<number>();
  boss1Seen.add(getBoss1FrameIndex('idle', 'doublePunch', 0.0, 0, 0, 0));
  boss1Seen.add(getBoss1FrameIndex('idle', 'doublePunch', 0.3, 0, 0, 0));
  for (let t = 0; t < 0.8; t += 0.12) {
    boss1Seen.add(getBoss1FrameIndex('chase', 'doublePunch', t, 0, 0, 0));
  }
  boss1Seen.add(getBoss1FrameIndex('telegraph', 'doublePunch', 0.0, 0.3, 0, 0));
  boss1Seen.add(getBoss1FrameIndex('telegraph', 'doublePunch', 0.18, 0.2, 0, 0));
  for (const st of [0.35, 0.2, 0.08]) {
    boss1Seen.add(getBoss1FrameIndex('attack', 'doublePunch', 0.1, st, 0, 0));
    boss1Seen.add(getBoss1FrameIndex('attack', 'shoulderCharge', 0.1, st, 0, 0));
    boss1Seen.add(getBoss1FrameIndex('attack', 'stompWave', 0.1, st, 0, 0));
  }
  boss1Seen.add(getBoss1FrameIndex('hurt', 'doublePunch', 0.05, 0.2, 0, 0));
  boss1Seen.add(getBoss1FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 30, 120));
  boss1Seen.add(getBoss1FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 0, 0));
  assert.equal(
    boss1Seen.size,
    16,
    `Expected all 16 Boss 1 frames to be utilized, saw ${[...boss1Seen].sort((a, b) => a - b).join(',')}`
  );

  // 4. Boss 2 (Stage 2 CarlitosRun)
  const boss2Seen = new Set<number>();
  boss2Seen.add(getBoss2FrameIndex('intro', 'radioDash', 0.0, 0, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('idle', 'radioDash', 0.0, 0, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('idle', 'radioDash', 0.3, 0, 0, 0));
  for (let t = 0; t < 0.8; t += 0.1) {
    boss2Seen.add(getBoss2FrameIndex('chase', 'radioDash', t, 0, 0, 0));
  }
  boss2Seen.add(getBoss2FrameIndex('telegraph', 'flyingKick', 0.0, 0.3, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('telegraph', 'stompWave', 0.0, 0.3, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('telegraph', 'jingleBuff', 0.0, 0.3, 0, 0));
  for (const st of [0.35, 0.2, 0.08]) {
    boss2Seen.add(getBoss2FrameIndex('attack', 'doublePunch', 0.1, st, 0, 0));
    boss2Seen.add(getBoss2FrameIndex('attack', 'radioDash', 0.1, st, 0, 0));
    boss2Seen.add(getBoss2FrameIndex('attack', 'flyingKick', 0.1, st, 25, 100));
    boss2Seen.add(getBoss2FrameIndex('attack', 'jingleBuff', 0.1, st, 0, 0));
    boss2Seen.add(getBoss2FrameIndex('attack', 'stompWave', 0.1, st, 0, 0));
  }
  boss2Seen.add(getBoss2FrameIndex('hurt', 'doublePunch', 0.05, 0.2, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 30, 120));
  boss2Seen.add(getBoss2FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('getup', 'doublePunch', 0.05, 0.2, 0, 0));
  boss2Seen.add(getBoss2FrameIndex('recover', 'doublePunch', 0.05, 0.5, 0, 0));
  assert.equal(
    boss2Seen.size,
    16,
    `Expected all 16 Boss 2 frames to be utilized, saw ${[...boss2Seen].sort((a, b) => a - b).join(',')}`
  );

  // 5. Boss 3 (Stage 3 Ivan Martinez - El sepulturero)
  const boss3Seen = new Set<number>();
  boss3Seen.add(getBoss3FrameIndex('intro', 'doublePunch', 0.0, 0, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('idle', 'doublePunch', 0.0, 0, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('idle', 'doublePunch', 0.3, 0, 0, 0));
  for (let t = 0; t < 0.8; t += 0.1) {
    boss3Seen.add(getBoss3FrameIndex('chase', 'doublePunch', t, 0, 0, 0));
  }
  boss3Seen.add(getBoss3FrameIndex('telegraph', 'flyingKick', 0.0, 0.3, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('telegraph', 'stompWave', 0.0, 0.3, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('telegraph', 'throwPhone', 0.0, 0.3, 0, 0));
  for (const st of [0.35, 0.2, 0.08]) {
    boss3Seen.add(getBoss3FrameIndex('attack', 'doublePunch', 0.1, st, 0, 0));
    boss3Seen.add(getBoss3FrameIndex('attack', 'shoulderCharge', 0.1, st, 0, 0));
    boss3Seen.add(getBoss3FrameIndex('attack', 'flyingKick', 0.1, st, 25, 100));
    boss3Seen.add(getBoss3FrameIndex('attack', 'stompWave', 0.1, st, 0, 0));
    boss3Seen.add(getBoss3FrameIndex('attack', 'throwPhone', 0.1, st, 0, 0));
  }
  boss3Seen.add(getBoss3FrameIndex('hurt', 'doublePunch', 0.05, 0.2, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 30, 120));
  boss3Seen.add(getBoss3FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('getup', 'doublePunch', 0.05, 0.2, 0, 0));
  boss3Seen.add(getBoss3FrameIndex('recover', 'doublePunch', 0.05, 0.5, 0, 0));
  assert.equal(
    boss3Seen.size,
    16,
    `Expected all 16 Boss 3 frames to be utilized, saw ${[...boss3Seen].sort((a, b) => a - b).join(',')}`
  );

  // 6. Boss 4 (Stage 4 El JC Que Le Dicen)
  const boss4Seen = new Set<number>();
  boss4Seen.add(getBoss4FrameIndex('intro', 'doublePunch', 0.0, 0, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('idle', 'doublePunch', 0.0, 0, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('idle', 'doublePunch', 0.3, 0, 0, 0));
  for (let t = 0; t < 0.8; t += 0.1) {
    boss4Seen.add(getBoss4FrameIndex('chase', 'doublePunch', t, 0, 0, 0));
  }
  boss4Seen.add(getBoss4FrameIndex('telegraph', 'flyingKick', 0.0, 0.3, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('telegraph', 'stompWave', 0.0, 0.3, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('telegraph', 'noteFan', 0.0, 0.3, 0, 0));
  for (const st of [0.35, 0.2, 0.08]) {
    boss4Seen.add(getBoss4FrameIndex('attack', 'doublePunch', 0.1, st, 0, 0));
    boss4Seen.add(getBoss4FrameIndex('attack', 'shoulderCharge', 0.1, st, 0, 0));
    boss4Seen.add(getBoss4FrameIndex('attack', 'flyingKick', 0.1, st, 25, 100));
    boss4Seen.add(getBoss4FrameIndex('attack', 'stompWave', 0.1, st, 0, 0));
    boss4Seen.add(getBoss4FrameIndex('attack', 'noteFan', 0.1, st, 0, 0));
  }
  boss4Seen.add(getBoss4FrameIndex('hurt', 'doublePunch', 0.05, 0.2, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 30, 120));
  boss4Seen.add(getBoss4FrameIndex('knockdown', 'doublePunch', 0.05, 0.4, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('getup', 'doublePunch', 0.05, 0.2, 0, 0));
  boss4Seen.add(getBoss4FrameIndex('recover', 'doublePunch', 0.05, 0.5, 0, 0));
  assert.equal(
    boss4Seen.size,
    16,
    `Expected all 16 Boss 4 frames to be utilized, saw ${[...boss4Seen].sort((a, b) => a - b).join(',')}`
  );
});

test('zero-allocation InPlace/Into helpers produce results identical to pure counterparts', () => {
  const timestamps: number[] = [];
  assert.equal(recordEnemyHitAndCheckKnockdownInPlace(timestamps, 10.0), false);
  assert.deepEqual(timestamps, [10.0]);
  assert.equal(recordEnemyHitAndCheckKnockdownInPlace(timestamps, 11.0), false);
  assert.deepEqual(timestamps, [10.0, 11.0]);
  assert.equal(recordEnemyHitAndCheckKnockdownInPlace(timestamps, 11.8), true);
  assert.deepEqual(timestamps, []);

  const expiredTimestamps = [5.0, 6.0];
  assert.equal(recordEnemyHitAndCheckKnockdownInPlace(expiredTimestamps, 9.0), false);
  assert.deepEqual(expiredTimestamps, [9.0]);

  const normOut = { nx: 99, ny: 99 };
  normalizeMoveAxesInto(normOut, 1, 1);
  assert.deepEqual(normOut, normalizeMoveAxes(1, 1));
  normalizeMoveAxesInto(normOut, 0, 0);
  assert.deepEqual(normOut, { nx: 0, ny: 0 });

  const velOut = { vx: 0, vy: 0 };
  stepVelocity2DInto(velOut, 10, -20, 170, 0, 2600, 3200, 0.02);
  assert.deepEqual(velOut, stepVelocity2D(10, -20, 170, 0, 2600, 3200, 0.02));

  const shadowOut = { offsetX: 0, rx: 0, ry: 0, alpha: 0 };
  computeDirectionalShadowInto(shadowOut, 520, 120, 56, 1, 400);
  assert.deepEqual(shadowOut, computeDirectionalShadow(520, 120, 56, 1, 400));
});

test('Xbox controller auto-detection, deadzone, D-pad, and button mapping', () => {
  assert.equal(isXboxGamepadId('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b12)'), true);
  assert.equal(isXboxGamepadId('Microsoft X-Box 360 Pad'), true);
  assert.equal(isXboxGamepadId('Generic USB Joystick'), false);

  const makeButtons = (activeIndices: number[]) =>
    Array.from({ length: 16 }, (_, idx) => ({
      pressed: activeIndices.includes(idx),
      value: activeIndices.includes(idx) ? 1 : 0,
    }));

  const genericPad = {
    id: 'Generic Gamepad',
    mapping: 'standard',
    connected: true,
    axes: [0, 0],
    buttons: makeButtons([]),
  };
  const xboxPad = {
    id: 'Xbox Wireless Controller (Vendor: 045e Product: 0b12)',
    mapping: 'standard',
    connected: true,
    axes: [0.1, -0.15], // inside 0.24 deadzone
    buttons: makeButtons([2, 3, 8, 15]), // X (attack), Y (special), View (mute), D-pad right
  };

  const picked = pickPrimaryGamepad([null, genericPad, xboxPad]);
  assert.equal(picked, xboxPad);

  const snap = createEmptyGamepadSnapshot();
  readGamepadInto(xboxPad, snap);
  assert.equal(snap.connected, true);
  assert.equal(snap.isXbox, true);
  assert.equal(snap.moveX, 1); // D-pad right overrides stick
  assert.equal(snap.moveY, 0); // Stick Y inside deadzone -> 0
  assert.equal(snap.attackPressed, true); // X maps to attack
  assert.equal(snap.confirmPressed, false); // Confirm requires A (0)
  assert.equal(snap.jumpPressed, false);
  assert.equal(snap.specialPressed, true); // Y maps to special
  assert.equal(snap.mutePressed, true); // View/Back maps to mute
  assert.equal(snap.dpadRight, true);

  // Non-standard xpad D-pad (cruceta) via axes[6] / axes[7]
  const linuxXpad = {
    id: 'Microsoft X-Box 360 pad',
    mapping: '',
    connected: true,
    axes: [0, 0, -1, 0, 0, -1, -1, 1], // D-pad left (-1 on axis 6) + down (+1 on axis 7)
    buttons: makeButtons([]),
  };
  assert.equal(pickPrimaryGamepad([genericPad, linuxXpad]), linuxXpad);
  readGamepadInto(linuxXpad, snap);
  assert.equal(snap.dpadLeft, true);
  assert.equal(snap.dpadDown, true);
  assert.equal(snap.moveX, -1);
  assert.equal(snap.moveY, 1);

  // Non-standard HID POV hat D-pad via axes[9] (-0.714 = Up-Right, +1.2857 = Neutral)
  const povPad = {
    id: 'Xbox Bluetooth Controller',
    mapping: '',
    connected: true,
    axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, -0.714],
    buttons: makeButtons([]),
  };
  readGamepadInto(povPad, snap);
  assert.equal(snap.dpadUp, true);
  assert.equal(snap.dpadRight, true);
  assert.equal(snap.dpadLeft, false);
  assert.equal(snap.dpadDown, false);
  assert.equal(snap.moveX, 1);
  assert.equal(snap.moveY, -1);

  povPad.axes[9] = 1.2857; // POV centered/neutral
  readGamepadInto(povPad, snap);
  assert.equal(snap.dpadUp, false);
  assert.equal(snap.dpadRight, false);
  assert.equal(snap.moveX, 0);
  assert.equal(snap.moveY, 0);

  // Disconnecting resets state completely (stick never stays stuck)
  readGamepadInto(null, snap);
  assert.equal(snap.connected, false);
  assert.equal(snap.moveX, 0);
  assert.equal(snap.moveY, 0);
  assert.equal(snap.attackPressed, false);
  assert.equal(snap.specialPressed, false);
});

test('hitstop budget prevents chain-freezing across dense enemy crowds', () => {
  const first = resolveHitstopBudget(0, 0, true);
  assert.ok(first.hitstopTimer > 0 && first.hitstopTimer <= 0.09);
  assert.ok(first.hitstopCooldown > 0.15);

  // Subsequent enemy hits inside the cooldown window must NOT re-stall simulation
  const second = resolveHitstopBudget(0, first.hitstopCooldown, true);
  assert.equal(second.hitstopTimer, 0);
  assert.equal(second.hitstopCooldown, first.hitstopCooldown);

  // Once cooldown drains, hitstop triggers cleanly again
  const afterCooldown = resolveHitstopBudget(0, 0, false);
  assert.ok(afterCooldown.hitstopTimer > 0);
});

test('grabbedByEnemy failsafe recovers from orphaned drainers, timeouts, mashing, and specials', () => {
  // Orphaned drainer (e.g. enemy despawned or cleared on boss encounter) frees player immediately
  const orphaned = evaluateGrabbedByEnemyState({
    stateTimer: 2.0,
    dt: 1 / 60,
    mashBreakCount: 0,
    hasActiveDrainer: false,
    specialEscape: false,
  });
  assert.equal(orphaned.shouldRelease, true);
  assert.equal(orphaned.usedSpecial, false);

  // Active drainer times out cleanly instead of softlocking forever (e.g. Boss 5 signatureGrab)
  const mid = evaluateGrabbedByEnemyState({
    stateTimer: 1.0,
    dt: 0.25,
    mashBreakCount: 1,
    hasActiveDrainer: true,
    specialEscape: false,
  });
  assert.equal(mid.shouldRelease, false);
  assert.equal(mid.nextTimer, 0.75);

  const expired = evaluateGrabbedByEnemyState({
    stateTimer: 0.1,
    dt: 0.2,
    mashBreakCount: 0,
    hasActiveDrainer: true,
    specialEscape: false,
  });
  assert.equal(expired.shouldRelease, true);

  // Special button breaks grab immediately
  const special = evaluateGrabbedByEnemyState({
    stateTimer: 2.5,
    dt: 1 / 60,
    mashBreakCount: 0,
    hasActiveDrainer: true,
    specialEscape: true,
  });
  assert.equal(special.shouldRelease, true);
  assert.equal(special.usedSpecial, true);
});

test('crowd grabHold allows holding away or dodging vertically to break free while keeping back-throw', () => {
  // Simultaneous opposite + attack stays in grab so back-throw executes
  const backThrow = shouldReleaseCrowdGrabHold({
    facing: 1,
    left: true,
    right: false,
    up: false,
    down: false,
    attackJustPressed: true,
    jumpJustPressed: false,
    disengageTimer: 0.14,
    dt: 1 / 60,
  });
  assert.equal(backThrow.shouldRelease, false);

  // Holding opposite or vertical without attacking breaks free smoothly instead of 2.4s lock
  let timer = 0;
  let released = false;
  for (let i = 0; i < 12; i++) {
    const res = shouldReleaseCrowdGrabHold({
      facing: 1,
      left: true,
      right: false,
      up: false,
      down: false,
      attackJustPressed: false,
      jumpJustPressed: false,
      disengageTimer: timer,
      dt: 1 / 60,
    });
    timer = res.nextDisengageTimer;
    if (res.shouldRelease) {
      released = true;
      break;
    }
  }
  assert.equal(released, true);

  // Vertical dodge also releases grabHold
  const verticalRelease = shouldReleaseCrowdGrabHold({
    facing: 1,
    left: false,
    right: false,
    up: true,
    down: false,
    attackJustPressed: false,
    jumpJustPressed: false,
    disengageTimer: 0.15,
    dt: 0.02,
  });
  assert.equal(verticalRelease.shouldRelease, true);
});




