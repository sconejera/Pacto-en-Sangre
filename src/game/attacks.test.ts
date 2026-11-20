import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_FRAME_DATA, CHARACTERS, WEAPON_STATS } from './data';
import {
  buildAttackHitboxInto,
  canChainFromTick,
  getAttackFrameSlot,
  getAttackPhase,
  getAttackTotalTicks,
  overlapsHitbox25D,
} from './rules';
import { SPRITE_MAP } from './sprites';
import type { AttackSlot, CharacterId } from './types';

const CHAR_IDS: CharacterId[] = ['bayron', 'marcianeke', 'crismj'];
const SLOTS: AttackSlot[] = ['combo1', 'combo2', 'combo3', 'airKick'];

test('CA-04: getAttackPhase transitions accurately across startup, active, recovery, and done for all 12 attacks', () => {
  for (const charId of CHAR_IDS) {
    for (const slot of SLOTS) {
      const data = ATTACK_FRAME_DATA[charId][slot];
      const s = data.startupTicks;
      const a = data.activeTicks;
      const r = data.recoveryTicks;
      const total = getAttackTotalTicks(data);

      assert.equal(total, s + a + r, `${charId}.${slot} total ticks`);
      assert.equal(getAttackPhase(0, data), 'startup', `${charId}.${slot} tick 0`);
      assert.equal(getAttackPhase(s - 1, data), 'startup', `${charId}.${slot} last startup tick`);
      assert.equal(getAttackPhase(s, data), 'active', `${charId}.${slot} first active tick`);
      assert.equal(
        getAttackPhase(s + a - 1, data),
        'active',
        `${charId}.${slot} last active tick`
      );
      if (r > 0) {
        assert.equal(
          getAttackPhase(s + a, data),
          'recovery',
          `${charId}.${slot} first recovery tick`
        );
        assert.equal(
          getAttackPhase(total - 1, data),
          'recovery',
          `${charId}.${slot} last recovery tick`
        );
      }
      assert.equal(getAttackPhase(total, data), 'done', `${charId}.${slot} done tick`);
    }
  }
});

test('CA-05: buildAttackHitboxInto keeps rear edge at +12px in front of player and front edge within 2px of 1.05*(base+extra)', () => {
  const out = { x: 0, z: 0, w: 0, h: 0 };
  const playerX = 300;
  const playerZ = 14;
  const extras = [0, 10, 32];

  for (const extra of extras) {
    const comboData = ATTACK_FRAME_DATA.bayron.combo1;
    buildAttackHitboxInto(out, playerX, playerZ, 1, comboData, extra);
    const frontR = out.x + out.w * 0.5;
    const rearR = out.x - out.w * 0.5;
    assert.equal(rearR, playerX + 12, `combo facing +1 rear edge (extra=${extra})`);
    assert.ok(
      Math.abs(frontR - (playerX + 1.05 * (54 + extra))) <= 2,
      `combo facing +1 front edge within 2px (extra=${extra}): got ${frontR - playerX}`
    );
    assert.equal(out.z, playerZ);
    assert.equal(out.h, 96);

    buildAttackHitboxInto(out, playerX, playerZ, -1, comboData, extra);
    const frontL = out.x - out.w * 0.5;
    const rearL = out.x + out.w * 0.5;
    assert.equal(rearL, playerX - 12, `combo facing -1 rear edge (extra=${extra})`);
    assert.ok(
      Math.abs(frontL - (playerX - 1.05 * (54 + extra))) <= 2,
      `combo facing -1 front edge within 2px (extra=${extra}): got ${playerX - frontL}`
    );

    const airData = ATTACK_FRAME_DATA.crismj.airKick;
    buildAttackHitboxInto(out, playerX, playerZ, 1, airData, extra);
    assert.equal(out.x - out.w * 0.5, playerX + 12, `airKick rear edge (extra=${extra})`);
    assert.ok(
      Math.abs(out.x + out.w * 0.5 - (playerX + 1.05 * (56 + extra))) <= 2,
      `airKick front edge within 2px (extra=${extra})`
    );
  }

  // Verify enemy center > 9px behind player does NOT overlap frontal hitbox while enemy at +40px hits
  buildAttackHitboxInto(out, playerX, 0, 1, ATTACK_FRAME_DATA.bayron.combo1, 0);
  const behindCenter = playerX - 15;
  const slightlyBehindCenter = playerX - 10; // front edge -10 + 21 = +11 < 12
  const frontCenter = playerX + 40;
  assert.equal(overlapsHitbox25D(out.x, 480, out.z, out.w, out.h, behindCenter, 480, 0, 42, 92), false);
  assert.equal(
    overlapsHitbox25D(out.x, 480, out.z, out.w, out.h, slightlyBehindCenter, 480, 0, 42, 92),
    false
  );
  assert.equal(overlapsHitbox25D(out.x, 480, out.z, out.w, out.h, frontCenter, 480, 0, 42, 92), true);
});

