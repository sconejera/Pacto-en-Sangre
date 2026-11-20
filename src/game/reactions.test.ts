import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnimationFrameIndex, SPRITE_MAP } from './sprites';
import type { CharacterId } from './types';

const HEROES: CharacterId[] = ['bayron', 'marcianeke', 'crismj'];

test('CA-04: hurt, knockdown, getup, and grabbedByEnemy pose timelines across all 3 heroes', () => {
  for (const id of HEROES) {
    const hurtAnim = SPRITE_MAP[id].animations.hurt;
    assert.deepEqual(hurtAnim.frames, [12, 12, 12, 4], `${id} hurt frames`);
    assert.equal(hurtAnim.fps, 10, `${id} hurt fps`);
    assert.equal(hurtAnim.loop, false, `${id} hurt non-looping`);

    // 0 .. <0.30 s shows reaction pose 12; >=0.30 s settles into pose 4
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0), 12, `${id} hurt t=0`);
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0.12), 12, `${id} hurt t=0.12`);
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0.25), 12, `${id} hurt t=0.25`);
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0.299), 12, `${id} hurt t=0.299`);
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0.3), 4, `${id} hurt t=0.3`);
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0.33), 4, `${id} hurt t=0.33`);
    assert.equal(getAnimationFrameIndex(id, 'hurt', 0.36), 4, `${id} hurt t=0.36`);

    // Knockdown starts in pose 12 then drops to KO pose 13
    assert.equal(getAnimationFrameIndex(id, 'knockdown', 0), 12, `${id} knockdown t=0`);
    assert.equal(getAnimationFrameIndex(id, 'knockdown', 0.2), 13, `${id} knockdown t=0.2`);
    assert.equal(getAnimationFrameIndex(id, 'knockdown', 0.8), 13, `${id} knockdown t=0.8`);

    // Getup begins at KO pose 13 and animates through squat/lean back to idle
    assert.equal(getAnimationFrameIndex(id, 'getup', 0), 13, `${id} getup t=0`);
    assert.equal(getAnimationFrameIndex(id, 'getup', 0.08), 4, `${id} getup t=0.08`);
    assert.equal(getAnimationFrameIndex(id, 'getup', 0.15), 7, `${id} getup t=0.15`);
    assert.equal(getAnimationFrameIndex(id, 'getup', 0.23), 0, `${id} getup t=0.23`);

    // Grabbed hold uses fixed hurt.frames[0] === 12 regardless of animTime
    assert.equal(hurtAnim.frames[0], 12, `${id} fixed grab pose`);
  }
});
