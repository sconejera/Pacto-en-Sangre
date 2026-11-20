import { GameAudio } from './audio';
import {
  ATTACK_FRAME_DATA,
  BOSSES,
  CHARACTERS,
  ENEMY_BASE_STATS,
  GRAVITY,
  ITEM_STATS,
  LEVELS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PALETTE,
  STORY,
  WALK_MAX_Y,
  WALK_MIN_Y,
  WEAPON_STATS,
} from './data';
import { renderWorld, type RenderWorldState } from './renderer';
import {
  applyAdaptiveDifficultyToSpawns,
  applySpecialCost,
  buildAttackHitboxInto,
  canActivateSpecial,
  canChainFromTick,
  clampWalkY,
  computeLevelResults,
  computeSpawnStagger,
  countCrossedExtraLives,
  createEmptyGamepadSnapshot,
  evaluateGrabbedByEnemyState,
  getAttackPhase,
  getAttackTotalTicks,
  getPlayerAttackDamage,
  lerp,
  normalizeMoveAxesInto,
  overlapsHitbox25D,
  pickPrimaryGamepad,
  readGamepadInto,
  recordEnemyHitAndCheckKnockdownInPlace,
  resolveDeadzoneFacing,
  resolveHitstopBudget,
  resolveZoneArenaBounds,
  scaleEnemyStats,
  shouldReleaseCrowdGrabHold,
  stepCameraTowards,
  stepVelocity2DInto,
  type GamepadSnapshotState,
} from './rules';
import { loadAllCharacterSprites } from './sprites';
import { loadAllWorldAssets, type WorldAssets } from './worldSprites';
import type {
  AttackSlot,
  BossAttackKind,
  BossEntity,
  BreakableEntity,
  CharacterId,
  EnemyEntity,
  EnemyType,
  FloatingText,
  GameScreen,
  HazardZone,
  HudSnapshot,
  ItemType,
  LevelDef,
  Particle,
  PickupEntity,
  PlayerActionState,
  PlayerEntity,
  ProjectileEntity,
  WeaponType,
} from './types';

const STORAGE_KEY_HIGHSCORE = 'no_firmo_highscore_v1';
const STORAGE_KEY_REDUCE_FX = 'no_firmo_reduce_fx_v1';
const STORAGE_KEY_MUTED = 'no_firmo_muted_v1';
const STORAGE_KEY_MUSIC_VOL = 'no_firmo_music_vol_v1';
const STORAGE_KEY_SFX_VOL = 'no_firmo_sfx_vol_v1';

const PARTICLE_POOL_SIZE = 300;
const FLOATING_TEXT_POOL_SIZE = 48;

const BOSS_MELEE_ATTACKS = new Set<BossAttackKind>([
  'doublePunch',
  'shoulderCharge',
  'radioDash',
  'flyingKick',
  'briefcaseSwing',
  'signatureGrab',
]);
const NOTE_FAN_VY = [-70, 0, 70] as const;
const BOSS_KO_DROPS: readonly ItemType[] = ['disco', 'empanada', 'billete', 'billete', 'sandwich'];

export type GamepadUiAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'start';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attackJustPressed: boolean;
  jumpJustPressed: boolean;
  specialJustPressed: boolean;
  joyX: number;
  joyY: number;
}

