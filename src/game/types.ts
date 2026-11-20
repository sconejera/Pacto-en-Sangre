export type CharacterId = 'bayron' | 'marcianeke' | 'crismj';

export type ArchetypeId = 'pesado' | 'equilibrado' | 'veloz';

export type SpriteAnimName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'shoulder'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'airKick'
  | 'jump'
  | 'hurt'
  | 'knockdown'
  | 'getup'
  | 'grab'
  | 'grabHold'
  | 'grabKnee'
  | 'grabThrow'
  | 'special'
  | 'guard'
  | 'victory';

export type AttackSlot = 'combo1' | 'combo2' | 'combo3' | 'airKick';

export interface AttackFrameData {
  startupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  hitStartX: number;
  hitEndX: number;
  hitHeight: number;
}

export interface SpriteFrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number; // Foot anchor X relative to frame x
  ay: number; // Foot anchor Y relative to frame y
  excludeRects?: { x: number; y: number; w: number; h: number }[];
}

export interface SpriteAnimDef {
  frames: number[];
  fps: number;
  loop: boolean;
  procedural?: 'leanForward' | 'flashCyan' | 'flashGold' | 'flashOrange';
}

export interface CharacterSpriteMap {
  id: CharacterId;
  sheetSrc: string;
  portraitSrc: string;
  sheetWidth: number;
  sheetHeight: number;
  targetHeightPx: number;
  portraitCrop: SpriteFrameBox;
  frames: SpriteFrameBox[];
  animations: Record<SpriteAnimName, SpriteAnimDef>;
}

export interface CharacterStats {
  id: CharacterId;
  name: string;
  archetype: ArchetypeId;
  archetypeTitle: string;
  tagline: string;
  specialName: string;
  specialDesc: string;
  specialColor: string;
  specialRadius: number;
  specialDepth: number;
  specialHits: number[];
  comboName: string;
  comboSteps: [string, string, string];
  speedX: number;
  speedY: number;
  runSpeedX: number;
  comboDamage: [number, number, number];
  comboWindow: number;
  jumpImpulse: number;
  kickExtraReach: number;
  shoulderDamage: number;
  shoulderRecovery: number;
  bars: {
    velocidad: number;
    fuerza: number;
    alcance: number;
    agilidad: number;
  };
  endingLine: string;
}

export type EnemyType =
  | 'zombie'
  | 'cachorro'
  | 'canero'
  | 'domestico'
  | 'chupetona'
  | 'fan'
  | 'manager';

export type WeaponType = 'tubo' | 'bate' | 'botella' | 'fierro';

export type ItemType =
  | 'empanada'
  | 'sandwich'
  | 'energia'
  | 'billete'
  | 'disco'
  | '1up'
  | WeaponType;

export type BreakableType =
  | 'barril'
  | 'cajon'
  | 'tacho'
  | 'carrito'
  | 'bolsa'
  | 'parlante';

export type GameScreen =
  | 'CARGA'
  | 'MENÚ'
  | 'HISTORIA'
  | 'SELECCIÓN'
  | 'JUGANDO'
  | 'PAUSA'
  | 'JEFE_INTRO'
  | 'NIVEL_COMPLETO'
  | 'BONUS'
  | 'CONTINUAR'
  | 'GAME_OVER'
  | 'VICTORIA';

export interface WaveSpawn {
  type: EnemyType;
  count: number;
  edge?: 'left' | 'right' | 'both' | 'sewer';
}

export interface ZoneDef {
  id: string;
  triggerX: number;
  arenaLeft: number;
  arenaRight: number;
  tutorialHint?: string;
  spawns: WaveSpawn[];
}

export interface BreakablePlacement {
  x: number;
  y: number;
  kind: BreakableType;
  guaranteedDrop?: ItemType;
}

export interface LevelDef {
  levelNumber: 1 | 2 | 3 | 4 | 5;
  name: string;
  subtitle: string;
  width: number;
  bpm: number;
  baseNoteMidi: number;
  theme: 'poblacion' | 'feria' | 'metro' | 'discoteca' | 'torre';
  skyTop: string;
  skyBottom: string;
  accentColor: string;
  floorTop: string;
  floorBottom: string;
  maxSimultaneousEnemies: number;
  maxAttackTokens: number;
  dripPool: EnemyType[];
  zones: ZoneDef[];
  bossTriggerX: number;
  bossArenaLeft: number;
  bossArenaRight: number;
  bossId: number;
  breakables: BreakablePlacement[];
}

export interface BossDef {
  id: number;
  levelNumber: 1 | 2 | 3 | 4 | 5;
  name: string;
  title: string;
  maxHp: number;
  baseDamage: number;
  speed: number;
  color: string;
  accent: string;
  preDialogueBoss: string;
  preDialogueHero: string;
  defeatLine: string;
  scoreBonus: number;
}

export type PlayerActionState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'airKick'
  | 'shoulder'
  | 'recover'
  | 'grabHold'
  | 'grabKnee'
  | 'grabThrow'
  | 'special'
  | 'hurt'
  | 'knockdown'
  | 'getup'
  | 'grabbedByEnemy'
  | 'ko';