test('CA-06: ATTACK_FRAME_DATA structural integrity, 4 sprite slots per anim, and Cris < Marcianeke < Bayron combo1 speed', () => {
  for (const charId of CHAR_IDS) {
    for (const slot of SLOTS) {
      const data = ATTACK_FRAME_DATA[charId][slot];
      assert.ok(Number.isInteger(data.startupTicks) && data.startupTicks >= 1);
      assert.ok(Number.isInteger(data.activeTicks) && data.activeTicks >= 1);
      assert.ok(Number.isInteger(data.recoveryTicks) && data.recoveryTicks >= 0);
      assert.ok(data.hitStartX >= 0 && data.hitEndX > data.hitStartX);
      assert.ok(data.hitHeight > 0);
    }

    const animNames = ['attack1', 'attack2', 'attack3', 'airKick'] as const;
    for (const anim of animNames) {
      assert.equal(
        SPRITE_MAP[charId].animations[anim].frames.length,
        4,
        `${charId}.${anim} must keep 4 sprite frame slots`
      );
    }
  }

  const crisTotal = getAttackTotalTicks(ATTACK_FRAME_DATA.crismj.combo1);
  const marciaTotal = getAttackTotalTicks(ATTACK_FRAME_DATA.marcianeke.combo1);
  const bayronTotal = getAttackTotalTicks(ATTACK_FRAME_DATA.bayron.combo1);
  assert.ok(crisTotal < marciaTotal && marciaTotal < bayronTotal);
  assert.equal(crisTotal, 8);
  assert.equal(marciaTotal, 9);
  assert.equal(bayronTotal, 10);

  // Confirm weapon + kickExtraReach stays compatible with combo3
  const maxExtra = CHARACTERS.crismj.kickExtraReach + WEAPON_STATS.cadena.reachBonus;
  const box = { x: 0, z: 0, w: 0, h: 0 };
  buildAttackHitboxInto(box, 100, 0, 1, ATTACK_FRAME_DATA.crismj.combo3, maxExtra);
  assert.ok(Math.abs(box.x + box.w * 0.5 - (100 + 1.05 * (54 + maxExtra))) <= 2);
});

test('canChainFromTick and getAttackFrameSlot align with attack phases', () => {
  const bayronC1 = ATTACK_FRAME_DATA.bayron.combo1; // 3 / 3 / 4
  for (let t = 0; t < 3; t++) {
    assert.equal(canChainFromTick(t, bayronC1), false);
    assert.equal(getAttackFrameSlot(t, bayronC1), 0);
  }
  for (let t = 3; t < 6; t++) {
    assert.equal(canChainFromTick(t, bayronC1), false);
    assert.equal(getAttackFrameSlot(t, bayronC1), 1);
  }
  assert.equal(canChainFromTick(6, bayronC1), true);
  assert.equal(getAttackFrameSlot(6, bayronC1), 2);
  assert.equal(getAttackFrameSlot(7, bayronC1), 2);
  assert.equal(getAttackFrameSlot(8, bayronC1), 3);
  assert.equal(getAttackFrameSlot(9, bayronC1), 3);
  assert.equal(getAttackFrameSlot(10, bayronC1), 3);

  const bayronC3 = ATTACK_FRAME_DATA.bayron.combo3; // 4 / 3 / 5
  assert.equal(getAttackFrameSlot(7, bayronC3), 2);
  assert.equal(getAttackFrameSlot(9, bayronC3), 2);
  assert.equal(getAttackFrameSlot(10, bayronC3), 3);
  assert.equal(getAttackFrameSlot(11, bayronC3), 3);
});