export class NoFirmoEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audio = new GameAudio();
  private onHudUpdate: (snap: HudSnapshot) => void;
  private uiNavHandler: ((action: GamepadUiAction) => void) | null = null;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private accumulator = 0;
  private timeSec = 0;
  private hitstopTimer = 0;
  private hitstopCooldown = 0;
  private grabCooldown = 0;
  private hudSyncTimer = 0;

  private screen: GameScreen = 'CARGA';
  private selectedCharId: CharacterId = 'marcianeke';
  private availableCharacters: CharacterId[] = ['bayron', 'marcianeke', 'crismj'];
  private sprites: Partial<Record<CharacterId, HTMLImageElement>> = {};
  private frameCanvases: Partial<Record<CharacterId, HTMLCanvasElement[]>> = {};
  private worldAssets: WorldAssets = {
    enemies: {},
    enemySheets: {},
    bosses: {},
    boss1Frames: [],
    boss2Frames: [],
    boss3Frames: [],
    boss4Frames: [],
    boss5Frames: [],
    breakables: {},
    pickups: {},
    backgrounds: {},
    backgroundsAlt: {},
    bonusCourtBg: null,
    titleBg: null,
    errors: [],
  };
  private spriteError: string | null = null;

  // Players array for 2P-ready architecture (MVP uses players[0])
  private players: PlayerEntity[] = [];
  private levelIndex = 0;
  private activeZoneIndex = 0;
  private zoneLocked = false;
  private zoneLostLifeFlag = false;
  private clearedZones = new Set<string>();
  private bossSpawned = false;
  private bonusRoomActive = false;
  private bonusClearTimer = 0;

  private cameraX = 0;
  private prevCameraX = 0;
  private cameraTargetX: number | null = null;
  private cameraMinX = 0;
  private cameraMaxX = 9600;
  private cameraZoom = 1;
  private prevCameraZoom = 1;
  private renderAlpha = 1;
  private shakeTrauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private whiteFlashTimer = 0;

  private nextEntityId = 1;
  private enemies: EnemyEntity[] = [];
  private boss: BossEntity | null = null;
  private breakables: BreakableEntity[] = [];
  private pickups: PickupEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private hazards: HazardZone[] = [];
  private particles: Particle[] = [];
  private particleCursor = 0;
  private floatingTexts: FloatingText[] = [];
  private textCursor = 0;

  private specialFx = {
    active: false,
    charId: 'marcianeke' as CharacterId,
    x: 0,
    y: 0,
    timer: 0,
    maxTimer: 0.6,
  };

  private dripTimer = 7.0;
  private levelTimer = 0;
  private continueCountdown = 10;
  private goArrowTimer = 0;
  private bannerTimer = 0;
  private bannerText: string | null = null;
  private specialBannerTimer = 0;
  private specialBannerText: string | null = null;
  private tutorialHint: string | null = null;
  private dialogueSpeaker: string | null = null;
  private dialogueText: string | null = null;
  private introTimer = 0;
  private bossDangerTimer = 0;
  private bossDefeatTimer = 0;
  private levelResults: HudSnapshot['levelResults'] = null;
  private prologueStep = 0;
  private endingStep = 0;

  private lastTargetName: string | null = null;
  private lastTargetHp = 0;
  private lastTargetMaxHp = 0;

  private highScore = 0;
  private reduceEffects = false;
  private titleBackdropDrawn = false;
  private lastHudSnap: HudSnapshot | null = null;
  private renderStateScratch: RenderWorldState | null = null;
  private inputScratch: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    attackJustPressed: false,
    jumpJustPressed: false,
    specialJustPressed: false,
    joyX: 0,
    joyY: 0,
  };
  private normScratch = { nx: 0, ny: 0 };
  private velScratch = { vx: 0, vy: 0 };
  private atkBoxScratch = { x: 0, z: 0, w: 0, h: 0 };
  private simTick = 0;
  private devTracing = false;
  private devTrace: {
    simTick: number;
    state: PlayerActionState;
    comboStep: 0 | 1 | 2 | 3;
    attackTick: number;
    hits: number;
    stateTimer: number;
    animTime: number;
    frame: number | null;
  }[] = [];
  private devChainedHits: number | null = null;

  private debugEnabled = false;
  private debugHitboxes = false;
  private debugGodMode = false;

  // Input tracking
  private heldKeys = new Set<string>();
  private touchState = {
    joyX: 0,
    joyY: 0,
    attackHeld: false,
    jumpHeld: false,
  };
  private attackPressQueue = false;
  private jumpPressQueue = false;
  private specialPressQueue = false;
  private attackBufferTimer = 0;
  private jumpBufferTimer = 0;
  private lastAttackTimestamp = -1;
  private lastJumpTimestamp = -1;
  private lastDirTap: { dir: -1 | 1 | 0; time: number } = { dir: 0, time: -1 };
  private runActiveDir: -1 | 1 | 0 = 0;
  private gamepadState: GamepadSnapshotState = createEmptyGamepadSnapshot();
  private gamepadConnected = false;
  private gamepadName: string | null = null;
  private prevGamepadButtons = {
    attack: false,
    jump: false,
    special: false,
    confirm: false,
    cancel: false,
    start: false,
    mute: false,
    dirX: 0 as -1 | 0 | 1,
  };
  private lastGamepadNavDir: 'up' | 'down' | 'left' | 'right' | null = null;
  private gamepadNavRepeatTimer = 0;

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false }) ?? canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar el contexto 2D del canvas.');
    this.ctx = ctx;
    this.onHudUpdate = onHudUpdate;

    // Pre-allocate pools (zero-GC)
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 4,
        color: '#FFFFFF',
        kind: 'spark',
      });
    }
    for (let i = 0; i < FLOATING_TEXT_POOL_SIZE; i++) {
      this.floatingTexts.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vy: 0,
        text: '',
        color: '#FFFFFF',
        life: 0,
        maxLife: 1,
        scale: 1,
      });
    }

    this.loadPreferences();
    const params = new URLSearchParams(window.location.search);
    this.debugEnabled = params.has('debug');
    const autostart = params.get('autostart') === '1';

    this.players = [this.createPlayer('marcianeke')];
    this.setupLevel(0, false);

    this.bindEvents();
    this.audio.preload();
    void this.initAssets(autostart);

    if (import.meta.env.MODE !== 'production') {
      const win = window as unknown as {
        __NF_DEBUG__?: {
          startTrace: () => void;
          getTrace: () => {
            simTick: number;
            state: PlayerActionState;
            comboStep: 0 | 1 | 2 | 3;
            attackTick: number;
            hits: number;
            stateTimer: number;
            animTime: number;
            frame: number | null;
          }[];
          spawnTestBreakable: (dx: number) => number | null;
        };
      };
      win.__NF_DEBUG__ = {
        startTrace: () => {
          this.devTrace = [];
          this.devTracing = true;
        },
        getTrace: () => this.devTrace.slice(),
        spawnTestBreakable: (dx: number) => {
          const p = this.players[0];
          if (!p) return null;
          const id = this.nextEntityId++;
          this.breakables.push({
            id,
            kind: 'cajon',
            x: p.x + dx,
            y: p.y,
            hp: 2,
            maxHp: 2,
            hitFlashTimer: 0,
            broken: false,
          });
          return id;
        },
      };
    }
  }

  private async initAssets(autostart: boolean): Promise<void> {
    const [loaded, worldLoaded] = await Promise.all([
      loadAllCharacterSprites(),
      loadAllWorldAssets(),
    ]);
    this.sprites = loaded.sheets;
    this.frameCanvases = loaded.frameCanvases;
    this.worldAssets = worldLoaded;
    this.availableCharacters =
      loaded.available.length > 0 ? loaded.available : ['bayron', 'marcianeke', 'crismj'];
    const allErrors = [loaded.error, ...worldLoaded.errors].filter(Boolean);
    this.spriteError = allErrors.length > 0 ? allErrors.join(' | ') : null;
    if (!this.availableCharacters.includes(this.selectedCharId)) {
      this.selectedCharId = this.availableCharacters[0];
    }

    if (autostart) {
      this.startRun(this.selectedCharId);
    } else {
      this.titleBackdropDrawn = false;
      this.setScreen('MENÚ');
      this.audio.playRandomTrack();
    }
    this.emitHud(true);
  }

  private loadPreferences(): void {
    try {
      const hs = localStorage.getItem(STORAGE_KEY_HIGHSCORE);
      if (hs) this.highScore = Math.max(0, parseInt(hs, 10) || 0);
      this.reduceEffects = localStorage.getItem(STORAGE_KEY_REDUCE_FX) === '1';
      const muted = localStorage.getItem(STORAGE_KEY_MUTED) === '1';
      this.audio.setMuted(muted);
      const savedMusicVol = localStorage.getItem(STORAGE_KEY_MUSIC_VOL);
      if (savedMusicVol !== null) {
        const parsed = parseFloat(savedMusicVol);
        if (Number.isFinite(parsed)) this.audio.setMusicVolume(parsed);
      }
      const savedSfxVol = localStorage.getItem(STORAGE_KEY_SFX_VOL);
      if (savedSfxVol !== null) {
        const parsed = parseFloat(savedSfxVol);
        if (Number.isFinite(parsed)) this.audio.setSfxVolume(parsed);
      }
    } catch {
      // Safe fallback when localStorage is blocked
    }
  }

  private saveHighScore(score: number): void {
    if (score > this.highScore) {
      this.highScore = score;
      try {
        localStorage.setItem(STORAGE_KEY_HIGHSCORE, String(this.highScore));
      } catch {
        // Ignore storage failure
      }
    }
  }

  public toggleMute(): void {
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    if (!next) {
      this.audio.unlock();
    }
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, next ? '1' : '0');
    } catch {
      // Ignore
    }
    this.emitHud(true);
  }

  public setUiNavHandler(handler: ((action: GamepadUiAction) => void) | null): void {
    this.uiNavHandler = handler;
  }

  public setMusicVolume(volume: number): void {
    this.audio.unlock();
    const clamped = Math.max(0, Math.min(1, volume));
    this.audio.setMusicVolume(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_MUSIC_VOL, clamped.toFixed(2));
    } catch {
      // Ignore
    }
    this.emitHud(true);
  }

  public setSfxVolume(volume: number): void {
    this.audio.unlock();
    const clamped = Math.max(0, Math.min(1, volume));
    this.audio.setSfxVolume(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_SFX_VOL, clamped.toFixed(2));
    } catch {
      // Ignore
    }
    this.emitHud(true);
  }

  public toggleReduceEffects(): void {
    this.reduceEffects = !this.reduceEffects;
    this.titleBackdropDrawn = false;
    try {
      localStorage.setItem(STORAGE_KEY_REDUCE_FX, this.reduceEffects ? '1' : '0');
    } catch {
      // Ignore
    }
    this.emitHud(true);
  }

  public start(): void {
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      if (!document.hidden) {
        this.stepFrame(dt);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.audio.destroy();
    this.unbindEvents();
    if (import.meta.env.MODE !== 'production') {
      const win = window as unknown as {
        __NF_DEBUG__?: unknown;
        __NF_DEBUG_PLAYER_FRAME__?: number;
      };
      delete win.__NF_DEBUG__;
      delete win.__NF_DEBUG_PLAYER_FRAME__;
    }
  }

  private setScreen(next: GameScreen): void {
    this.screen = next;
    if (next === 'MENÚ') {
      this.titleBackdropDrawn = false;
    }
    let bodyState = 'title';
    if (next === 'JUGANDO' || next === 'JEFE_INTRO' || next === 'BONUS') bodyState = 'playing';
    else if (next === 'PAUSA') bodyState = 'paused';
    else if (next === 'GAME_OVER' || next === 'VICTORIA' || next === 'CONTINUAR') {
      bodyState = 'gameover';
    }
    document.body.dataset.state = bodyState;
    this.emitHud(true);
  }

  public playUiMoveSound(): void {
    this.audio.playMenuMove();
  }

  public playUiConfirmSound(): void {
    this.audio.playMenuConfirm();
  }

  public getMusicBeatLevel(): number {
    return this.audio.getMusicBeatLevel(this.timeSec);
  }

  public getAudioDebugState() {
    return this.audio.getMusicDebugState();
  }

  public goToPrologue(): void {
    this.audio.unlock();
    this.audio.playMenuConfirm();
    this.prologueStep = 0;
    this.setScreen('HISTORIA');
  }

  public advancePrologue(): void {
    this.audio.unlock();
    this.audio.playMenuConfirm();
    if (this.prologueStep < STORY.prologue.length - 1) {
      this.prologueStep++;
      this.emitHud(true);
    } else {
      this.setScreen('SELECCIÓN');
    }
  }

  public skipPrologueToSelect(): void {
    this.audio.unlock();
    this.audio.playMenuConfirm();
    this.setScreen('SELECCIÓN');
  }

  public selectCharacter(charId: CharacterId): void {
    if (!this.availableCharacters.includes(charId)) return;
    const changed = this.selectedCharId !== charId;
    this.selectedCharId = charId;
    this.audio.unlock();
    if (changed) {
      this.audio.playSelectMove();
    }
    this.emitHud(true);
  }

  public startRun(charId?: CharacterId): void {
    this.audio.unlock();
    this.audio.playSelectConfirm();
    this.audio.playStartGame();
    const chosen = charId ?? this.selectedCharId;
    this.selectedCharId = chosen;
    this.players = [this.createPlayer(chosen)];
    this.setupLevel(0, true);
    this.setScreen('JUGANDO');
    this.audio.playRandomTrack();
  }

  public togglePause(): void {
    if (this.screen === 'JUGANDO' || this.screen === 'BONUS') {
      this.clearInputs();
      this.audio.pauseMusic();
      this.setScreen('PAUSA');
    } else if (this.screen === 'PAUSA') {
      this.clearInputs();
      this.audio.resumeMusic();
      this.setScreen(this.bonusRoomActive ? 'BONUS' : 'JUGANDO');
    }
  }

  public restartLevelOrGame(): void {
    this.audio.unlock();
    this.clearInputs();
    this.startRun(this.selectedCharId);
  }

  public returnToTitle(): void {
    this.clearInputs();
    this.setupLevel(0, false);
    this.setScreen('MENÚ');
    this.audio.playRandomTrack();
  }

  public continueGame(): void {
    const p = this.players[0];
    if (!p || p.continuesLeft <= 0) return;
    this.audio.unlock();
    p.continuesLeft -= 1;
    p.lives = 3;
    p.hp = p.maxHp;
    p.score = 0; // Puntaje vuelve a 0 al continuar (sección 4.11)
    p.state = 'idle';
    p.stateTimer = 0;
    p.attackTick = 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.z = 0;
    p.grabPushTimer = 0;
    p.mashBreakCount = 0;
    this.releasePlayerGrabTarget(p, false);
    this.releaseGrabbingEnemies(p.x);
    this.grabCooldown = 0;
    this.hitstopTimer = 0;
    this.hitstopCooldown = 0;
    p.invulnTimer = 1.5;
    this.audio.resumeMusic();
    this.setScreen('JUGANDO');
  }

  public nextAfterLevelResults(): void {
    this.audio.unlock();
    if (this.levelIndex === 1 || this.levelIndex === 3) {
      // Bonus tras N2 y N4 (sección 4.12)
      this.enterBonusRoom();
      return;
    }
    this.advanceToNextLevel();
  }

  public finishBonusRoom(): void {
    this.bonusRoomActive = false;
    this.advanceToNextLevel();
  }

  private advanceToNextLevel(): void {
    if (this.levelIndex < LEVELS.length - 1) {
      this.setupLevel(this.levelIndex + 1, true);
      this.audio.playRandomTrack();
      this.setScreen('JUGANDO');
    } else {
      this.endingStep = 0;
      this.audio.stopMusic();
      this.setScreen('VICTORIA');
    }
  }

  public advanceEnding(): void {
    if (this.endingStep < 3) {
      this.endingStep++;
      this.emitHud(true);
    } else {
      this.returnToTitle();
    }
  }

  // Touch input hooks
  public setTouchJoystick(x: number, y: number): void {
    this.touchState.joyX = Math.max(-1, Math.min(1, x));
    this.touchState.joyY = Math.max(-1, Math.min(1, y));
  }

  public triggerTouchButton(btn: 'A' | 'B' | 'ESP', pressed: boolean): void {
    this.audio.unlock();
    if (btn === 'A') {
      if (pressed && !this.touchState.attackHeld) this.queueAttack();
      this.touchState.attackHeld = pressed;
    } else if (btn === 'B') {
      if (pressed && !this.touchState.jumpHeld) this.queueJump();
      this.touchState.jumpHeld = pressed;
    } else if (btn === 'ESP' && pressed) {
      this.specialPressQueue = true;
    }
  }

  private createPlayer(charId: CharacterId): PlayerEntity {
    return {
      id: 1,
      charId,
      x: 180,
      y: 482,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: 1,
      hp: 100,
      maxHp: 100,
      lives: 3,
      score: 0,
      continuesLeft: 3,
      state: 'idle',
      stateTimer: 0,
      animTime: 0,
      invulnTimer: 0,
      hpFlashRedTimer: 0,
      specialCooldown: 0,
      comboStep: 0,
      comboWindowTimer: 0,
      attackId: 0,
      attackTick: 0,
      attackHitSet: new Set(),
      weapon: null,
      weaponUses: 0,
      grabTargetId: null,
      grabPushTimer: 0,
      grabPummels: 0,
      mashBreakCount: 0,
      squashX: 1,
      squashY: 1,
      damageTakenOnBoss: 0,
    };
  }

  private setupLevel(index: number, showBanner: boolean): void {
    this.levelIndex = index;
    const lvl = LEVELS[index];
    this.activeZoneIndex = 0;
    this.zoneLocked = false;
    this.zoneLostLifeFlag = false;
    this.clearedZones.clear();
    this.bossSpawned = false;
    this.bonusRoomActive = false;
    this.boss = null;
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.pickups = [];
    this.breakables = lvl.breakables.map((b) => ({
      id: this.nextEntityId++,
      kind: b.kind,
      x: b.x,
      y: b.y,
      hp: 2,
      maxHp: 2,
      hitFlashTimer: 0,
      guaranteedDrop: b.guaranteedDrop,
      broken: false,
    }));

    this.cameraX = 0;
    this.prevCameraX = 0;
    this.cameraTargetX = null;
    this.cameraMinX = 0;
    this.cameraMaxX = lvl.width;
    this.cameraZoom = 1;
    this.prevCameraZoom = 1;
    this.hitstopTimer = 0;
    this.hitstopCooldown = 0;
    this.grabCooldown = 0;
    this.levelTimer = 0;
    this.dripTimer = 7.0;
    this.goArrowTimer = 0;
    this.bossDangerTimer = 0;
    this.bonusClearTimer = 0;
    this.tutorialHint = null;
    this.lastTargetName = null;
    this.lastTargetHp = 0;
    this.lastTargetMaxHp = 0;
    this.levelResults = null;
    this.dialogueSpeaker = null;
    this.dialogueText = null;

    const p = this.players[0];
    if (p) {
      p.x = 180;
      p.y = 482;
      p.z = 0;
      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.facing = 1;
      p.state = 'idle';
      p.stateTimer = 0;
      p.attackTick = 0;
      p.invulnTimer = 0.8;
      p.damageTakenOnBoss = 0;
      p.grabTargetId = null;
      p.grabPushTimer = 0;
      p.mashBreakCount = 0;
    }

    if (showBanner) {
      this.bannerText = `NIVEL ${lvl.levelNumber} — ${lvl.name}`;
      this.bannerTimer = 2.2;
    } else {
      this.bannerText = null;
      this.bannerTimer = 0;
    }
    this.syncInterpolationSnapshots();
  }

  private enterBonusRoom(): void {
    this.bonusRoomActive = true;
    this.bonusClearTimer = 0;
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.pickups = [];
    this.boss = null;
    this.cameraX = 0;
    this.prevCameraX = 0;
    this.cameraTargetX = null;
    this.cameraMinX = 0;
    this.cameraMaxX = LOGICAL_WIDTH;
    this.zoneLocked = true;
    this.hitstopTimer = 0;
    this.hitstopCooldown = 0;
    this.grabCooldown = 0;
    const p = this.players[0];
    if (p) {
      p.x = 160;
      p.y = 486;
      p.z = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.facing = 1;
      p.state = 'idle';
      p.stateTimer = 0;
      p.attackTick = 0;
      p.grabTargetId = null;
      p.grabPushTimer = 0;
      p.mashBreakCount = 0;
    }
    this.breakables = [
      { id: this.nextEntityId++, kind: 'cajon', x: 340, y: 462, hp: 2, maxHp: 2, hitFlashTimer: 0, guaranteedDrop: 'empanada', broken: false },
      { id: this.nextEntityId++, kind: 'cajon', x: 480, y: 488, hp: 2, maxHp: 2, hitFlashTimer: 0, guaranteedDrop: 'sandwich', broken: false },
      { id: this.nextEntityId++, kind: 'cajon', x: 620, y: 462, hp: 2, maxHp: 2, hitFlashTimer: 0, guaranteedDrop: 'energia', broken: false },
      { id: this.nextEntityId++, kind: 'barril', x: 750, y: 504, hp: 2, maxHp: 2, hitFlashTimer: 0, guaranteedDrop: 'bate', broken: false },
      { id: this.nextEntityId++, kind: 'parlante', x: 830, y: 458, hp: 2, maxHp: 2, hitFlashTimer: 0, guaranteedDrop: 'disco', broken: false },
    ];
    this.bannerText = null;
    this.bannerTimer = 0;

    this.syncInterpolationSnapshots();
    this.audio.playRandomTrack();
    this.setScreen('BONUS');
  }

  private syncInterpolationSnapshots(): void {
    this.prevCameraX = this.cameraX;
    this.prevCameraZoom = this.cameraZoom;
    for (const p of this.players) {
      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;
    }
    for (const e of this.enemies) {
      e.prevX = e.x;
      e.prevY = e.y;
      e.prevZ = e.z;
    }
    if (this.boss) {
      this.boss.prevX = this.boss.x;
      this.boss.prevY = this.boss.y;
      this.boss.prevZ = this.boss.z;
    }
    for (const pk of this.pickups) {
      pk.prevX = pk.x;
      pk.prevY = pk.y;
      pk.prevZ = pk.z;
    }
    for (const pr of this.projectiles) {
      pr.prevX = pr.x;
      pr.prevY = pr.y;
      pr.prevZ = pr.z;
    }
  }

  private stepFrame(dt: number): void {
    this.timeSec += dt;
    if (this.hitstopCooldown > 0) {
      this.hitstopCooldown = Math.max(0, this.hitstopCooldown - dt);
    }
    this.pollGamepad(dt);

    // Update screen shake & flash even during hitstop
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.8);
      const amt = this.shakeTrauma * this.shakeTrauma * 14;
      this.shakeX = (Math.random() * 2 - 1) * amt;
      this.shakeY = (Math.random() * 2 - 1) * amt;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    if (this.whiteFlashTimer > 0) this.whiteFlashTimer = Math.max(0, this.whiteFlashTimer - dt);

    if (this.screen === 'MENÚ') {
      this.cameraX = 0;
      this.prevCameraX = 0;
      this.renderAlpha = 1;
      if (!this.reduceEffects || !this.titleBackdropDrawn) {
        this.drawCurrentScene();
        if (this.worldAssets.titleBg) {
          this.titleBackdropDrawn = true;
        }
      }
      return;
    }

    if (
      this.screen === 'HISTORIA' ||
      this.screen === 'SELECCIÓN' ||
      this.screen === 'PAUSA' ||
      this.screen === 'NIVEL_COMPLETO' ||
      this.screen === 'GAME_OVER' ||
      this.screen === 'VICTORIA' ||
      this.screen === 'CARGA'
    ) {
      return;
    }

    if (this.screen === 'CONTINUAR') {
      this.continueCountdown -= dt;
      if (this.continueCountdown <= 0) {
        this.continueCountdown = 0;
        this.audio.stopMusic();
        this.setScreen('GAME_OVER');
      } else {
        this.hudSyncTimer += dt;
        if (this.hudSyncTimer >= 0.1) {
          this.hudSyncTimer = 0;
          this.emitHud(false);
        }
      }
      this.drawCurrentScene();
      return;
    }

    // Fixed 60 Hz simulation accumulator with sub-tick interpolation
    const fixedStep = 1 / 60;
    const devTraceStartIdx =
      import.meta.env.MODE !== 'production' ? this.devTrace.length : 0;
    this.accumulator += dt;
    while (this.accumulator >= fixedStep) {
      this.accumulator -= fixedStep;
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - fixedStep);
      } else {
        this.syncInterpolationSnapshots();
        this.fixedUpdate(fixedStep);
      }
    }
    this.renderAlpha = this.hitstopTimer > 0 ? 1 : this.accumulator / fixedStep;

    if (import.meta.env.MODE !== 'production' && typeof window !== 'undefined') {
      (window as unknown as { __NF_DEBUG_PLAYER_FRAME__?: number }).__NF_DEBUG_PLAYER_FRAME__ =
        undefined;
    }

    this.drawCurrentScene();

    if (import.meta.env.MODE !== 'production' && this.devTrace.length > devTraceStartIdx) {
      const player = this.players[0];
      const renderedFrame =
        typeof window !== 'undefined'
          ? (window as unknown as { __NF_DEBUG_PLAYER_FRAME__?: number }).__NF_DEBUG_PLAYER_FRAME__
          : undefined;
      if (typeof renderedFrame === 'number' && player) {
        for (let i = devTraceStartIdx; i < this.devTrace.length; i++) {
          const row = this.devTrace[i];
          if (
            row.state === player.state ||
            (row.state === 'attack1' ||
              row.state === 'attack2' ||
              row.state === 'attack3' ||
              row.state === 'airKick')
          ) {
            row.frame = renderedFrame;
          }
        }
      }
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.emitHud(false);
    }
  }

  private fixedUpdate(dt: number): void {
    const lvl = LEVELS[this.levelIndex];
    const player = this.players[0];
    if (!player) return;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerText = null;
    }
    if (this.specialBannerTimer > 0) {
      this.specialBannerTimer -= dt;
      if (this.specialBannerTimer <= 0) this.specialBannerText = null;
    }
    if (this.goArrowTimer > 0) {
      this.goArrowTimer -= dt;
    }
    if (this.bossDangerTimer > 0) {
      this.bossDangerTimer = Math.max(0, this.bossDangerTimer - dt);
    }
    for (const br of this.breakables) {
      if (br.hitFlashTimer > 0) br.hitFlashTimer = Math.max(0, br.hitFlashTimer - dt);
    }

    // Boss Intro 2.2s dramatic freeze (danger siren + smooth camera glide into boss arena)
    if (this.screen === 'JEFE_INTRO') {
      this.introTimer -= dt;
      this.cameraZoom = 1 + 0.08 * Math.sin(Math.min(1, (2.2 - this.introTimer) / 2.2) * Math.PI);
      if (this.cameraTargetX !== null) {
        this.cameraX = stepCameraTowards(this.cameraX, this.cameraTargetX, dt, 8);
        this.cameraMinX = Math.min(this.cameraX, this.cameraTargetX);
        this.cameraMaxX = Math.max(this.cameraX + LOGICAL_WIDTH, lvl.bossArenaRight);
        if (this.cameraX === this.cameraTargetX) {
          this.cameraMinX = this.cameraTargetX;
          this.cameraMaxX = lvl.bossArenaRight;
          this.cameraTargetX = null;
        }
      }
      if (this.boss) this.boss.animTime += dt;
      if (this.introTimer <= 0) {
        this.cameraZoom = 1;
        this.bossDangerTimer = 0;
        this.dialogueSpeaker = null;
        this.dialogueText = null;
        this.setScreen('JUGANDO');
      }
      return;
    }

    if (this.screen === 'JUGANDO') {
      this.levelTimer += dt;
    }

    // Read unified input once per fixed step
    const input = this.consumeInput();
    this.simTick += 1;
    const devTracingActive = import.meta.env.MODE !== 'production' && this.devTracing;
    const preState = devTracingActive ? player.state : 'idle';
    const preComboStep = devTracingActive ? player.comboStep : 0;
    const preAttackTick = devTracingActive ? player.attackTick : 0;
    if (import.meta.env.MODE !== 'production') {
      this.devChainedHits = null;
    }

    this.updatePlayer(player, input, dt);

    this.updateEnemies(player, lvl, dt);
    if (this.boss) {
      this.updateBoss(this.boss, player, lvl, dt);
    }
    this.updateProjectiles(player, dt);
    this.updateHazards(player, dt);

    if (import.meta.env.MODE !== 'production' && devTracingActive) {
      const wasAtk =
        preState === 'attack1' ||
        preState === 'attack2' ||
        preState === 'attack3' ||
        preState === 'airKick';
      const interruptedByDamage =
        player.state === 'hurt' ||
        player.state === 'knockdown' ||
        player.state === 'getup' ||
        player.state === 'ko' ||
        player.state === 'grabbedByEnemy';
      const traceState = wasAtk && !interruptedByDamage ? preState : player.state;
      this.devTrace.push({
        simTick: this.simTick,
        state: traceState,
        comboStep: preComboStep,
        attackTick: preAttackTick,
        hits: wasAtk ? (this.devChainedHits ?? player.attackHitSet.size) : 0,
        stateTimer: player.stateTimer,
        animTime: player.animTime,
        frame: null,
      });
    }
    this.updatePickups(player, dt);
    this.updateSpecialFx(player, dt);
    this.updateParticlesAndTexts(dt);

    if (this.bonusRoomActive) {
      // Bonus clears when all breakables broken and all pickups collected, after short celebration delay
      const anyLeft =
        this.breakables.some((b) => !b.broken) || this.pickups.some((pk) => !pk.collected);
      if (!anyLeft) {
        if (this.bonusClearTimer <= 0) {
          this.bonusClearTimer = 0.85;
        } else {
          this.bonusClearTimer -= dt;
          if (this.bonusClearTimer <= 0) {
            this.finishBonusRoom();
          }
        }
      } else {
        this.bonusClearTimer = 0;
      }
      return;
    }

    this.updateCameraAndZones(player, lvl, dt);

    // Boss defeat sequence
    if (this.boss && this.boss.state === 'ko') {
      this.bossDefeatTimer -= dt;
      if (this.bossDefeatTimer <= 0) {
        this.completeLevel(player, lvl);
      }
    }
  }

  private consumeInput(): InputState {
    const gpConnected = this.gamepadState.connected;
    const gpMoveX = gpConnected ? this.gamepadState.moveX : 0;
    const gpMoveY = gpConnected ? this.gamepadState.moveY : 0;

    const left =
      this.heldKeys.has('ArrowLeft') ||
      this.heldKeys.has('KeyA') ||
      this.touchState.joyX < -0.3 ||
      gpMoveX < -0.3 ||
      (gpConnected && this.gamepadState.dpadLeft);
    const right =
      this.heldKeys.has('ArrowRight') ||
      this.heldKeys.has('KeyD') ||
      this.touchState.joyX > 0.3 ||
      gpMoveX > 0.3 ||
      (gpConnected && this.gamepadState.dpadRight);
    const up =
      this.heldKeys.has('ArrowUp') ||
      this.heldKeys.has('KeyW') ||
      this.touchState.joyY < -0.3 ||
      gpMoveY < -0.3 ||
      (gpConnected && this.gamepadState.dpadUp);
    const down =
      this.heldKeys.has('ArrowDown') ||
      this.heldKeys.has('KeyS') ||
      this.touchState.joyY > 0.3 ||
      gpMoveY > 0.3 ||
      (gpConnected && this.gamepadState.dpadDown);

    if (this.gamepadState.connected && this.gamepadState.sprintHeld) {
      if (left && !right) this.runActiveDir = -1;
      else if (right && !left) this.runActiveDir = 1;
    }

    // Check simultaneous A+B within <= 80ms
    let specialJustPressed = this.specialPressQueue;
    if (
      !specialJustPressed &&
      this.attackPressQueue &&
      this.jumpPressQueue
    ) {
      specialJustPressed = true;
    } else if (
      !specialJustPressed &&
      this.lastAttackTimestamp >= 0 &&
      this.lastJumpTimestamp >= 0 &&
      Math.abs(this.lastAttackTimestamp - this.lastJumpTimestamp) <= 0.08
    ) {
      specialJustPressed = true;
      this.lastAttackTimestamp = -1;
      this.lastJumpTimestamp = -1;
    }

    const attackJustPressed = !specialJustPressed && this.attackPressQueue;
    const jumpJustPressed = !specialJustPressed && this.jumpPressQueue;

    this.attackPressQueue = false;
    this.jumpPressQueue = false;
    this.specialPressQueue = false;

    this.inputScratch.left = left;
    this.inputScratch.right = right;
    this.inputScratch.up = up;
    this.inputScratch.down = down;
    this.inputScratch.attackJustPressed = attackJustPressed;
    this.inputScratch.jumpJustPressed = jumpJustPressed;
    this.inputScratch.specialJustPressed = specialJustPressed;
    this.inputScratch.joyX = Math.abs(this.touchState.joyX) >= Math.abs(gpMoveX) ? this.touchState.joyX : gpMoveX;
    this.inputScratch.joyY = Math.abs(this.touchState.joyY) >= Math.abs(gpMoveY) ? this.touchState.joyY : gpMoveY;
    return this.inputScratch;
  }

  private updatePlayer(p: PlayerEntity, input: InputState, dt: number): void {
    const stats = CHARACTERS[p.charId];
    p.animTime += dt;
    if (this.grabCooldown > 0) this.grabCooldown = Math.max(0, this.grabCooldown - dt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.hpFlashRedTimer > 0) p.hpFlashRedTimer = Math.max(0, p.hpFlashRedTimer - dt);
    if (p.specialCooldown > 0) p.specialCooldown = Math.max(0, p.specialCooldown - dt);
    if (p.comboWindowTimer > 0) {
      p.comboWindowTimer -= dt;
      if (p.comboWindowTimer <= 0) p.comboStep = 0;
    }

    // Damped squash-and-stretch recovery
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);

    // Grabbed by enemy (Zombie / Chupetona / Boss 5) -> mash A or Special to escape (with hard anti-deadlock failsafe)
    if (p.state === 'grabbedByEnemy') {
      if (input.attackJustPressed) {
        p.mashBreakCount++;
        this.audio.playPlayerHitEnemy();
      }
      const hasActiveEnemyDrainer = this.enemies.some((e) => e.hp > 0 && e.state === 'draining');
      const hasActiveBossDrainer = Boolean(
        this.boss &&
          this.boss.defId === 5 &&
          this.boss.hp > 0 &&
          this.boss.drainTimer > 0 &&
          this.boss.state !== 'ko' &&
          this.boss.state !== 'knockdown' &&
          this.boss.state !== 'phaseTransition'
      );
      const specialEscape =
        input.specialJustPressed && canActivateSpecial(p.hp, p.specialCooldown);
      const evalRes = evaluateGrabbedByEnemyState({
        stateTimer: p.stateTimer,
        dt,
        mashBreakCount: p.mashBreakCount,
        hasActiveDrainer: hasActiveEnemyDrainer || hasActiveBossDrainer,
        specialEscape,
      });
      p.stateTimer = evalRes.nextTimer;
      if (evalRes.shouldRelease) {
        p.mashBreakCount = 0;
        p.grabPushTimer = 0;
        this.grabCooldown = 0.6;
        this.releaseGrabbingEnemies(p.x);
        if (evalRes.usedSpecial) {
          p.state = 'idle';
          this.activatePlayerSpecial(p);
        } else {
          p.state = 'idle';
          p.invulnTimer = Math.max(p.invulnTimer, 0.8);
        }
      }
      return;
    }

    // Special activation from almost any active state
    if (
      input.specialJustPressed &&
      p.state !== 'knockdown' &&
      p.state !== 'ko' &&
      p.state !== 'special' &&
      canActivateSpecial(p.hp, p.specialCooldown)
    ) {
      this.activatePlayerSpecial(p);
      return;
    }

    // Handle timed non-interruptible states with smooth horizontal knockback & landing friction
    if (p.state === 'hurt' || p.state === 'knockdown' || p.state === 'getup' || p.state === 'ko') {
      p.stateTimer -= dt;
      const wasAir = p.z > 0;
      p.x += p.vx * dt;
      p.vx *= Math.exp(-7 * dt);
      this.applyGravityAndClamp(p, dt);
      this.clampPlayerX(p);
      if (wasAir && p.z <= 0) {
        p.squashX = 1.18;
        p.squashY = 0.82;
        this.spawnDustBurst(p.x, p.y, 4);
      }
      if (p.stateTimer <= 0) {
        if (p.state === 'knockdown') {
          // Reinicia animTime para que getup inicie en el frame 0.
          p.state = 'getup';
          p.animTime = 0;
          p.stateTimer = 0.25;
          p.invulnTimer = 1.0; // 1.0s invulnerabilidad al levantarse (sección 4.7)
          p.vx = 0;
        } else if (p.state === 'hurt' || p.state === 'getup') {
          p.state = 'idle';
          p.vx = 0;
        }
      }
      return;
    }

    if (p.state === 'special') {
      p.stateTimer -= dt;
      this.applyGravityAndClamp(p, dt);
      if (p.stateTimer <= 0) {
        p.state = p.z > 0 ? 'jump' : 'idle';
      }
      return;
    }

    if (p.state === 'shoulder') {
      p.stateTimer -= dt;
      p.x += p.vx * dt;
      this.clampPlayerX(p);
      this.atkBoxScratch.w = 58;
      this.atkBoxScratch.x = p.x + p.facing * (58 * 0.55);
      this.atkBoxScratch.z = p.z;
      this.atkBoxScratch.h = 96;
      this.checkPlayerMeleeHits(p, stats.shoulderDamage, this.atkBoxScratch, true, true);
      if (p.stateTimer <= 0) {
        if (stats.shoulderRecovery > 0) {
          p.state = 'recover';
          p.stateTimer = stats.shoulderRecovery;
          p.vx *= 0.45;
        } else {
          p.vx = 0;
          p.state = 'idle';
          p.stateTimer = 0;
        }
      }
      return;
    }

    if (p.state === 'recover') {
      p.stateTimer -= dt;
      p.x += p.vx * dt;
      p.vx *= Math.exp(-9.5 * dt);
      this.applyGravityAndClamp(p, dt);
      this.clampPlayerX(p);
      if (p.stateTimer <= 0) {
        p.vx = 0;
        p.state = 'idle';
      }
      return;
    }

    // Grab hold / knee / throw state
    if (p.state === 'grabThrow') {
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) {
        p.state = 'idle';
        p.stateTimer = 0;
      }
      return;
    }

    if (p.state === 'grabHold' || p.state === 'grabKnee') {
      const target = this.enemies.find((e) => e.id === p.grabTargetId);
      if (!target || target.hp <= 0 || target.state === 'ko' || target.state !== 'grabbed') {
        p.grabTargetId = null;
        p.grabPushTimer = 0;
        p.state = 'idle';
        this.grabCooldown = 0.5;
        return;
      }
      target.x = p.x + p.facing * 32;
      target.y = p.y;
      target.facing = (p.facing * -1) as 1 | -1;

      if (p.state === 'grabKnee') {
        p.stateTimer -= dt;
        if (p.stateTimer <= 0) {
          p.state = 'grabHold';
          p.stateTimer = 1.8;
          p.grabPushTimer = 0;
        }
        return;
      }

      // Release automatically if grabHold times out
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) {
        this.releasePlayerGrabTarget(p, true);
        p.grabPushTimer = 0;
        p.state = 'idle';
        this.grabCooldown = 0.6;
        return;
      }

      // Throw with B (overhead behind, 14 dmg)
      if (input.jumpJustPressed) {
        this.performGrabThrow(p, target, true);
        return;
      }
      // Attack with A (2 knees of 5 dmg, 3rd or opposite direction = throw 12 dmg)
      if (input.attackJustPressed) {
        const holdingOpposite =
          (p.facing === 1 && input.left) || (p.facing === -1 && input.right);
        if (holdingOpposite || p.grabPummels >= 2) {
          this.performGrabThrow(p, target, false);
        } else {
          p.grabPummels++;
          p.state = 'grabKnee';
          p.stateTimer = 0.2;
          p.grabPushTimer = 0;
          p.animTime = 0;
          this.damageEnemy(target, 5, p.facing, false, p);
        }
        return;
      }

      // Holding away or dodging vertically smoothly releases crowd grabHold so the player is never trapped
      const disengage = shouldReleaseCrowdGrabHold({
        facing: p.facing,
        left: input.left,
        right: input.right,
        up: input.up,
        down: input.down,
        attackJustPressed: input.attackJustPressed,
        jumpJustPressed: input.jumpJustPressed,
        disengageTimer: p.grabPushTimer,
        dt,
      });
      p.grabPushTimer = disengage.nextDisengageTimer;
      if (!disengage.shouldRelease) {
        return;
      }
      this.releasePlayerGrabTarget(p, false);
      p.grabPushTimer = 0;
      p.state = 'idle';
      this.grabCooldown = 0.6;
    }

    // Buffer attack/jump presses for 110ms so inputs pressed right before landing or recovery never drop
    if (input.attackJustPressed) this.attackBufferTimer = 0.11;
    else if (this.attackBufferTimer > 0) this.attackBufferTimer = Math.max(0, this.attackBufferTimer - dt);

    if (input.jumpJustPressed) this.jumpBufferTimer = 0.11;
    else if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    const bufferedAttack = input.attackJustPressed || this.attackBufferTimer > 0;
    const bufferedJump = input.jumpJustPressed || this.jumpBufferTimer > 0;

    // Attacking states
    if (
      p.state === 'attack1' ||
      p.state === 'attack2' ||
      p.state === 'attack3' ||
      p.state === 'airKick'
    ) {
      p.stateTimer = Math.max(0, p.stateTimer - dt);
      const slot: AttackSlot =
        p.state === 'attack1'
          ? 'combo1'
          : p.state === 'attack2'
          ? 'combo2'
          : p.state === 'attack3'
          ? 'combo3'
          : 'airKick';
      const atkData = ATTACK_FRAME_DATA[p.charId][slot];
      const phase = getAttackPhase(p.attackTick, atkData);

      if (p.state === 'airKick') {
        const wasAir = p.z > 0;
        p.x += p.vx * dt;
        p.y = clampWalkY(p.y + p.vy * dt);
        this.applyGravityAndClamp(p, dt);
        if (phase === 'active') {
          buildAttackHitboxInto(
            this.atkBoxScratch,
            p.x,
            p.z,
            p.facing,
            atkData,
            stats.kickExtraReach
          );
          this.checkPlayerMeleeHits(p, 10, this.atkBoxScratch, false, false);
        }
        if (wasAir && p.z <= 0) {
          p.state = 'idle';
          p.stateTimer = 0;
          p.attackTick = 0;
          p.vx *= 0.35;
          p.vy = 0;
          p.squashX = 1.2;
          p.squashY = 0.82;
          this.spawnDustBurst(p.x, p.y, 4);
        } else {
          p.attackTick += 1;
          if (getAttackPhase(p.attackTick, atkData) === 'done') {
            p.state = p.z > 0 ? 'jump' : 'idle';
            p.stateTimer = 0;
            p.attackTick = 0;
          }
        }
      } else {
        const step: 1 | 2 | 3 = p.state === 'attack1' ? 1 : p.state === 'attack2' ? 2 : 3;
        if (phase === 'active') {
          const dmg = getPlayerAttackDamage(p.charId, step, p.weapon);
          const extraReach =
            (step === 3 ? stats.kickExtraReach : 0) +
            (p.weapon ? WEAPON_STATS[p.weapon].reachBonus : 0);
          buildAttackHitboxInto(this.atkBoxScratch, p.x, p.z, p.facing, atkData, extraReach);
          this.checkPlayerMeleeHits(p, dmg, this.atkBoxScratch, step === 3, false);
        }

        // Smooth forward step-in velocity integration & bleed during combo strikes
        p.x += p.vx * dt;
        stepVelocity2DInto(this.velScratch, p.vx, p.vy, 0, 0, 2400, 2200, dt);
        p.vx = this.velScratch.vx;
        p.vy = this.velScratch.vy;

        // Allow chaining next attack only after active phase completes
        if (bufferedAttack && step < 3 && canChainFromTick(p.attackTick, atkData)) {
          this.attackBufferTimer = 0;
          this.clampPlayerX(p);
          this.startComboAttack(p, (step + 1) as 2 | 3);
          return;
        }
        p.attackTick += 1;
        if (getAttackPhase(p.attackTick, atkData) === 'done') {
          p.state = 'idle';
          p.stateTimer = 0;
          p.attackTick = 0;
          p.vx = 0;
          p.comboWindowTimer = stats.comboWindow;
        }
      }
      this.clampPlayerX(p);
      return;
    }

    // Air movement
    if (p.z > 0) {
      let mx = 0;
      let my = 0;
      if (input.left) { mx -= 1; p.facing = -1; }
      if (input.right) { mx += 1; p.facing = 1; }
      if (input.up) my -= 1;
      if (input.down) my += 1;
      normalizeMoveAxesInto(this.normScratch, mx, my);
      stepVelocity2DInto(
        this.velScratch,
        p.vx,
        p.vy,
        this.normScratch.nx * stats.speedX * 0.68,
        this.normScratch.ny * stats.speedY * 0.6,
        1400,
        900,
        dt
      );
      p.vx = this.velScratch.vx;
      p.vy = this.velScratch.vy;
      p.x += p.vx * dt;
      p.y = clampWalkY(p.y + p.vy * dt);
      this.clampPlayerX(p);
      this.applyGravityAndClamp(p, dt);

      if (bufferedAttack) {
        this.attackBufferTimer = 0;
        const airData = ATTACK_FRAME_DATA[p.charId].airKick;
        p.state = 'airKick';
        p.stateTimer = getAttackTotalTicks(airData) / 60;
        p.animTime = 0;
        p.attackId++;
        p.attackTick = 0;
        p.attackHitSet.clear();
      } else if (p.z <= 0) {
        p.state = 'idle';
        p.vx *= 0.55;
        p.vy = 0;
        p.squashX = 1.22;
        p.squashY = 0.78;
        this.spawnDustBurst(p.x, p.y, 5);
      }
      return;
    }

    // Grounded Movement & Actions
    let mx = 0;
    let my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (mx !== 0) p.facing = mx > 0 ? 1 : -1;

    const isRunning = this.runActiveDir !== 0 && mx === this.runActiveDir;
    if (mx === 0) this.runActiveDir = 0;

    // Pick up nearby weapon/item with A, or start attack
    if (bufferedAttack) {
      this.attackBufferTimer = 0;
      if (this.tryPickupWeaponOnGround(p)) {
        return;
      }
      if (isRunning) {
        p.state = 'shoulder';
        p.stateTimer = 0.4;
        p.animTime = 0;
        p.vx = p.facing * (stats.runSpeedX * 1.25);
        p.vy = 0;
        p.attackId++;
        p.attackHitSet.clear();
        this.spawnDustBurst(p.x - p.facing * 12, p.y, 4);
        return;
      }
      const nextStep: 1 | 2 | 3 =
        p.comboWindowTimer > 0 && p.comboStep === 1
          ? 2
          : p.comboWindowTimer > 0 && p.comboStep === 2
          ? 3
          : 1;
      this.startComboAttack(p, nextStep);
      return;
    }

    // Jump with B
    if (bufferedJump) {
      this.jumpBufferTimer = 0;
      p.z = 1;
      p.vz = stats.jumpImpulse;
      p.state = 'jump';
      p.animTime = 0;
      p.squashX = 0.85;
      p.squashY = 1.18;
      this.spawnDustBurst(p.x, p.y, 4);
      return;
    }

    normalizeMoveAxesInto(this.normScratch, mx, my);
    const spdX = isRunning ? stats.runSpeedX : stats.speedX;
    stepVelocity2DInto(
      this.velScratch,
      p.vx,
      p.vy,
      this.normScratch.nx * spdX,
      this.normScratch.ny * stats.speedY,
      2600,
      3200,
      dt
    );
    p.vx = this.velScratch.vx;
    p.vy = this.velScratch.vy;
    p.x += p.vx * dt;
    p.y = clampWalkY(p.y + p.vy * dt);
    this.clampPlayerX(p);

    const moveSpeed = Math.hypot(p.vx, p.vy);
    if (mx !== 0 || my !== 0 || moveSpeed > 12) {
      p.state = isRunning ? 'run' : 'walk';
      // Sync leg cadence slightly with real velocity during acceleration/deceleration
      const targetRatio = Math.min(1.25, Math.max(0.45, moveSpeed / Math.max(1, spdX)));
      p.animTime += dt * (targetRatio - 1) * 0.45;
    } else {
      p.state = 'idle';
    }

    // Check walk-in grab (only deliberate horizontal push into a single vulnerable enemy, never while running/dodging or on cooldown)
    if (this.grabCooldown <= 0 && mx !== 0 && my === 0 && !isRunning) {
      const candidate = this.enemies.find(
        (e) =>
          e.hp > 0 &&
          (e.state === 'approach' ||
            e.state === 'circle' ||
            e.state === 'hurt' ||
            e.state === 'recover') &&
          Math.abs(e.x - p.x) <= 38 &&
          Math.abs(e.y - p.y) <= 18 &&
          Math.sign(e.x - p.x) === p.facing
      );
      if (candidate) {
        p.grabPushTimer += dt;
        if (p.grabPushTimer >= 0.18) {
          p.grabPushTimer = 0;
          p.state = 'grabHold';
          p.stateTimer = 2.4;
          p.grabTargetId = candidate.id;
          p.grabPummels = 0;
          candidate.state = 'grabbed';
          candidate.vx = 0;
          candidate.vy = 0;
        }
      } else {
        p.grabPushTimer = 0;
      }
    } else {
      p.grabPushTimer = 0;
    }
  }

  private startComboAttack(p: PlayerEntity, step: 1 | 2 | 3): void {
    if (import.meta.env.MODE !== 'production') {
      this.devChainedHits = p.attackHitSet.size;
    }
    const slot: AttackSlot = step === 1 ? 'combo1' : step === 2 ? 'combo2' : 'combo3';
    const atkData = ATTACK_FRAME_DATA[p.charId][slot];
    p.comboStep = step;
    p.state = step === 1 ? 'attack1' : step === 2 ? 'attack2' : 'attack3';
    p.stateTimer = getAttackTotalTicks(atkData) / 60;
    p.vx = p.facing * (step === 3 ? 115 : step === 2 ? 48 : 24);
    p.vy = 0;
    p.animTime = 0;
    p.attackId++;
    p.attackTick = 0;
    p.attackHitSet.clear();
  }

  private performGrabThrow(p: PlayerEntity, target: EnemyEntity, overhead: boolean): void {
    const dir = overhead ? (-p.facing as 1 | -1) : p.facing;
    if (overhead) p.facing = dir;
    p.state = 'grabThrow';
    p.stateTimer = 0.28;
    p.grabTargetId = null;
    p.grabPushTimer = 0;
    this.grabCooldown = 0.6;
    target.state = 'thrown';
    target.stateTimer = 0.55;
    target.vx = dir * 420;
    target.z = 26;
    target.vz = 220;
    this.damageEnemy(target, overhead ? 14 : 12, dir, true, p);
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.45);
  }

  private activatePlayerSpecial(p: PlayerEntity): void {
    const stats = CHARACTERS[p.charId];
    this.releasePlayerGrabTarget(p, false);
    this.releaseGrabbingEnemies(p.x);
    p.state = 'special';
    p.stateTimer = 0.6;
    p.animTime = 0;
    p.invulnTimer = 0.6;
    p.specialCooldown = 0.8;
    p.grabPushTimer = 0;
    p.mashBreakCount = 0;
    this.grabCooldown = 0.6;

    this.specialFx.active = true;
    this.specialFx.charId = p.charId;
    this.specialFx.x = p.x;
    this.specialFx.y = p.y;
    this.specialFx.timer = 0.72;
    this.specialFx.maxTimer = 0.72;

    this.specialBannerText = `¡${stats.specialName}!`;
    this.specialBannerTimer = 1.2;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.65);

    // Burst special particles on activation
    if (p.charId === 'bayron') {
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2;
        const spd = 140 + Math.random() * 140;
        this.spawnParticle(
          p.x,
          p.y,
          14,
          Math.cos(ang) * spd,
          Math.sin(ang) * 45,
          60 + Math.random() * 120,
          0.45 + Math.random() * 0.25,
          5 + Math.random() * 4,
          i % 2 === 0 ? PALETTE.yellow : PALETTE.magenta,
          i % 3 === 0 ? 'star' : 'spark'
        );
      }
    } else if (p.charId === 'marcianeke') {
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * Math.PI * 2;
        const spd = 150 + Math.random() * 160;
        this.spawnParticle(
          p.x,
          p.y,
          48,
          Math.cos(ang) * spd,
          Math.sin(ang) * 48,
          80 + Math.random() * 140,
          0.4 + Math.random() * 0.25,
          5 + Math.random() * 4,
          i % 3 === 0 ? '#FFFFFF' : PALETTE.cyan,
          'star'
        );
      }
    } else {
      for (let i = 0; i < 16; i++) {
        this.spawnParticle(
          p.x + (Math.random() * 2 - 1) * 110,
          p.y + (Math.random() * 2 - 1) * 50,
          120 + Math.random() * 70,
          (Math.random() - 0.5) * 90,
          (Math.random() - 0.5) * 30,
          -90 - Math.random() * 70,
          0.65 + Math.random() * 0.25,
          8,
          i % 2 === 0 ? '#22C55E' : PALETTE.yellow,
          'bill'
        );
      }
    }

    // Apply special damage (total 14, breaks guards, knocks down)
    const totalDmg = stats.specialHits.reduce((a, b) => a + b, 0);
    let hitAny = 0;

    for (const e of this.enemies) {
      if (e.hp <= 0 || e.state === 'ko') continue;
      if (
        Math.abs(e.x - p.x) <= stats.specialRadius &&
        Math.abs(e.y - p.y) <= stats.specialDepth
      ) {
        e.isGuardActive = false;
        this.damageEnemy(e, totalDmg, e.x >= p.x ? 1 : -1, true, p, true);
        hitAny++;
      }
    }
    if (this.boss && this.boss.hp > 0 && this.boss.state !== 'ko') {
      if (
        Math.abs(this.boss.x - p.x) <= stats.specialRadius &&
        Math.abs(this.boss.y - p.y) <= stats.specialDepth
      ) {
        this.damageBoss(this.boss, totalDmg, p, true);
        hitAny++;
      }
    }
    for (const b of this.breakables) {
      if (
        !b.broken &&
        Math.abs(b.x - p.x) <= stats.specialRadius &&
        Math.abs(b.y - p.y) <= stats.specialDepth
      ) {
        this.hitBreakable(b);
      }
    }

    // Drain 8 HP ONLY if at least 1 enemy hit, and never kill
    if (hitAny > 0 && !this.debugGodMode) {
      p.hp = applySpecialCost(p.hp, hitAny);
      p.hpFlashRedTimer = 0.55;
      this.spawnFloatingText(p.x, p.y, 110, '-8 HP', PALETTE.demonRed, 1.1);
    }
  }

  private updateSpecialFx(p: PlayerEntity, dt: number): void {
    if (!this.specialFx.active) return;
    this.specialFx.timer -= dt;
    if (this.specialFx.charId === 'crismj' && Math.random() < 0.72) {
      this.spawnParticle(
        p.x + (Math.random() * 2 - 1) * 145,
        p.y + (Math.random() * 2 - 1) * 58,
        155 + Math.random() * 35,
        (Math.random() - 0.5) * 65,
        0,
        -110 - Math.random() * 50,
        0.65,
        8,
        Math.random() < 0.7 ? '#22C55E' : PALETTE.yellow,
        'bill'
      );
      if (Math.random() < 0.45) {
        this.spawnParticle(
          p.x + (Math.random() * 2 - 1) * 130,
          p.y + (Math.random() * 2 - 1) * 45,
          25 + Math.random() * 90,
          (Math.random() - 0.5) * 80,
          0,
          80 + Math.random() * 90,
          0.35,
          5,
          PALETTE.yellow,
          'star'
        );
      }
    } else if (this.specialFx.charId === 'marcianeke' && Math.random() < 0.65) {
      const ang = Math.random() * Math.PI * 2;
      this.spawnParticle(
        p.x + Math.cos(ang) * (40 + Math.random() * 95),
        p.y + Math.sin(ang) * 40,
        20 + Math.random() * 75,
        Math.cos(ang) * 90,
        0,
        70 + Math.random() * 80,
        0.26,
        5,
        Math.random() < 0.5 ? '#FFFFFF' : PALETTE.cyan,
        'star'
      );
    } else if (this.specialFx.charId === 'bayron' && Math.random() < 0.65) {
      const ang = Math.random() * Math.PI * 2;
      this.spawnParticle(
        p.x + Math.cos(ang) * (35 + Math.random() * 90),
        p.y + Math.sin(ang) * 35,
        6,
        Math.cos(ang) * 110,
        Math.sin(ang) * 28,
        85 + Math.random() * 95,
        0.32,
        6,
        Math.random() < 0.5 ? PALETTE.yellow : PALETTE.magenta,
        'spark'
      );
    }
    if (this.specialFx.timer <= 0) {
      this.specialFx.active = false;
    }
  }

  private checkPlayerMeleeHits(
    p: PlayerEntity,
    damage: number,
    hitbox: { x: number; z: number; w: number; h: number },
    knockdown: boolean,
    isShoulder: boolean
  ): void {
    const atkX = hitbox.x;
    const atkY = p.y;
    const atkZ = hitbox.z;
    const atkW = hitbox.w;
    const atkH = hitbox.h;

    let landedOnTarget = false;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.hp <= 0 || e.state === 'ko' || e.state === 'knockdown' || p.attackHitSet.has(e.id)) {
        continue;
      }
      if (overlapsHitbox25D(atkX, atkY, atkZ, atkW, atkH, e.x, e.y, e.z, 42, 92)) {
        p.attackHitSet.add(e.id);
        this.damageEnemy(e, damage, p.facing, knockdown, p, isShoulder);
        landedOnTarget = true;
      }
    }

    if (
      this.boss &&
      this.boss.hp > 0 &&
      this.boss.state !== 'ko' &&
      this.boss.state !== 'knockdown' &&
      this.boss.state !== 'phaseTransition' &&
      !p.attackHitSet.has(this.boss.id)
    ) {
      if (
        overlapsHitbox25D(
          atkX,
          atkY,
          atkZ,
          atkW,
          atkH,
          this.boss.x,
          this.boss.y,
          this.boss.z,
          56,
          120
        )
      ) {
        p.attackHitSet.add(this.boss.id);
        this.damageBoss(this.boss, damage, p, knockdown);
        landedOnTarget = true;
      }
    }

    for (let i = 0; i < this.breakables.length; i++) {
      const b = this.breakables[i];
      if (b.broken || p.attackHitSet.has(b.id)) continue;
      if (overlapsHitbox25D(atkX, atkY, atkZ, atkW, atkH, b.x, b.y, 0, 44, 52)) {
        p.attackHitSet.add(b.id);
        this.hitBreakable(b);
      }
    }

    if (landedOnTarget && p.weapon) {
      p.weaponUses -= 1;
      if (p.weaponUses <= 0) {
        p.weapon = null;
      }
    }
  }

  private damageEnemy(
    e: EnemyEntity,
    rawDmg: number,
    dir: 1 | -1,
    knockdown: boolean,
    p: PlayerEntity,
    guardBreaker = false
  ): void {
    // Doméstico blocks 50% frontal attacks unless guard-broken or hit from behind
    const hitFromFront = dir !== e.facing;
    let dmg = rawDmg;
    if (
      e.type === 'domestico' &&
      e.isGuardActive &&
      hitFromFront &&
      !guardBreaker &&
      e.state !== 'hurt'
    ) {
      dmg = Math.max(1, Math.round(rawDmg * 0.5));
      this.spawnFloatingText(e.x, e.y, e.z + 90, 'BLOQUEO', PALETTE.cyan, 0.85);
    }

    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlashTimer = 0.08;
    e.squashX = 1.24;
    e.squashY = 0.8;
    this.lastTargetName = ENEMY_BASE_STATS[e.type].label;
    this.lastTargetHp = e.hp;
    this.lastTargetMaxHp = e.maxHp;

    // Release player if Chupetona/Zombie was draining
    if (e.state === 'draining') {
      p.state = 'idle';
      p.stateTimer = 0;
      p.mashBreakCount = 0;
      p.invulnTimer = Math.max(p.invulnTimer, 0.8);
      this.grabCooldown = 0.6;
    }

    this.addScore(p, 10);
    this.spawnHitBurst(e.x, e.y, e.z + 55, PALETTE.yellow, knockdown ? 14 : 6);
    this.spawnBloodBurst(e.x, e.y, e.z + 62, dir, knockdown);
    this.spawnFloatingText(e.x, e.y, e.z + 85, `-${dmg}`, '#FFFFFF', knockdown ? 1.25 : 1.0);
    this.triggerHitstop(knockdown);

    if (knockdown) {
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
    }
    this.audio.playPlayerHitEnemy();

    if (e.hp <= 0) {
      e.state = 'ko';
      e.stateTimer = 0.45;
      e.vx = dir * 240;
      e.vz = 180;
      this.addScore(p, ENEMY_BASE_STATS[e.type].score + e.stolenPoints);
      if (e.stolenPoints > 0) {
        this.spawnFloatingText(e.x, e.y, 100, `+${e.stolenPoints} RECUPERADOS`, PALETTE.graffiti, 1.1);
      }
      if (e.guaranteedDrop) {
        this.spawnPickup(e.guaranteedDrop, e.x, e.y);
      }
      return;
    }

    // Fan lunática hysteric below 30% HP
    if (e.type === 'fan' && !e.hysteric && e.hp <= e.maxHp * 0.3) {
      e.hysteric = true;
      e.speed *= 1.3;
      this.spawnFloatingText(e.x, e.y, 105, '¡HISTÉRICA!', PALETTE.magenta, 1.05);
    }

    const shouldKnockdown = recordEnemyHitAndCheckKnockdownInPlace(e.recentHitTimestamps, this.timeSec);

    if (knockdown || shouldKnockdown) {
      e.state = 'knockdown';
      e.stateTimer = 0.8;
      e.vx = dir * 190;
      e.vz = 160;
      this.addScore(p, 50);
    } else if (!(e.type === 'fan' && e.hysteric)) {
      e.state = 'hurt';
      e.stateTimer = 0.4;
      e.vx = dir * 90;
    }
  }

  private damageBoss(b: BossEntity, dmg: number, p: PlayerEntity, heavy: boolean): void {
    b.hp = Math.max(0, b.hp - dmg);
    b.hitFlashTimer = 0.08;
    b.squashX = 1.18;
    b.squashY = 0.86;
    if (b.defId === 4) b.visibleTimer = 2.0; // Productor Fantasma se vuelve visible 2s

    this.addScore(p, 10);
    const hitDir: 1 | -1 = b.x >= p.x ? 1 : -1;
    this.spawnHitBurst(b.x, b.y, b.z + 65, PALETTE.yellow, heavy ? 16 : 8);
    this.spawnBloodBurst(b.x, b.y, b.z + 74, hitDir, heavy);
    this.spawnFloatingText(b.x, b.y, b.z + 100, `-${dmg}`, PALETTE.yellow, heavy ? 1.3 : 1.05);
    this.triggerHitstop(heavy);
    this.audio.playPlayerHitBoss();

    if (b.hp <= 0) {
      b.state = 'ko';
      b.drainTimer = 0;
      if (p.state === 'grabbedByEnemy') {
        p.state = 'idle';
        p.stateTimer = 0;
        p.mashBreakCount = 0;
        p.invulnTimer = Math.max(p.invulnTimer, 0.8);
      }
      b.vx = hitDir * 180;
      b.vz = 220;
      this.bossDefeatTimer = 2.6;
      this.whiteFlashTimer = 0.35;
      this.shakeTrauma = 1;
      if (b.defId === 2) {
        this.audio.playBoss2Defeat();
      }
      const def = BOSSES[b.defId];
      this.dialogueSpeaker = def.name;
      this.dialogueText = def.defeatLine;
      this.addScore(p, def.scoreBonus);
      // Rain points & food
      for (let idx = 0; idx < BOSS_KO_DROPS.length; idx++) {
        this.spawnPickup(
          BOSS_KO_DROPS[idx],
          b.x + (idx - 2) * 48,
          clampWalkY(b.y + (idx % 2 === 0 ? -15 : 15))
        );
      }
      return;
    }

    // Knockdown only at each 25% HP threshold (sección 8)
    if (b.hp <= b.nextKnockdownThreshold) {
      b.nextKnockdownThreshold -= b.maxHp * 0.25;
      b.state = 'knockdown';
      b.drainTimer = 0;
      if (p.state === 'grabbedByEnemy') {
        p.state = 'idle';
        p.stateTimer = 0;
        p.mashBreakCount = 0;
        p.invulnTimer = Math.max(p.invulnTimer, 0.8);
      }
      b.stateTimer = 0.85;
      b.vx = (b.x >= p.x ? 1 : -1) * 160;
      b.vz = 170;
    } else if (
      b.state !== 'telegraph' &&
      b.state !== 'attack' &&
      b.state !== 'phaseTransition' &&
      (b.defId !== 5 || (heavy && b.state === 'recover'))
    ) {
      // Super armor during telegraph/attack; Boss 5 briefly flinches only on heavy hits during recovery
      b.state = 'hurt';
      b.stateTimer = b.defId === 5 ? 0.16 : 0.25;
      b.vx = (b.x >= p.x ? 1 : -1) * 90;
    }

    // Boss 5 3-Phase transitions (650 & 300)
    if (b.defId === 5) {
      if (b.phase === 1 && b.hp <= 650) {
        this.triggerBoss5Phase(b, 2, p);
      } else if (b.phase === 2 && b.hp <= 300) {
        this.triggerBoss5Phase(b, 3, p);
      } else if (b.phase === 1 && !b.spawned80Wave && b.hp <= 800) {
        b.spawned80Wave = true;
        this.spawnBossReinforcements('manager', 2);
      } else if (b.phase === 3 && !b.spawnedP3_150 && b.hp <= 150) {
        b.spawnedP3_150 = true;
        this.spawnBossReinforcements('fan', 3);
      } else if (b.phase === 3 && !b.spawnedP3_50 && b.hp <= 50) {
        b.spawnedP3_50 = true;
        this.spawnBossReinforcements('domestico', 3);
      }
    } else if (b.defId === 4) {
      if (!b.spawned66Wave && b.hp <= b.maxHp * 0.66) {
        b.spawned66Wave = true;
        this.spawnBossReinforcements('chupetona', 2);
      } else if (!b.spawned33Wave && b.hp <= b.maxHp * 0.33) {
        b.spawned33Wave = true;
        this.spawnBossReinforcements('fan', 2);
      }
    } else if (!b.spawned50Wave && b.hp <= b.maxHp * 0.5) {
      b.spawned50Wave = true;
      const lvl = LEVELS[this.levelIndex];
      this.spawnBossReinforcements(lvl.dripPool[lvl.dripPool.length - 1], 2);
    }
  }

  private triggerBoss5Phase(b: BossEntity, phase: 2 | 3, p: PlayerEntity): void {
    b.phase = phase;
    b.state = 'phaseTransition';
    b.drainTimer = 0;
    if (p.state === 'grabbedByEnemy') {
      p.state = 'idle';
      p.stateTimer = 0;
      p.mashBreakCount = 0;
      p.invulnTimer = Math.max(p.invulnTimer, 0.8);
    }
    b.stateTimer = 1.75;
    b.vx = 0;
    b.vy = 0;
    b.z = 2;
    b.vz = 260;
    this.whiteFlashTimer = 0.35;
    this.bannerText = phase === 2 ? '¡FORMA DEMONÍACA!' : '¡LLUVIA DE CONTRATOS!';
    this.bannerTimer = 2.0;
    this.spawnPickup('empanada', p.x + 60, clampWalkY(p.y));
  }

  private spawnBossReinforcements(type: EnemyType, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnEnemy(type, i % 2 === 0 ? 'left' : 'right', i, count);
    }
  }

  private updateEnemies(p: PlayerEntity, lvl: LevelDef, dt: number): void {
    let activeAttackers = 0;
    for (let k = 0; k < this.enemies.length; k++) {
      const st = this.enemies[k].state;
      if (st === 'telegraph' || st === 'attack' || st === 'draining') {
        activeAttackers++;
      }
    }

    // Clean finished KO enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.animTime += dt;
      if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      if (e.jingleBuffTimer && e.jingleBuffTimer > 0) e.jingleBuffTimer -= dt;
      e.squashX += (1 - e.squashX) * Math.min(1, dt * 12);
      e.squashY += (1 - e.squashY) * Math.min(1, dt * 12);

      if (e.state === 'ko') {
        e.stateTimer -= dt;
        e.x += e.vx * dt;
        e.vx *= Math.exp(-3.5 * dt);
        const prevVz = e.vz;
        this.applyGravityAndClamp(e, dt);
        if (e.z === 0 && prevVz < -210) {
          e.vz = Math.abs(prevVz) * 0.24;
          e.squashX = 1.18;
          e.squashY = 0.82;
        }
        if (e.stateTimer <= 0) {
          this.spawnHitBurst(e.x, e.y, 35, '#94A3B8', 8);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.state === 'grabbed') continue;

      if (e.state === 'thrown') {
        e.stateTimer -= dt;
        e.x += e.vx * dt;
        e.vx *= Math.exp(-1.8 * dt);
        const prevVz = e.vz;
        this.applyGravityAndClamp(e, dt);
        if (e.z === 0 && prevVz < -190) {
          e.vz = Math.abs(prevVz) * 0.28;
          e.squashX = 1.22;
          e.squashY = 0.78;
          this.spawnDustBurst(e.x, e.y, 4);
        }
        if (this.zoneLocked || this.enemies.length <= 2) {
          const minClamp = Math.max(this.cameraMinX, this.cameraX) + 18;
          const maxClamp = Math.min(this.cameraMaxX, this.cameraX + LOGICAL_WIDTH) - 18;
          if (maxClamp > minClamp) {
            e.x = Math.max(minClamp, Math.min(maxClamp, e.x));
          }
        }
        // Thrown enemy damages other enemies for 8
        const throwDir: 1 | -1 = e.vx !== 0 ? (e.vx > 0 ? 1 : -1) : e.facing;
        for (const other of this.enemies) {
          if (
            other.id !== e.id &&
            other.hp > 0 &&
            other.state !== 'thrown' &&
            other.state !== 'knockdown' &&
            other.state !== 'ko' &&
            Math.abs(other.x - e.x) < 42 &&
            Math.abs(other.y - e.y) < 22
          ) {
            this.damageEnemy(other, 8, throwDir, true, p);
          }
        }
        if (e.stateTimer <= 0 && e.z <= 0) {
          e.state = 'knockdown';
          e.stateTimer = 0.6;
          e.vx = 0;
        }
        continue;
      }

      if (e.state === 'entering') {
        e.stateTimer -= dt;
        if (e.fromSewer && e.sewerRise !== undefined) {
          e.sewerRise = Math.max(0, e.stateTimer / 0.65);
        } else {
          e.x += e.vx * dt;
          e.vx *= Math.exp(-2.4 * dt);
        }
        if (e.stateTimer <= 0) {
          e.sewerRise = 0;
          e.state = 'approach';
        }
        continue;
      }

      if (e.state === 'hurt' || e.state === 'knockdown' || e.state === 'getup' || e.state === 'recover') {
        e.stateTimer -= dt;
        e.x += e.vx * dt;
        e.vx *= Math.exp(-6.5 * dt);
        const prevVz = e.vz;
        this.applyGravityAndClamp(e, dt);
        if (e.state === 'knockdown' && e.z === 0 && prevVz < -190) {
          e.vz = Math.abs(prevVz) * 0.25;
          e.squashX = 1.18;
          e.squashY = 0.82;
          this.spawnDustBurst(e.x, e.y, 3);
        }
        if (this.zoneLocked || this.enemies.length <= 2) {
          const minClamp = Math.max(this.cameraMinX, this.cameraX) + 18;
          const maxClamp = Math.min(this.cameraMaxX, this.cameraX + LOGICAL_WIDTH) - 18;
          if (maxClamp > minClamp) {
            e.x = Math.max(minClamp, Math.min(maxClamp, e.x));
          }
        }
        if (e.stateTimer <= 0) {
          if (e.state === 'knockdown') {
            e.state = 'getup';
            e.stateTimer = 0.25;
          } else {
            e.state = 'approach';
          }
        }
        continue;
      }

      if (e.state === 'fleeing') {
        const fleeDir = e.x >= p.x ? 1 : -1;
        e.facing = fleeDir;
        e.x += fleeDir * e.speed * 1.35 * dt;
        e.y = clampWalkY(e.y);
        this.applyGravityAndClamp(e, dt);
        if (e.x < this.cameraX - 80 || e.x > this.cameraX + LOGICAL_WIDTH + 80) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.state === 'draining') {
        e.stateTimer -= dt;
        e.x = p.x + (e.x >= p.x ? 26 : -26);
        e.y = p.y;
        e.vx = 0;
        e.vy = 0;
        // Drain HP per second
        const drainAmt = e.damage * dt;
        if (!this.debugGodMode) {
          p.hp = Math.max(1, p.hp - drainAmt);
        }
        if (e.type === 'chupetona') {
          e.hp = Math.min(e.maxHp, e.hp + drainAmt);
        }
        if (e.stateTimer <= 0 || p.state !== 'grabbedByEnemy') {
          e.state = 'recover';
          e.stateTimer = 0.6;
          if (p.state === 'grabbedByEnemy') {
            p.state = 'idle';
            p.stateTimer = 0;
            p.mashBreakCount = 0;
            p.invulnTimer = Math.max(p.invulnTimer, 0.8);
            this.grabCooldown = 0.6;
          }
        }
        continue;
      }

      // 52px minimum separation between enemies so sprites never overlap identically
      for (let j = 0; j < this.enemies.length; j++) {
        const other = this.enemies[j];
        if (other.id === e.id || other.state === 'ko' || other.state === 'grabbed') continue;
        const dxSep = e.x - other.x;
        if (Math.abs(dxSep) >= 52) continue;
        const dySep = e.y - other.y;
        if (Math.abs(dySep) >= 52) continue;
        const distSq = dxSep * dxSep + dySep * dySep;
        if (distSq > 0 && distSq < 52 * 52) {
          const dist = Math.sqrt(distSq);
          e.x += (dxSep / dist) * 78 * dt;
          e.y = clampWalkY(e.y + (dySep / dist) * 52 * dt);
        }
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      e.facing = resolveDeadzoneFacing(dx, e.facing, 8);
      const stats = ENEMY_BASE_STATS[e.type];
      const buffMul = e.jingleBuffTimer && e.jingleBuffTimer > 0 ? 1.2 : 1.0;
      const lastFewMul = this.enemies.length <= 2 ? 1.18 : 1.0;
      const moveSpd = e.speed * buffMul * lastFewMul;

      if (e.state === 'telegraph') {
        e.stateTimer -= dt;
        e.vx *= Math.exp(-10 * dt);
        e.vy = 0;
        e.x += e.vx * dt;
        this.applyGravityAndClamp(e, dt);
        if (e.stateTimer <= 0) {
          e.state = 'attack';
          e.stateTimer = e.type === 'cachorro' ? 0.35 : 0.28;
          e.hasHitPlayerThisAttack = false;
          e.attackId++;
          if (e.type === 'cachorro') {
            e.vx = e.facing * 330;
          } else if (e.type === 'domestico' && absDx > 110) {
            this.spawnProjectile('enemy', 'pan', e.x + e.facing * 20, e.y, 50, e.facing * 280, 0, 7);
            e.state = 'recover';
            e.stateTimer = 0.7;
          } else if (e.type === 'manager' && absDx > 115) {
            this.spawnProjectile('enemy', 'contract', e.x + e.facing * 20, e.y, 55, e.facing * 310, 0, 8);
            e.state = 'recover';
            e.stateTimer = 0.7;
          }
        }
        continue;
      }

      if (e.state === 'attack') {
        e.stateTimer -= dt;
        if (e.type === 'cachorro') {
          e.x += e.vx * dt;
          e.vx *= Math.exp(-2.2 * dt);
          if (this.zoneLocked || this.enemies.length <= 2) {
            const minClamp = Math.max(this.cameraMinX, this.cameraX) + 18;
            const maxClamp = Math.min(this.cameraMaxX, this.cameraX + LOGICAL_WIDTH) - 18;
            if (maxClamp > minClamp) {
              e.x = Math.max(minClamp, Math.min(maxClamp, e.x));
            }
          }
        }
        if (!e.hasHitPlayerThisAttack) {
          if (
            p.invulnTimer <= 0 &&
            p.state !== 'knockdown' &&
            p.state !== 'ko' &&
            p.state !== 'special' &&
            p.state !== 'grabbedByEnemy' &&
            overlapsHitbox25D(
              e.x + e.facing * (stats.reach * 0.5),
              e.y,
              e.z,
              stats.reach,
              85,
              p.x,
              p.y,
              p.z,
              40,
              100
            )
          ) {
            e.hasHitPlayerThisAttack = true;
            if (e.type === 'zombie' || e.type === 'chupetona') {
              // Grab & drain!
              this.releasePlayerGrabTarget(p, false);
              const drainDur = e.type === 'chupetona' ? 3.0 : 2.0;
              e.state = 'draining';
              e.stateTimer = drainDur;
              // Reinicia animTime para que la pose de reacción se vea desde el primer frame.
              p.state = 'grabbedByEnemy';
              p.animTime = 0;
              p.stateTimer = drainDur;
              p.mashBreakCount = 0;
              this.damagePlayer(p, e.type === 'zombie' ? 4 : 2, e.facing, false);
              continue;
            } else if (e.type === 'manager') {
              // Steals 500 pts and flees!
              const stolen = Math.min(500, p.score);
              p.score -= stolen;
              e.stolenPoints += stolen;
              this.damagePlayer(p, e.damage, e.facing, false);
              if (stolen > 0) {
                this.spawnFloatingText(e.x, e.y, 110, `-${stolen} PTS ROBADOS`, PALETTE.demonRed, 1.0);
                e.state = 'fleeing';
                continue;
              }
            } else {
              this.damagePlayer(p, e.damage, e.facing, e.type === 'fan');
            }
          }
        }
        if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = e.type === 'cachorro' ? 1.8 : 0.65;
          e.attackCooldown = e.type === 'cachorro' ? 3.0 : 1.4;
          e.vx = 0;
          e.vy = 0;
        }
        continue;
      }

      // Approach vs Circle based on O(N) precomputed attack token count
      const tokenAvailable = activeAttackers < lvl.maxAttackTokens;
      const isRangedShooter = (e.type === 'domestico' || e.type === 'manager') && absDx > 140 && absDx < 320 && absDy <= 24;
      const inMeleeRange = absDx <= stats.reach && absDy <= 20;

      if (
        (inMeleeRange || isRangedShooter) &&
        e.attackCooldown <= 0 &&
        e.x > this.cameraX + 20 &&
        e.x < this.cameraX + LOGICAL_WIDTH - 20 &&
        tokenAvailable
      ) {
        e.state = 'telegraph';
        e.stateTimer = stats.telegraphTime;
        activeAttackers++;
      } else {
        let desiredVx = 0;
        let desiredVy = 0;
        if (absDx > 260 || !tokenAvailable) {
          // Circle at 180-260 px when waiting for attack token
          e.state = absDx < 180 ? 'circle' : 'approach';
          const desiredX = p.x - e.facing * 210;
          const moveDx = desiredX - e.x;
          desiredVx = Math.abs(moveDx) > 6 ? Math.sign(moveDx) * moveSpd : 0;
          desiredVy = absDy > 4 ? Math.sign(dy) * moveSpd * 0.55 : 0;
        } else {
          e.state = 'approach';
          desiredVx = absDx > 6 ? Math.sign(dx) * moveSpd : 0;
          desiredVy = absDy > 4 ? Math.sign(dy) * moveSpd * 0.65 : 0;
        }
        stepVelocity2DInto(this.velScratch, e.vx, e.vy, desiredVx, desiredVy, 1400, 1800, dt);
        e.vx = this.velScratch.vx;
        e.vy = this.velScratch.vy;
        e.x += e.vx * dt;
        e.y = clampWalkY(e.y + e.vy * dt);
        this.applyGravityAndClamp(e, dt);
      }

      // Keep enemies inside active locked arena or visible screen so waves never freeze offscreen
      if (this.zoneLocked || this.enemies.length <= 2) {
        const minClamp = Math.max(this.cameraMinX, this.cameraX) + 18;
        const maxClamp = Math.min(this.cameraMaxX, this.cameraX + LOGICAL_WIDTH) - 18;
        if (maxClamp > minClamp) {
          e.x = Math.max(minClamp, Math.min(maxClamp, e.x));
        }
      }
    }
  }

  private updateBoss(b: BossEntity, p: PlayerEntity, lvl: LevelDef, dt: number): void {
    b.animTime += dt;
    if (b.hitFlashTimer > 0) b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
    if (b.visibleTimer > 0) b.visibleTimer = Math.max(0, b.visibleTimer - dt);
    if (b.drainTimer > 0) {
      b.drainTimer = Math.max(0, b.drainTimer - dt);
      if (b.drainTimer <= 0 && p.state === 'grabbedByEnemy') {
        p.state = 'idle';
        p.stateTimer = 0;
        p.mashBreakCount = 0;
        p.invulnTimer = Math.max(p.invulnTimer, 0.8);
        this.grabCooldown = 0.6;
      }
    }
    b.squashX += (1 - b.squashX) * Math.min(1, dt * 12);
    b.squashY += (1 - b.squashY) * Math.min(1, dt * 12);

    if (b.state === 'ko') {
      b.x += b.vx * dt;
      b.vx *= Math.exp(-5.5 * dt);
      this.applyGravityAndClamp(b, dt);
      b.x = Math.max(lvl.bossArenaLeft + 38, Math.min(lvl.bossArenaRight - 38, b.x));
      return;
    }

    if (b.state === 'phaseTransition') {
      b.stateTimer -= dt;
      const wasAir = b.z > 0;
      this.applyGravityAndClamp(b, dt);
      if (wasAir && b.z <= 0) {
        b.squashX = 1.24;
        b.squashY = 0.76;
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.55);
        this.spawnDustBurst(b.x, b.y, 10);
      }
      if (b.stateTimer <= 0) b.state = 'chase';
      return;
    }

    if (b.state === 'hurt' || b.state === 'knockdown' || b.state === 'getup' || b.state === 'recover') {
      b.stateTimer -= dt;
      b.x += b.vx * dt;
      b.vx *= Math.exp(-7.5 * dt);
      this.applyGravityAndClamp(b, dt);
      b.x = Math.max(lvl.bossArenaLeft + 38, Math.min(lvl.bossArenaRight - 38, b.x));
      if (b.stateTimer <= 0) {
        b.state = b.state === 'knockdown' ? 'getup' : 'chase';
        if (b.state === 'getup') b.stateTimer = 0.25;
      }
      return;
    }

    const def = BOSSES[b.defId];
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    b.facing = resolveDeadzoneFacing(dx, b.facing, 8);

    // Boss 3 teleports every 8s
    if (b.defId === 3) {
      b.teleportTimer -= dt;
      if (b.teleportTimer <= 0 && b.state === 'chase') {
        b.teleportTimer = 8.0;
        b.x = p.x > lvl.bossArenaLeft + 480 ? lvl.bossArenaLeft + 100 : lvl.bossArenaRight - 100;
        b.prevX = b.x;
        this.spawnHitBurst(b.x, b.y, 60, PALETTE.magenta, 14);
      }
    }

    if (b.state === 'telegraph') {
      b.stateTimer -= dt;
      b.vx *= Math.exp(-10 * dt);
      b.vy = 0;
      b.x += b.vx * dt;
      this.applyGravityAndClamp(b, dt);
      b.x = Math.max(lvl.bossArenaLeft + 38, Math.min(lvl.bossArenaRight - 38, b.x));
      if (b.stateTimer <= 0) {
        this.executeBossAttackStart(b, p, def.baseDamage);
      }
      return;
    }

    if (b.state === 'attack') {
      b.stateTimer -= dt;
      this.updateBossActiveAttack(b, p, lvl, def.baseDamage, dt);
      if (b.stateTimer <= 0) {
        b.vx = 0;
        b.vy = 0;
        b.state = 'recover';
        b.stateTimer = b.defId === 2 ? 0.9 : b.defId === 5 && b.phase >= 2 ? 0.85 : 1.05;
      }
      return;
    }

    // Smooth velocity-driven boss chase & attack selection
    const phaseMul = b.defId === 5 ? (b.phase === 3 ? 1.24 : b.phase === 2 ? 1.12 : 1) : 1;
    const chaseSpd = def.speed * phaseMul;
    const desiredVx = absDx > 10 ? Math.sign(dx) * chaseSpd : 0;
    const desiredVy = absDy > 6 ? Math.sign(dy) * chaseSpd * 0.62 : 0;
    stepVelocity2DInto(this.velScratch, b.vx, b.vy, desiredVx, desiredVy, 950, 1400, dt);
    b.vx = this.velScratch.vx;
    b.vy = this.velScratch.vy;
    b.x = Math.max(lvl.bossArenaLeft + 42, Math.min(lvl.bossArenaRight - 42, b.x + b.vx * dt));
    b.y = clampWalkY(b.y + b.vy * dt);
    this.applyGravityAndClamp(b, dt);

    if (absDx < (b.defId >= 3 ? 320 : 165) && absDy < 38) {
      b.attackKind = this.pickNextBossAttack(b);
      b.lastAttackKind = b.attackKind;
      b.state = 'telegraph';
      b.stateTimer = b.attackKind === 'shoulderCharge' ? 0.5 : 0.45;
    }
  }

  private pickNextBossAttack(b: BossEntity): BossAttackKind {
    let pool: BossAttackKind[] = ['doublePunch', 'shoulderCharge', 'stompWave'];
    if (b.defId === 2) pool = ['radioDash', 'flyingKick', 'doublePunch', 'stompWave', 'jingleBuff'];
    else if (b.defId === 3) {
      pool = ['doublePunch', 'shoulderCharge', 'flyingKick', 'stompWave', 'throwPhone', 'enVivoMark'];
    }
    else if (b.defId === 4) {
      pool = ['noteFan', 'soundPush', 'doublePunch', 'shoulderCharge', 'flyingKick', 'stompWave'];
    }
    else if (b.defId === 5) {
      if (b.phase === 1) pool = ['briefcaseSwing', 'contractSweep'];
      else if (b.phase === 2) pool = ['fireWave', 'signatureGrab', 'shoulderCharge'];
      else pool = ['contractRain', 'fireWave', 'briefcaseSwing'];
    }
    const filtered = pool.filter((k) => k !== b.lastAttackKind);
    const list = filtered.length > 0 ? filtered : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  private executeBossAttackStart(b: BossEntity, p: PlayerEntity, dmg: number): void {
    b.state = 'attack';
    b.hasHitPlayerThisAttack = false;
    b.attackId++;
    b.vy = 0;
    switch (b.attackKind) {
      case 'doublePunch':
        b.stateTimer = 0.42;
        b.vx = b.facing * 135;
        break;
      case 'shoulderCharge':
      case 'radioDash':
        b.stateTimer = 0.55;
        b.vx = b.facing * (b.attackKind === 'radioDash' ? 420 : 340);
        this.spawnDustBurst(b.x - b.facing * 16, b.y, 5);
        break;
      case 'briefcaseSwing':
        b.stateTimer = 0.45;
        b.vx = b.facing * 120;
        break;
      case 'signatureGrab':
        b.stateTimer = 0.45;
        b.vx = b.facing * 260;
        break;
      case 'flyingKick':
        b.stateTimer = 0.55;
        b.vx = b.facing * 290;
        b.z = Math.max(b.z, 2);
        b.vz = 260;
        break;
      case 'stompWave':
        b.stateTimer = 0.4;
        this.hazards.push({
          id: this.nextEntityId++,
          kind: 'shockwave',
          x: b.x,
          y: b.y,
          radius: 135,
          timer: 0.45,
          maxTimer: 0.45,
          damage: dmg,
          triggered: false,
        });
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.45);
        break;
      case 'jingleBuff':
        b.stateTimer = 0.45;
        for (let idx = 0; idx < this.enemies.length; idx++) {
          this.enemies[idx].jingleBuffTimer = 5.0;
        }
        this.spawnFloatingText(b.x, b.y, 130, '¡SEÑAL ANDROIDE +20% VEL!', PALETTE.cyan, 1.1);
        break;
      case 'throwPhone':
        b.stateTimer = 0.35;
        this.spawnProjectile('boss', 'phone', b.x + b.facing * 24, b.y, 70, b.facing * 260, 0, 8, 220);
        break;
      case 'enVivoMark':
        b.stateTimer = 0.4;
        this.hazards.push({
          id: this.nextEntityId++,
          kind: 'enVivo',
          x: p.x,
          y: p.y,
          radius: 68,
          timer: 1.0,
          maxTimer: 1.0,
          damage: 12,
          triggered: false,
        });
        break;
      case 'noteFan':
        b.stateTimer = 0.4;
        for (let idx = 0; idx < NOTE_FAN_VY.length; idx++) {
          this.spawnProjectile('boss', 'note', b.x + b.facing * 24, b.y, 55, b.facing * 270, NOTE_FAN_VY[idx], dmg);
        }
        break;
      case 'soundPush':
        b.stateTimer = 0.4;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 160) {
          this.damagePlayer(p, dmg, b.facing, true);
        }
        break;
      case 'contractSweep':
        b.stateTimer = 0.4;
        b.vx = 0;
        this.spawnProjectile('boss', 'contractBeam', b.x + b.facing * 24, b.y, 55, b.facing * 360, 0, dmg);
        break;
      case 'fireWave':
        b.stateTimer = 0.45;
        b.z = Math.max(b.z, 2);
        b.vz = 155;
        b.vx = b.facing * 75;
        this.spawnProjectile('boss', 'fireWave', b.x + b.facing * 24, b.y, 8, b.facing * 280, 0, dmg);
        break;
      case 'contractRain':
        b.stateTimer = 0.55;
        b.vx = 0;
        for (let k = -1; k <= 1; k++) {
          this.hazards.push({
            id: this.nextEntityId++,
            kind: 'contractRain',
            x: Math.max(this.cameraX + 60, Math.min(this.cameraX + LOGICAL_WIDTH - 60, p.x + k * 110)),
            y: clampWalkY(p.y + (k % 2 === 0 ? 0 : 24)),
            radius: 54,
            timer: 0.8,
            maxTimer: 0.8,
            damage: 13,
            triggered: false,
          });
        }
        break;
      default:
        b.stateTimer = 0.4;
        break;
    }
  }

  private updateBossActiveAttack(
    b: BossEntity,
    p: PlayerEntity,
    lvl: LevelDef,
    dmg: number,
    dt: number
  ): void {
    const wasAir = b.z > 0;
    b.x = Math.max(lvl.bossArenaLeft + 38, Math.min(lvl.bossArenaRight - 38, b.x + b.vx * dt));
    if (b.attackKind === 'shoulderCharge' || b.attackKind === 'radioDash' || b.attackKind === 'signatureGrab') {
      b.vx *= Math.exp(-3.0 * dt);
    } else if (b.attackKind !== 'flyingKick') {
      b.vx *= Math.exp(-7.5 * dt);
    }
    this.applyGravityAndClamp(b, dt);
    if (wasAir && b.z <= 0) {
      b.squashX = 1.18;
      b.squashY = 0.82;
      this.spawnDustBurst(b.x, b.y, 5);
      if (b.defId === 5 && b.attackKind === 'fireWave') {
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
      }
    }

    if (
      BOSS_MELEE_ATTACKS.has(b.attackKind) &&
      !b.hasHitPlayerThisAttack &&
      p.invulnTimer <= 0 &&
      p.state !== 'knockdown' &&
      p.state !== 'ko' &&
      p.state !== 'special' &&
      overlapsHitbox25D(
        b.x + b.facing * 32,
        b.y,
        b.z,
        72,
        105,
        p.x,
        p.y,
        p.z,
        42,
        100
      )
    ) {
      b.hasHitPlayerThisAttack = true;
      if (b.attackKind === 'signatureGrab' && p.state !== 'grabbedByEnemy') {
        this.releasePlayerGrabTarget(p, false);
        // Reinicia animTime para que la pose de reacción se vea desde el primer frame.
        p.state = 'grabbedByEnemy';
        p.animTime = 0;
        p.stateTimer = 1.8;
        p.mashBreakCount = 0;
        b.drainTimer = 1.8;
        this.damagePlayer(p, 8, b.facing, false);
      } else {
        this.damagePlayer(
          p,
          dmg,
          b.facing,
          b.attackKind === 'shoulderCharge' || b.attackKind === 'flyingKick'
        );
      }
    }
  }

  private damagePlayer(
    p: PlayerEntity,
    rawDmg: number,
    dir: 1 | -1,
    knockdown: boolean
  ): void {
    if (this.debugGodMode || p.invulnTimer > 0) return;
    this.audio.playEnemyHitPlayer();
    p.hp = Math.max(0, p.hp - rawDmg);
    if (this.boss) p.damageTakenOnBoss += rawDmg;
    p.squashX = 1.2;
    p.squashY = 0.82;
    p.grabPushTimer = 0;
    this.releasePlayerGrabTarget(p, false);
    this.grabCooldown = 0.55;

    this.spawnHitBurst(p.x, p.y, p.z + 55, PALETTE.demonRed, 10);
    this.spawnFloatingText(p.x, p.y, p.z + 95, `-${rawDmg}`, PALETTE.demonRed, 1.15);
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.3);

    if (p.hp <= 0) {
      p.mashBreakCount = 0;
      this.releaseGrabbingEnemies(p.x);
      p.lives -= 1;
      this.zoneLostLifeFlag = true;
      if (this.zoneLocked && this.activeZoneIndex < LEVELS[this.levelIndex].zones.length) {
        // Adaptive difficulty: spawn 1 bonus food when losing a life in a zone
        this.spawnPickup('empanada', this.cameraX + LOGICAL_WIDTH / 2, 484);
      }
      if (p.lives <= 0) {
        p.state = 'ko';
        p.animTime = 0;
        p.stateTimer = 0.7;
        this.continueCountdown = 10;
        this.setScreen('CONTINUAR');
      } else {
        p.hp = p.maxHp;
        p.state = 'knockdown';
        p.animTime = 0;
        p.stateTimer = 0.8;
        p.invulnTimer = 1.6;
        p.vz = 190;
        if (p.weapon) {
          this.spawnPickup(p.weapon, p.x + 25, p.y);
          p.weapon = null;
        }
      }
      return;
    }

    if (knockdown) {
      p.mashBreakCount = 0;
      this.releaseGrabbingEnemies(p.x);
      p.state = 'knockdown';
      p.animTime = 0;
      p.stateTimer = 0.8;
      p.vx = dir * 180;
      p.vz = 150;
      if (p.weapon) {
        this.spawnPickup(p.weapon, p.x + 25, p.y);
        p.weapon = null;
      }
    } else if (p.state !== 'grabbedByEnemy') {
      // Reinicia animTime para que la pose de daño se vea desde el frame 0.
      p.state = 'hurt';
      p.animTime = 0;
      p.stateTimer = 0.36;
      p.vx = dir * 115;
      p.invulnTimer = 0.8; // 0.8s parpadeo invulnerable (sección 4.7)
    }
  }

  private updateProjectiles(p: PlayerEntity, dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.kind === 'phone') {
        pr.vz -= GRAVITY * 0.55 * dt;
        pr.z = Math.max(0, pr.z + pr.vz * dt);
      }
      if (
        !pr.hitPlayer &&
        p.invulnTimer <= 0 &&
        p.state !== 'knockdown' &&
        p.state !== 'ko' &&
        overlapsHitbox25D(
          pr.x,
          pr.y,
          pr.z,
          pr.radius * 2,
          pr.radius * 2,
          p.x,
          p.y,
          p.z,
          38,
          98
        )
      ) {
        pr.hitPlayer = true;
        this.damagePlayer(p, pr.damage, pr.vx >= 0 ? 1 : -1, false);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateHazards(p: PlayerEntity, dt: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.timer -= dt;
      if (h.timer <= 0 && !h.triggered) {
        h.triggered = true;
        this.spawnHitBurst(h.x, h.y, 12, PALETTE.demonRed, 16);
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
        // Shockwave can be jumped over!
        const playerAirborne = h.kind === 'shockwave' && p.z > 24;
        if (
          !playerAirborne &&
          p.invulnTimer <= 0 &&
          p.state !== 'knockdown' &&
          p.state !== 'ko' &&
          Math.abs(p.x - h.x) <= h.radius &&
          Math.abs(p.y - h.y) <= h.radius * 0.55
        ) {
          this.damagePlayer(p, h.damage, p.x >= h.x ? 1 : -1, true);
        }
        this.hazards.splice(i, 1);
      }
    }
  }

  private updatePickups(p: PlayerEntity, dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (pk.collected) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.z > 0 || pk.vz !== 0) {
        pk.vz -= GRAVITY * dt;
        pk.z += pk.vz * dt;
        if (pk.z <= 0) {
          pk.z = 0;
          pk.vz = 0;
        }
      }
      const isWeapon =
        pk.type === 'tubo' || pk.type === 'bate' || pk.type === 'botella' || pk.type === 'cadena';
      // Food & points auto-collect on overlap; weapons require Attack near weapon
      if (
        !isWeapon &&
        Math.abs(pk.x - p.x) < 34 &&
        Math.abs(pk.y - p.y) < 22 &&
        p.z < 30
      ) {
        this.collectItem(p, pk);
      }
    }
  }

  private tryPickupWeaponOnGround(p: PlayerEntity): boolean {
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      const isWeapon =
        pk.type === 'tubo' || pk.type === 'bate' || pk.type === 'botella' || pk.type === 'cadena';
      if (isWeapon && Math.abs(pk.x - p.x) < 48 && Math.abs(pk.y - p.y) < 26) {
        const w = pk.type as WeaponType;
        p.weapon = w;
        p.weaponUses = WEAPON_STATS[w].uses;
        pk.collected = true;
        this.audio.playPickupWeapon();
        this.spawnFloatingText(p.x, p.y, 100, WEAPON_STATS[w].label, PALETTE.yellow, 1.0);
        return true;
      }
    }
    return false;
  }

  private collectItem(p: PlayerEntity, pk: PickupEntity): void {
    pk.collected = true;
    const item = ITEM_STATS[pk.type as Exclude<ItemType, WeaponType>];
    if (!item) return;
    if (item.extraLife) {
      this.audio.playPickup1Up();
    } else if (item.heal > 0) {
      this.audio.playPickupFood();
    } else {
      this.audio.playPickupCoin();
    }
    if (item.heal > 0) p.hp = Math.min(p.maxHp, p.hp + item.heal);
    if (item.extraLife) p.lives += item.extraLife;
    this.addScore(p, item.points);
    this.spawnFloatingText(pk.x, pk.y, 40, `+${item.label}`, item.color, 1.0);
  }

  private hitBreakable(b: BreakableEntity): void {
    b.hp -= 1;
    b.hitFlashTimer = 0.08;
    this.audio.playPlayerHitBreakable();
    this.spawnHitBurst(b.x, b.y, 24, PALETTE.yellow, 8);
    if (b.hp <= 0) {
      b.broken = true;
      this.spawnHitBurst(b.x, b.y, 24, '#D97706', 16);
      if (b.guaranteedDrop) {
        this.spawnPickup(b.guaranteedDrop, b.x, b.y);
      } else if (Math.random() < 0.6) {
        const pool: ItemType[] = ['empanada', 'billete', 'sandwich', 'tubo', 'energia'];
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        this.spawnPickup(chosen, b.x, b.y);
      }
    }
  }

  private updateCameraAndZones(p: PlayerEntity, lvl: LevelDef, dt: number): void {
    if (this.zoneLocked) {
      if (this.cameraTargetX !== null) {
        this.cameraX = stepCameraTowards(this.cameraX, this.cameraTargetX, dt, 10);
        const arenaMax = this.bossSpawned
          ? Math.max(this.cameraX + LOGICAL_WIDTH, lvl.bossArenaRight)
          : Math.max(
              this.cameraX + LOGICAL_WIDTH,
              lvl.zones[this.activeZoneIndex]?.arenaRight ?? lvl.width
            );
        this.cameraMinX = this.cameraX;
        this.cameraMaxX = arenaMax;
        if (this.cameraX === this.cameraTargetX) {
          this.cameraMinX = this.cameraTargetX;
          this.cameraMaxX = arenaMax;
          this.cameraTargetX = null;
        }
      }
      if (this.enemies.length === 0 && !this.bossSpawned) {
        this.zoneLocked = false;
        this.zoneLostLifeFlag = false;
        this.cameraTargetX = null;
        this.tutorialHint = null;
        this.cameraMinX = this.cameraX;
        this.cameraMaxX = lvl.width;
        this.goArrowTimer = 2.6;
      }
      return;
    }

    // Smooth forward arcade camera tracking (responsive follow, never snaps backward)
    const targetCam = p.x - LOGICAL_WIDTH * 0.36;
    if (targetCam > this.cameraX) {
      const maxDesired = Math.min(
        this.cameraMaxX - LOGICAL_WIDTH,
        Math.max(this.cameraMinX, targetCam)
      );
      this.cameraX = stepCameraTowards(this.cameraX, maxDesired, dt, 10);
      this.cameraMinX = this.cameraX;
    }

    // Check zone triggers (never rewind camera backward when spawning a wave)
    for (let i = 0; i < lvl.zones.length; i++) {
      const z = lvl.zones[i];
      if (!this.clearedZones.has(z.id) && p.x >= z.triggerX) {
        this.clearedZones.add(z.id);
        this.activeZoneIndex = i;
        this.zoneLocked = true;
        const bounds = resolveZoneArenaBounds(
          this.cameraX,
          z.arenaLeft,
          z.arenaRight,
          LOGICAL_WIDTH,
          lvl.width
        );
        this.cameraTargetX = bounds.needsGlide ? bounds.arenaLeft : null;
        this.cameraMinX = this.cameraX;
        this.cameraMaxX = bounds.arenaRight;
        this.tutorialHint = z.tutorialHint ?? null;
        const adj = applyAdaptiveDifficultyToSpawns(z.spawns, this.zoneLostLifeFlag);
        if (adj.bonusFood) {
          this.spawnPickup('empanada', this.cameraX + 240, 484);
        }
        const totalWaveCount = adj.spawns.reduce((acc, s) => acc + s.count, 0);
        let spawnIdx = 0;
        for (const sp of adj.spawns) {
          for (let k = 0; k < sp.count; k++) {
            const edge =
              sp.edge === 'both'
                ? k % 2 === 0
                  ? 'left'
                  : 'right'
                : sp.edge ?? 'right';
            this.spawnEnemy(sp.type, edge, spawnIdx, totalWaveCount);
            spawnIdx++;
          }
        }
        return;
      }
    }

    // Constant drip enemy every 6-9s between zones
    if (!this.bossSpawned) {
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.dripTimer = 6.5 + Math.random() * 2.5;
        if (this.enemies.length < lvl.maxSimultaneousEnemies) {
          const type = lvl.dripPool[Math.floor(Math.random() * lvl.dripPool.length)];
          this.spawnEnemy(type, Math.random() < 0.35 ? 'left' : 'right');
        }
      }
    }

    // Boss trigger
    if (!this.bossSpawned && p.x >= lvl.bossTriggerX) {
      this.triggerBossEncounter(lvl, p);
    }
  }

  private triggerBossEncounter(lvl: LevelDef, p: PlayerEntity): void {
    this.bossSpawned = true;
    this.zoneLocked = true;
    const bossBounds = resolveZoneArenaBounds(
      this.cameraX,
      lvl.bossArenaLeft,
      lvl.bossArenaRight,
      LOGICAL_WIDTH,
      lvl.width
    );
    this.cameraTargetX = bossBounds.needsGlide ? bossBounds.arenaLeft : null;
    this.cameraMinX = this.cameraX;
    this.cameraMaxX = bossBounds.arenaRight;
    this.releasePlayerGrabTarget(p, false);
    this.releaseGrabbingEnemies(p.x);
    if (p.state === 'grabbedByEnemy' || p.state === 'grabHold' || p.state === 'grabKnee') {
      p.state = 'idle';
      p.stateTimer = 0;
      p.grabPushTimer = 0;
      p.mashBreakCount = 0;
    }
    this.enemies = [];

    const def = BOSSES[lvl.bossId];
    this.boss = {
      id: this.nextEntityId++,
      defId: def.id,
      name: def.name,
      x: lvl.bossArenaRight - 140,
      y: 485,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: -1,
      hp: def.maxHp,
      maxHp: def.maxHp,
      phase: 1,
      state: 'intro',
      stateTimer: 0,
      animTime: 0,
      hitFlashTimer: 0,
      attackKind: 'doublePunch',
      lastAttackKind: null,
      attackId: 0,
      hasHitPlayerThisAttack: false,
      nextKnockdownThreshold: def.maxHp * 0.75,
      spawned50Wave: false,
      spawned66Wave: false,
      spawned33Wave: false,
      spawned80Wave: false,
      spawnedP3_150: false,
      spawnedP3_50: false,
      teleportTimer: 8.0,
      visibleTimer: 0,
      drainTimer: 0,
      squashX: 1,
      squashY: 1,
    };
    this.boss.prevX = this.boss.x;
    this.boss.prevY = this.boss.y;
    this.boss.prevZ = this.boss.z;

    this.introTimer = 2.2;
    this.bossDangerTimer = 2.2;
    this.bannerText = `${def.name} · ${def.title}`;
    this.bannerTimer = 2.2;
    this.dialogueSpeaker = def.name;
    this.dialogueText = `${def.preDialogueBoss} / ${CHARACTERS[p.charId].name}: "${def.preDialogueHero}"`;
    if (def.id === 2) {
      this.audio.playBoss2Appear();
    } else {
      this.audio.playBossDangerWarning();
    }

    this.setScreen('JEFE_INTRO');
  }

  private completeLevel(p: PlayerEntity, lvl: LevelDef): void {
    this.dialogueSpeaker = null;
    this.dialogueText = null;
    const res = computeLevelResults({
      levelNumber: lvl.levelNumber,
      elapsedSec: this.levelTimer,
      remainingHp: p.hp,
      damageTakenOnBoss: p.damageTakenOnBoss,
      score: p.score,
    });
    p.score = res.totalScore;
    this.saveHighScore(p.score);
    this.levelResults = res;
    this.audio.stopMusic();

    if (lvl.levelNumber === 5) {
      this.endingStep = 0;
      this.setScreen('VICTORIA');
    } else {
      this.setScreen('NIVEL_COMPLETO');
    }
  }

  private spawnEnemy(
    type: EnemyType,
    edge: 'left' | 'right' | 'sewer',
    spawnIdx = 0,
    spawnTotal = 1
  ): void {
    const lvl = LEVELS[this.levelIndex];
    const scaled = scaleEnemyStats(type, lvl.levelNumber);
    const fromSewer = edge === 'sewer' && type === 'zombie';
    const pos = computeSpawnStagger(
      fromSewer ? 'sewer' : edge === 'left' ? 'left' : 'right',
      spawnIdx,
      spawnTotal,
      this.cameraX,
      LOGICAL_WIDTH,
      WALK_MIN_Y,
      WALK_MAX_Y
    );

    this.enemies.push({
      id: this.nextEntityId++,
      type,
      x: pos.x,
      y: pos.y,
      z: 0,
      vx: edge === 'left' ? 195 : edge === 'right' ? -195 : 0,
      vy: 0,
      vz: 0,
      facing: edge === 'left' ? 1 : -1,
      hp: scaled.hp,
      maxHp: scaled.hp,
      damage: scaled.damage,
      speed: scaled.speed,
      state: 'entering',
      stateTimer: fromSewer ? 0.65 : 0.34 + spawnIdx * 0.08,
      animTime: Math.random() * 2,
      hitFlashTimer: 0,
      attackId: 0,
      attackCooldown: 0.65 + Math.random() * 0.65,
      hasHitPlayerThisAttack: false,
      recentHitTimestamps: [],
      isGuardActive: type === 'domestico',
      hysteric: false,
      stolenPoints: 0,
      guaranteedDrop: type === 'manager' ? 'billete' : undefined,
      squashX: 1,
      squashY: 1,
      fromSewer,
      sewerRise: fromSewer ? 1 : 0,
    });
  }

  private spawnPickup(type: ItemType, x: number, y: number): void {
    this.pickups.push({
      id: this.nextEntityId++,
      type,
      x: Math.max(this.cameraX + 40, Math.min(this.cameraX + LOGICAL_WIDTH - 40, x)),
      y: clampWalkY(y),
      z: 28,
      vz: 140,
      bobPhase: Math.random() * Math.PI * 2,
      collected: false,
    });
  }

  private spawnProjectile(
    owner: 'enemy' | 'boss',
    kind: ProjectileEntity['kind'],
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    damage: number,
    vz = 0
  ): void {
    const id = this.nextEntityId++;
    if (owner === 'enemy' || owner === 'boss') {
      this.audio.playEnemyThrow();
    }
    this.projectiles.push({
      id,
      owner,
      kind,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      damage,
      radius: 16,
      life: 2.5,
      hitPlayer: false,
    });
  }

  private addScore(p: PlayerEntity, pts: number): void {
    const prev = p.score;
    p.score += pts;
    const extra = countCrossedExtraLives(prev, p.score);
    if (extra > 0) {
      p.lives += extra;
      this.spawnFloatingText(p.x, p.y, 130, '+1 VIDA EXTRA!', PALETTE.magenta, 1.3);
    }
    this.saveHighScore(p.score);
  }

  private triggerHitstop(heavy: boolean): void {
    const budget = resolveHitstopBudget(this.hitstopTimer, this.hitstopCooldown, heavy);
    this.hitstopTimer = budget.hitstopTimer;
    this.hitstopCooldown = budget.hitstopCooldown;
  }

  private releasePlayerGrabTarget(p: PlayerEntity, pushForward: boolean): void {
    if (p.grabTargetId === null) return;
    const target = this.enemies.find((e) => e.id === p.grabTargetId);
    p.grabTargetId = null;
    if (target && target.hp > 0 && target.state === 'grabbed') {
      target.state = 'recover';
      target.stateTimer = 0.4;
      target.vx = pushForward ? p.facing * 90 : 0;
    }
  }

  private releaseGrabbingEnemies(px: number): void {
    for (const e of this.enemies) {
      if (e.state === 'draining') {
        e.state = 'hurt';
        e.stateTimer = 0.4;
        e.vx = (e.x >= px ? 1 : -1) * 140;
      }
    }
    if (this.boss) {
      this.boss.drainTimer = 0;
    }
  }

  private applyGravityAndClamp(ent: { z: number; vz: number }, dt: number): void {
    if (ent.z > 0 || ent.vz !== 0) {
      ent.vz -= GRAVITY * dt;
      ent.z += ent.vz * dt;
      if (ent.z <= 0) {
        ent.z = 0;
        ent.vz = 0;
      }
    }
  }

  private clampPlayerX(p: PlayerEntity): void {
    p.x = Math.max(this.cameraX + 26, Math.min(this.cameraMaxX - 26, p.x));
    p.x = Math.min(this.cameraX + LOGICAL_WIDTH - 26, p.x);
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    size: number,
    color: string,
    kind: Particle['kind']
  ): void {
    const pt = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
    pt.active = true;
    pt.x = x;
    pt.y = y;
    pt.z = z;
    pt.vx = vx;
    pt.vy = vy;
    pt.vz = vz;
    pt.life = maxLife;
    pt.maxLife = maxLife;
    pt.size = size;
    pt.color = color;
    pt.kind = kind;
  }

  private spawnDustBurst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.PI * (0.15 + Math.random() * 0.7);
      const side = i % 2 === 0 ? 1 : -1;
      this.spawnParticle(
        x + side * (4 + Math.random() * 8),
        y + (Math.random() - 0.5) * 4,
        2,
        side * (35 + Math.random() * 45),
        0,
        Math.sin(ang) * 45 + 15,
        0.24 + Math.random() * 0.14,
        4 + Math.random() * 3,
        '#CBD5E1',
        'dust'
      );
    }
  }

  private spawnHitBurst(x: number, y: number, z: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 80 + Math.random() * 140;
      this.spawnParticle(
        x,
        y,
        z,
        Math.cos(ang) * spd,
        Math.sin(ang) * 20,
        Math.sin(ang) * spd + 80,
        0.28 + Math.random() * 0.2,
        4 + Math.random() * 4,
        i % 2 === 0 ? '#FFFFFF' : color,
        i % 3 === 0 ? 'star' : 'spark'
      );
    }
  }

  private spawnBloodBurst(
    x: number,
    y: number,
    z: number,
    dir: 1 | -1,
    heavy: boolean
  ): void {
    const count = this.reduceEffects ? (heavy ? 7 : 4) : heavy ? 18 : 11;
    const reds = ['#DC2626', '#B91C1C', '#EF4444', '#7F1D1D'];
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.35) * 90;
      const vx = dir * (65 + Math.random() * (heavy ? 180 : 125)) + spread * 0.45;
      const vy = (Math.random() - 0.5) * 42;
      const vz = 75 + Math.random() * (heavy ? 195 : 135);
      const maxLife = 0.38 + Math.random() * 0.28;
      const size = (heavy ? 4.5 : 3.5) + Math.random() * 4;
      this.spawnParticle(
        x + dir * (4 + Math.random() * 10),
        y + (Math.random() - 0.5) * 8,
        z + (Math.random() - 0.5) * 18,
        vx,
        vy,
        vz,
        maxLife,
        size,
        reds[i % reds.length],
        'blood'
      );
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    z: number,
    text: string,
    color: string,
    scale: number
  ): void {
    const ft = this.floatingTexts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % FLOATING_TEXT_POOL_SIZE;
    ft.active = true;
    ft.x = x;
    ft.y = y;
    ft.z = z;
    ft.vy = 52;
    ft.text = text;
    ft.color = color;
    ft.life = 0.85;
    ft.maxLife = 0.85;
    ft.scale = scale;
  }

  private updateParticlesAndTexts(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z = Math.max(0, pt.z + pt.vz * dt);
      pt.vz -= 420 * dt;
    }
    for (const ft of this.floatingTexts) {
      if (!ft.active) continue;
      ft.life -= dt;
      if (ft.life <= 0) {
        ft.active = false;
        continue;
      }
      ft.z += ft.vy * dt;
    }
  }

  private drawCurrentScene(): void {
    const p = this.players[0];
    if (!p) return;
    const renderCamX = lerp(this.prevCameraX, this.cameraX, this.renderAlpha);
    const renderZoom = lerp(this.prevCameraZoom, this.cameraZoom, this.renderAlpha);
    const bossDangerActive = this.bossDangerTimer > 0 || this.screen === 'JEFE_INTRO';
    const lvl = LEVELS[this.levelIndex];

    let state = this.renderStateScratch;
    if (!state) {
      state = {
        screen: this.screen,
        level: lvl,
        cameraX: renderCamX,
        cameraZoom: renderZoom,
        renderAlpha: this.renderAlpha,
        shakeX: this.shakeX,
        shakeY: this.shakeY,
        timeSec: this.timeSec,
        reduceEffects: this.reduceEffects,
        debugHitboxes: this.debugHitboxes,
        player: p,
        enemies: this.enemies,
        boss: this.boss,
        breakables: this.breakables,
        pickups: this.pickups,
        projectiles: this.projectiles,
        hazards: this.hazards,
        particles: this.particles,
        floatingTexts: this.floatingTexts,
        sprites: this.sprites,
        frameCanvases: this.frameCanvases,
        worldAssets: this.worldAssets,
        specialFx: this.specialFx,
        whiteFlashTimer: this.whiteFlashTimer,
        bossDangerActive,
        bonusRoomActive: this.bonusRoomActive,
      };
      this.renderStateScratch = state;
    } else {
      state.screen = this.screen;
      state.level = lvl;
      state.cameraX = renderCamX;
      state.cameraZoom = renderZoom;
      state.renderAlpha = this.renderAlpha;
      state.shakeX = this.shakeX;
      state.shakeY = this.shakeY;
      state.timeSec = this.timeSec;
      state.reduceEffects = this.reduceEffects;
      state.debugHitboxes = this.debugHitboxes;
      state.player = p;
      state.enemies = this.enemies;
      state.boss = this.boss;
      state.breakables = this.breakables;
      state.pickups = this.pickups;
      state.projectiles = this.projectiles;
      state.hazards = this.hazards;
      state.particles = this.particles;
      state.floatingTexts = this.floatingTexts;
      state.sprites = this.sprites;
      state.frameCanvases = this.frameCanvases;
      state.worldAssets = this.worldAssets;
      state.specialFx = this.specialFx;
      state.whiteFlashTimer = this.whiteFlashTimer;
      state.bossDangerActive = bossDangerActive;
      state.bonusRoomActive = this.bonusRoomActive;
    }
    renderWorld(this.ctx, state);
  }

  private emitHud(force: boolean): void {
    const p = this.players[0] ?? this.createPlayer(this.selectedCharId);
    const lvl = LEVELS[this.levelIndex];
    const charName = CHARACTERS[p.charId].name;
    const hp = Math.round(p.hp);
    const hpFlashRed = p.hpFlashRedTimer > 0;
    const bossName = this.boss ? this.boss.name : null;
    const bossHp = this.boss ? Math.round(this.boss.hp) : 0;
    const bossMaxHp = this.boss ? this.boss.maxHp : 0;
    const bossPhase = this.boss ? this.boss.phase : 1;
    const bossDangerActive = this.bossDangerTimer > 0 || this.screen === 'JEFE_INTRO';
    const lastTargetHp = Math.round(this.lastTargetHp);
    const timerSec = Math.floor(this.levelTimer);
    const continueCountdown = Math.ceil(this.continueCountdown);
    const showGoArrow = this.goArrowTimer > 0 && !this.zoneLocked;
    const muted = this.audio.isMuted();
    const musicVolume = this.audio.getMusicVolume();
    const sfxVolume = this.audio.getSfxVolume();

    const prev = this.lastHudSnap;
    if (
      !force &&
      prev &&
      prev.screen === this.screen &&
      prev.charId === this.selectedCharId &&
      prev.charName === charName &&
      prev.hp === hp &&
      prev.maxHp === p.maxHp &&
      prev.hpFlashRed === hpFlashRed &&
      prev.lives === p.lives &&
      prev.score === p.score &&
      prev.highScore === this.highScore &&
      prev.continuesLeft === p.continuesLeft &&
      prev.continueCountdown === continueCountdown &&
      prev.levelNumber === lvl.levelNumber &&
      prev.levelTimer === timerSec &&
      prev.weapon === p.weapon &&
      prev.weaponUses === p.weaponUses &&
      prev.lastTargetName === this.lastTargetName &&
      prev.lastTargetHp === lastTargetHp &&
      prev.bossName === bossName &&
      prev.bossHp === bossHp &&
      prev.bossPhase === bossPhase &&
      prev.bossDangerActive === bossDangerActive &&
      prev.showGoArrow === showGoArrow &&
      prev.tutorialHint === this.tutorialHint &&
      prev.bannerText === this.bannerText &&
      prev.dialogueSpeaker === this.dialogueSpeaker &&
      prev.dialogueText === this.dialogueText &&
      prev.specialBannerText === this.specialBannerText &&
      prev.muted === muted &&
      Math.round(prev.musicVolume * 100) === Math.round(musicVolume * 100) &&
      Math.round(prev.sfxVolume * 100) === Math.round(sfxVolume * 100) &&
      prev.reduceEffects === this.reduceEffects &&
      prev.debugEnabled === this.debugEnabled &&
      prev.debugHitboxes === this.debugHitboxes &&
      prev.debugGodMode === this.debugGodMode &&
      prev.levelResults === this.levelResults &&
      prev.endingStep === this.endingStep &&
      prev.prologueStep === this.prologueStep &&
      prev.spriteError === this.spriteError &&
      prev.gamepadConnected === this.gamepadConnected &&
      prev.gamepadName === this.gamepadName
    ) {
      return;
    }

    const snap: HudSnapshot = {
      screen: this.screen,
      charId: this.selectedCharId,
      charName,
      hp,
      maxHp: p.maxHp,
      hpFlashRed,
      lives: p.lives,
      score: p.score,
      highScore: this.highScore,
      continuesLeft: p.continuesLeft,
      continueCountdown,
      levelNumber: lvl.levelNumber,
      levelName: lvl.name,
      levelTimer: timerSec,
      weapon: p.weapon,
      weaponUses: p.weaponUses,
      lastTargetName: this.lastTargetName,
      lastTargetHp,
      lastTargetMaxHp: this.lastTargetMaxHp,
      bossName,
      bossHp,
      bossMaxHp,
      bossPhase,
      bossDangerActive,
      showGoArrow,
      tutorialHint: this.tutorialHint,
      bannerText: this.bannerText,
      dialogueSpeaker: this.dialogueSpeaker,
      dialogueText: this.dialogueText,
      specialBannerText: this.specialBannerText,
      muted,
      musicVolume,
      sfxVolume,
      reduceEffects: this.reduceEffects,
      debugEnabled: this.debugEnabled,
      debugHitboxes: this.debugHitboxes,
      debugGodMode: this.debugGodMode,
      levelResults: this.levelResults,
      endingStep: this.endingStep,
      prologueStep: this.prologueStep,
      spriteError: this.spriteError,
      availableCharacters: this.availableCharacters,
      gamepadConnected: this.gamepadConnected,
      gamepadName: this.gamepadName,
    };
    this.lastHudSnap = snap;
    this.onHudUpdate(snap);
  }

  private clearInputs(): void {
    this.heldKeys.clear();
    this.touchState.joyX = 0;
    this.touchState.joyY = 0;
    this.touchState.attackHeld = false;
    this.touchState.jumpHeld = false;
    this.attackPressQueue = false;
    this.jumpPressQueue = false;
    this.specialPressQueue = false;
    this.attackBufferTimer = 0;
    this.jumpBufferTimer = 0;
    this.lastDirTap.dir = 0;
    this.lastDirTap.time = -1;
    this.runActiveDir = 0;
    this.lastGamepadNavDir = null;
    this.gamepadNavRepeatTimer = 0;
  }

  private queueAttack(): void {
    this.attackPressQueue = true;
    this.lastAttackTimestamp = this.timeSec;
  }

  private queueJump(): void {
    this.jumpPressQueue = true;
    this.lastJumpTimestamp = this.timeSec;
  }

  private pollGamepad(dt = 0): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const rawList = navigator.getGamepads();
    const gp = pickPrimaryGamepad(rawList);
    const s = readGamepadInto(gp, this.gamepadState);

    const nextName = s.connected ? (s.isXbox ? 'XBOX' : 'MANDO') : null;
    if (this.gamepadConnected !== s.connected || this.gamepadName !== nextName) {
      this.gamepadConnected = s.connected;
      this.gamepadName = nextName;
      this.emitHud(false);
    }

    if (!s.connected) {
      this.prevGamepadButtons.attack = false;
      this.prevGamepadButtons.jump = false;
      this.prevGamepadButtons.special = false;
      this.prevGamepadButtons.confirm = false;
      this.prevGamepadButtons.cancel = false;
      this.prevGamepadButtons.start = false;
      this.prevGamepadButtons.mute = false;
      this.prevGamepadButtons.dirX = 0;
      this.lastGamepadNavDir = null;
      this.gamepadNavRepeatTimer = 0;
      return;
    }

    const prev = this.prevGamepadButtons;
    const attackEdge = s.attackPressed && !prev.attack;
    const jumpEdge = s.jumpPressed && !prev.jump;
    const specialEdge = s.specialPressed && !prev.special;
    const confirmEdge = s.confirmPressed && !prev.confirm;
    const cancelEdge = s.cancelPressed && !prev.cancel;
    const startEdge = s.startPressed && !prev.start;
    const muteEdge = s.mutePressed && !prev.mute;

    if (attackEdge || jumpEdge || specialEdge || confirmEdge || cancelEdge || startEdge) {
      this.audio.unlock();
    }

    if (muteEdge) {
      this.toggleMute();
    }

    const isGameplayScreen = this.screen === 'JUGANDO' || this.screen === 'BONUS';
    if (isGameplayScreen) {
      // Double-tap left/right on Stick or D-Pad (cruceta) triggers dash/run identically to keyboard
      const dirX: -1 | 0 | 1 =
        s.dpadLeft !== s.dpadRight
          ? s.dpadLeft
            ? -1
            : 1
          : s.moveX > 0.55
          ? 1
          : s.moveX < -0.55
          ? -1
          : 0;
      if (dirX !== 0 && prev.dirX === 0) {
        if (this.lastDirTap.dir === dirX && this.timeSec - this.lastDirTap.time <= 0.28) {
          this.runActiveDir = dirX;
        }
        this.lastDirTap.dir = dirX;
        this.lastDirTap.time = this.timeSec;
      }
      prev.dirX = dirX;

      if (attackEdge) this.queueAttack();
      if (jumpEdge) this.queueJump();
      if (specialEdge) this.specialPressQueue = true;
      if (startEdge) this.togglePause();
    } else {
      prev.dirX = 0;

      // Discrete directional UI navigation with initial edge + comfortable hold repeat
      let navDir: 'up' | 'down' | 'left' | 'right' | null = null;
      if (Math.abs(s.moveY) >= Math.abs(s.moveX)) {
        if (s.moveY < -0.5) navDir = 'up';
        else if (s.moveY > 0.5) navDir = 'down';
      } else {
        if (s.moveX < -0.5) navDir = 'left';
        else if (s.moveX > 0.5) navDir = 'right';
      }

      let navAction: 'up' | 'down' | 'left' | 'right' | null = null;
      if (navDir === null) {
        this.lastGamepadNavDir = null;
        this.gamepadNavRepeatTimer = 0;
      } else if (navDir !== this.lastGamepadNavDir) {
        this.lastGamepadNavDir = navDir;
        this.gamepadNavRepeatTimer = 0.28;
        navAction = navDir;
      } else {
        this.gamepadNavRepeatTimer -= dt;
        if (this.gamepadNavRepeatTimer <= 0) {
          this.gamepadNavRepeatTimer = 0.16;
          navAction = navDir;
        }
      }

      if (this.screen === 'MENÚ') {
        if (navAction) this.uiNavHandler?.(navAction);
        if (confirmEdge) this.uiNavHandler?.('confirm');
        if (cancelEdge) this.uiNavHandler?.('cancel');
        if (startEdge) this.uiNavHandler?.('start');
      } else if (this.screen === 'PAUSA') {
        if (navAction) this.uiNavHandler?.(navAction);
        if (confirmEdge) this.uiNavHandler?.('confirm');
        if (cancelEdge || startEdge) this.togglePause();
      } else if (this.screen === 'HISTORIA') {
        if (confirmEdge || startEdge) this.advancePrologue();
        else if (cancelEdge) this.skipPrologueToSelect();
      } else if (this.screen === 'SELECCIÓN') {
        if (navAction === 'right') {
          const idx = this.availableCharacters.indexOf(this.selectedCharId);
          this.selectCharacter(
            this.availableCharacters[(idx + 1) % this.availableCharacters.length]
          );
        } else if (navAction === 'left') {
          const idx = this.availableCharacters.indexOf(this.selectedCharId);
          this.selectCharacter(
            this.availableCharacters[
              (idx - 1 + this.availableCharacters.length) % this.availableCharacters.length
            ]
          );
        }
        if (confirmEdge || startEdge) this.startRun(this.selectedCharId);
        else if (cancelEdge) this.returnToTitle();
      } else if (this.screen === 'NIVEL_COMPLETO') {
        if (confirmEdge || startEdge) this.nextAfterLevelResults();
      } else if (this.screen === 'CONTINUAR') {
        if (confirmEdge || startEdge) this.continueGame();
        else if (cancelEdge) this.returnToTitle();
      } else if (this.screen === 'GAME_OVER') {
        if (confirmEdge || startEdge) this.restartLevelOrGame();
        else if (cancelEdge) this.returnToTitle();
      } else if (this.screen === 'VICTORIA') {
        if (confirmEdge || startEdge) this.advanceEnding();
      }
    }

    prev.attack = s.attackPressed;
    prev.jump = s.jumpPressed;
    prev.special = s.specialPressed;
    prev.confirm = s.confirmPressed;
    prev.cancel = s.cancelPressed;
    prev.start = s.startPressed;
    prev.mute = s.mutePressed;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;

    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
    ) {
      e.preventDefault();
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    this.audio.unlock();
    if (code === 'KeyP' || code === 'Enter' || code === 'Escape') {
      if (this.screen === 'JUGANDO' || this.screen === 'PAUSA' || this.screen === 'BONUS') {
        this.togglePause();
        return;
      }
    }
    if (code === 'KeyR' && this.screen === 'PAUSA') {
      this.restartLevelOrGame();
      return;
    }

    // Story / Select / Victory keyboard navigation (MENÚ navigation handled by GameShell arcade selector)
    if (this.screen === 'HISTORIA' && (code === 'Enter' || code === 'Space' || code === 'KeyJ')) {
      this.advancePrologue();
      return;
    }
    if (this.screen === 'SELECCIÓN') {
      const idx = this.availableCharacters.indexOf(this.selectedCharId);
      if (code === 'ArrowRight' || code === 'KeyD') {
        this.selectCharacter(
          this.availableCharacters[(idx + 1) % this.availableCharacters.length]
        );
        return;
      }
      if (code === 'ArrowLeft' || code === 'KeyA') {
        this.selectCharacter(
          this.availableCharacters[
            (idx - 1 + this.availableCharacters.length) % this.availableCharacters.length
          ]
        );
        return;
      }
      if (code === 'Enter' || code === 'Space' || code === 'KeyJ') {
        this.startRun(this.selectedCharId);
        return;
      }
    }
    if (this.screen === 'VICTORIA' && (code === 'Enter' || code === 'Space' || code === 'KeyJ')) {
      this.advanceEnding();
      return;
    }

    // ?debug hotkeys F1-F5
    if (this.debugEnabled && !e.repeat) {
      if (code === 'F1') {
        e.preventDefault();
        this.debugHitboxes = !this.debugHitboxes;
        this.emitHud(true);
        return;
      }
      if (code === 'F2') {
        e.preventDefault();
        this.advanceToNextLevel();
        return;
      }
      if (code === 'F3') {
        e.preventDefault();
        this.debugGodMode = !this.debugGodMode;
        this.emitHud(true);
        return;
      }
      if (code === 'F4') {
        e.preventDefault();
        const lvl = LEVELS[this.levelIndex];
        const p = this.players[0];
        if (p && !this.bossSpawned) {
          p.x = lvl.bossTriggerX + 10;
          p.prevX = p.x;
          this.cameraX = lvl.bossArenaLeft;
          this.prevCameraX = lvl.bossArenaLeft;
          this.triggerBossEncounter(lvl, p);
          this.cameraTargetX = null;
          this.cameraMinX = lvl.bossArenaLeft;
          this.cameraMaxX = lvl.bossArenaRight;
        }
        return;
      }
      if (code === 'F5') {
        e.preventDefault();
        const idx = this.availableCharacters.indexOf(this.selectedCharId);
        const nextChar =
          this.availableCharacters[(idx + 1) % this.availableCharacters.length];
        this.selectedCharId = nextChar;
        if (this.players[0]) this.players[0].charId = nextChar;
        this.emitHud(true);
        return;
      }
      if (code === 'F6') {
        e.preventDefault();
        this.enterBonusRoom();
        return;
      }
    }

    if (!e.repeat) {
      // Double-tap direction for running
      if (code === 'ArrowRight' || code === 'KeyD') {
        if (this.lastDirTap.dir === 1 && this.timeSec - this.lastDirTap.time <= 0.28) {
          this.runActiveDir = 1;
        }
        this.lastDirTap.dir = 1;
        this.lastDirTap.time = this.timeSec;
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        if (this.lastDirTap.dir === -1 && this.timeSec - this.lastDirTap.time <= 0.28) {
          this.runActiveDir = -1;
        }
        this.lastDirTap.dir = -1;
        this.lastDirTap.time = this.timeSec;
      }

      if (code === 'KeyJ') this.queueAttack();
      if (code === 'KeyK') this.queueJump();
    }

    this.heldKeys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.clearInputs();
  };

  private handleVisibilityChange = (): void => {
    this.clearInputs();
    if (document.hidden && (this.screen === 'JUGANDO' || this.screen === 'BONUS')) {
      this.audio.pauseMusic();
      this.setScreen('PAUSA');
    }
  };

  private handleGamepadChange = (): void => {
    this.pollGamepad(0);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('gamepadconnected', this.handleGamepadChange);
    window.addEventListener('gamepaddisconnected', this.handleGamepadChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('gamepadconnected', this.handleGamepadChange);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