export interface PlayerEntity {
  id: number;
  charId: CharacterId;
  x: number;
  y: number;
  z: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  lives: number;
  score: number;
  continuesLeft: number;
  state: PlayerActionState;
  stateTimer: number;
  animTime: number;
  invulnTimer: number;
  hpFlashRedTimer: number;
  specialCooldown: number;
  comboStep: 0 | 1 | 2 | 3;
  comboWindowTimer: number;
  attackId: number;
  attackTick: number;
  attackHitSet: Set<number>;
  weapon: WeaponType | null;
  weaponUses: number;
  grabTargetId: number | null;
  grabPushTimer: number;
  grabPummels: number;
  mashBreakCount: number;
  squashX: number;
  squashY: number;
  damageTakenOnBoss: number;
}

export type EnemyState =
  | 'entering'
  | 'approach'
  | 'circle'
  | 'telegraph'
  | 'attack'
  | 'recover'
  | 'hurt'
  | 'stunned'
  | 'knockdown'
  | 'getup'
  | 'grabbed'
  | 'thrown'
  | 'draining'
  | 'fleeing'
  | 'ko';

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  z: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  state: EnemyState;
  stateTimer: number;
  animTime: number;
  hitFlashTimer: number;
  attackId: number;
  attackCooldown: number;
  hasHitPlayerThisAttack: boolean;
  recentHitTimestamps: number[];
  isGuardActive: boolean;
  hysteric: boolean;
  stolenPoints: number;
  guaranteedDrop?: ItemType;
  squashX: number;
  squashY: number;
  fromSewer?: boolean;
  sewerRise?: number;
  jingleBuffTimer?: number;
}

export type BossState =
  | 'intro'
  | 'idle'
  | 'chase'
  | 'telegraph'
  | 'attack'
  | 'recover'
  | 'hurt'
  | 'knockdown'
  | 'getup'
  | 'phaseTransition'
  | 'ko';

export type BossAttackKind =
  | 'doublePunch'
  | 'shoulderCharge'
  | 'stompWave'
  | 'radioDash'
  | 'flyingKick'
  | 'jingleBuff'
  | 'throwPhone'
  | 'enVivoMark'
  | 'teleport'
  | 'noteFan'
  | 'soundPush'
  | 'briefcaseSwing'
  | 'contractSweep'
  | 'fireWave'
  | 'signatureGrab'
  | 'contractRain';

export interface BossEntity {
  id: number;
  defId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  state: BossState;
  stateTimer: number;
  animTime: number;
  hitFlashTimer: number;
  attackKind: BossAttackKind;
  lastAttackKind: BossAttackKind | null;
  attackId: number;
  hasHitPlayerThisAttack: boolean;
  nextKnockdownThreshold: number;
  spawned50Wave: boolean;
  spawned66Wave: boolean;
  spawned33Wave: boolean;
  spawned80Wave: boolean;
  spawnedP3_150: boolean;
  spawnedP3_50: boolean;
  teleportTimer: number;
  visibleTimer: number;
  drainTimer: number;
  squashX: number;
  squashY: number;
}

export interface BreakableEntity {
  id: number;
  kind: BreakableType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  guaranteedDrop?: ItemType;
  broken: boolean;
}

export interface PickupEntity {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  z: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
  vz: number;
  bobPhase: number;
  collected: boolean;
}

export interface ProjectileEntity {
  id: number;
  owner: 'enemy' | 'boss';
  kind: 'pan' | 'contract' | 'phone' | 'note' | 'fireWave' | 'contractBeam';
  x: number;
  y: number;
  z: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  radius: number;
  life: number;
  hitPlayer: boolean;
}

export interface HazardZone {
  id: number;
  kind: 'enVivo' | 'contractRain' | 'shockwave';
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  damage: number;
  triggered: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'dust' | 'star' | 'bill' | 'ring' | 'smoke' | 'note' | 'blood';
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface HudSnapshot {
  screen: GameScreen;
  charId: CharacterId;
  charName: string;
  hp: number;
  maxHp: number;
  hpFlashRed: boolean;
  lives: number;
  score: number;
  highScore: number;
  continuesLeft: number;
  continueCountdown: number;
  levelNumber: number;
  levelName: string;
  levelTimer: number;
  weapon: WeaponType | null;
  weaponUses: number;
  lastTargetName: string | null;
  lastTargetHp: number;
  lastTargetMaxHp: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  bossDangerActive: boolean;
  showGoArrow: boolean;
  tutorialHint: string | null;
  bannerText: string | null;
  dialogueSpeaker: string | null;
  dialogueText: string | null;
  specialBannerText: string | null;
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  reduceEffects: boolean;
  debugEnabled: boolean;
  debugHitboxes: boolean;
  debugGodMode: boolean;
  levelResults: {
    timeBonus: number;
    hpBonus: number;
    noDamageBossBonus: number;
    totalScore: number;
  } | null;
  endingStep: number;
  prologueStep: number;
  spriteError: string | null;
  availableCharacters: CharacterId[];
  gamepadConnected: boolean;
  gamepadName: string | null;
}
