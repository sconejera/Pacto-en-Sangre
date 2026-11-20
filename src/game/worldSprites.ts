import { computeTitleBgCropLayout } from './rules';
import type { BreakableType, EnemyType, ItemType, LevelDef, SpriteFrameBox, WeaponType } from './types';

export type StageTheme = LevelDef['theme'];

export interface SpriteAssetSpec {
  src: string;
  targetHeightPx: number;
  /** Optional normalized (0..1) seed coordinates inside enclosed background holes */
  extraHoleSeeds?: readonly [number, number][];
  /** True for transparent RGBA PNGs that must preserve existing alpha without white flood-fill */
  preserveAlpha?: boolean;
  /** Optional sub-rectangle crop when using a pose directly from a spritesheet without a separate portrait */
  sourceFrame?: SpriteFrameBox;
}

export interface ProcessedPixelSprite {
  canvas: HTMLCanvasElement;
  flashCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  ax: number;
  ay: number;
  targetHeightPx: number;
}

export interface GridSheetSpec {
  sheetSrc: string;
  portraitSrc?: string;
  sheetWidth: number;
  sheetHeight: number;
  targetHeightPx: number;
  frames: SpriteFrameBox[];
}

export type Boss1SheetSpec = GridSheetSpec;

export interface WorldAssets {
  enemies: Partial<Record<EnemyType, ProcessedPixelSprite>>;
  enemySheets: Partial<Record<EnemyType, ProcessedPixelSprite[]>>;
  bosses: Partial<Record<number, ProcessedPixelSprite>>;
  boss1Frames: ProcessedPixelSprite[];
  boss2Frames: ProcessedPixelSprite[];
  boss3Frames: ProcessedPixelSprite[];
  boss4Frames: ProcessedPixelSprite[];
  boss5Frames: ProcessedPixelSprite[];
  breakables: Partial<Record<BreakableType, ProcessedPixelSprite>>;
  pickups: Partial<Record<ItemType, ProcessedPixelSprite>>;
  heldWeapons: Partial<Record<WeaponType, ProcessedPixelSprite>>;
  backgrounds: Partial<Record<StageTheme, HTMLCanvasElement>>;
  backgroundsAlt: Partial<Record<StageTheme, HTMLCanvasElement>>;
  bonusCourtBg: HTMLCanvasElement | null;
  titleBg: HTMLCanvasElement | null;
  errors: string[];
}

export const TITLE_BG_PATH = '/src/assets/images/title_bg_gore_chile_1795077238009.jpg';
export const TITLE_LOGO_PATH = '/src/assets/images/logo_firmado_sangre_1795075246240.jpg';
export const BONUS_COURT_BG_PATH = '/src/assets/images/bg_bonus_cancha_chile_1795125605513.jpg';
export const CHAR_SELECT_BG_PATH = '/assets/aistudio/seleccion_personajes_2500757b.png';
export const HERO_PORTRAIT_PATHS = {
  bayron: '/assets/aistudio/BAYRON_FIRE_ac622317.png',
  marcianeke: '/assets/aistudio/MARCIANEKE_f29a32b8.png',
  crismj: '/assets/aistudio/CRIS_MJ_669b7616.png',
} as const;

export const BOSS1_SHEET_SPEC: Boss1SheetSpec = {
  sheetSrc: '/assets/aistudio/sprites_tronco_32b846e8.png',
  portraitSrc: '/assets/aistudio/tronco_54fd0bb0.png',
  sheetWidth: 2400,
  sheetHeight: 2400,
  targetHeightPx: 168,
  frames: [
    { x: 109, y: 13, w: 415, h: 580, ax: 205, ay: 580 },
    { x: 746, y: 11, w: 418, h: 578, ax: 204, ay: 578 },
    { x: 1345, y: 10, w: 404, h: 572, ax: 200, ay: 572 },
    { x: 1952, y: 27, w: 352, h: 559, ax: 203, ay: 559 },
    { x: 126, y: 750, w: 349, h: 446, ax: 177, ay: 446 },
    { x: 806, y: 609, w: 289, h: 476, ax: 143, ay: 476 },
    { x: 1409, y: 626, w: 354, h: 566, ax: 172, ay: 566 },
    { x: 1914, y: 622, w: 446, h: 572, ax: 218, ay: 572 },
    { x: 56, y: 1219, w: 544, h: 561, ax: 237, ay: 561 },
    { x: 600, y: 1202, w: 497, h: 589, ax: 337, ay: 589 },
    { x: 1321, y: 1221, w: 461, h: 579, ax: 191, ay: 579 },
    { x: 1833, y: 1208, w: 546, h: 576, ax: 258, ay: 576 },
    { x: 61, y: 1807, w: 509, h: 549, ax: 270, ay: 549 },
    { x: 632, y: 2069, w: 568, h: 272, ax: 278, ay: 272 },
    { x: 1200, y: 1800, w: 580, h: 577, ax: 344, ay: 577 },
    { x: 1870, y: 1885, w: 488, h: 461, ax: 200, ay: 461 },
  ],
};

export const BOSS2_SHEET_SPEC: GridSheetSpec = {
  sheetSrc: '/assets/aistudio/sprites_CARLITOSRUN_1cafd635.png',
  portraitSrc: '/assets/aistudio/CARLITOSRUN_f314eaac.png',
  sheetWidth: 2400,
  sheetHeight: 2400,
  targetHeightPx: 148,
  frames: [
    { x: 126, y: 4, w: 450, h: 589, ax: 224, ay: 589 },
    { x: 748, y: 0, w: 419, h: 588, ax: 208, ay: 588 },
    { x: 1319, y: 4, w: 438, h: 595, ax: 226, ay: 595 },
    { x: 1973, y: 4, w: 393, h: 589, ax: 170, ay: 589 },
    { x: 117, y: 720, w: 423, h: 480, ax: 167, ay: 480 },
    { x: 760, y: 600, w: 362, h: 525, ax: 155, ay: 525 },
    { x: 1351, y: 609, w: 449, h: 591, ax: 223, ay: 591 },
    { x: 1800, y: 607, w: 592, h: 591, ax: 364, ay: 591 },
    { x: 27, y: 1211, w: 573, h: 589, ax: 280, ay: 589 },
    { x: 600, y: 1204, w: 512, h: 596, ax: 356, ay: 596 },
    { x: 1303, y: 1213, w: 465, h: 587, ax: 209, ay: 587 },
    { x: 1881, y: 1213, w: 504, h: 587, ax: 245, ay: 587 },
    { x: 15, y: 1803, w: 567, h: 561, ax: 340, ay: 561 },
    { x: 614, y: 2061, w: 586, h: 310, ax: 325, ay: 310 },
    { x: 1200, y: 1800, w: 589, h: 579, ax: 303, ay: 579 },
    { x: 1864, y: 1895, w: 513, h: 474, ax: 229, ay: 474 },
  ],
};

export const BOSS3_SHEET_SPEC: GridSheetSpec = {
  sheetSrc: '/assets/aistudio/sprites_ivanmartinez_db38e6e6.webp',
  portraitSrc: '/assets/aistudio/ivanmartinez_2150299d.webp',
  sheetWidth: 1254,
  sheetHeight: 1254,
  targetHeightPx: 146,
  frames: [
    { x: 78, y: 9, w: 176, h: 305, ax: 75, ay: 305 },
    { x: 396, y: 0, w: 169, h: 310, ax: 83, ay: 310 },
    { x: 702, y: 4, w: 192, h: 306, ax: 111, ay: 306 },
    { x: 1027, y: 9, w: 159, h: 299, ax: 86, ay: 299 },
    { x: 72, y: 362, w: 176, h: 249, ax: 75, ay: 249 },
    { x: 383, y: 310, w: 177, h: 267, ax: 74, ay: 267 },
    { x: 681, y: 328, w: 232, h: 281, ax: 127, ay: 281 },
    { x: 1009, y: 314, w: 205, h: 299, ax: 102, ay: 299 },
    { x: 44, y: 632, w: 248, h: 290, ax: 130, ay: 290 },
    { x: 383, y: 614, w: 187, h: 316, ax: 75, ay: 316 },
    { x: 672, y: 622, w: 245, h: 308, ax: 89, ay: 308 },
    { x: 985, y: 625, w: 247, h: 308, ax: 118, ay: 308 },
    { x: 30, y: 952, w: 269, h: 291, ax: 121, ay: 291 },
    { x: 339, y: 1096, w: 287, h: 137, ax: 216, ay: 137 },
    { x: 626, y: 935, w: 290, h: 304, ax: 181, ay: 304 },
    { x: 1002, y: 981, w: 219, h: 258, ax: 154, ay: 258 },
  ],
};

export const BOSS4_SHEET_SPEC: GridSheetSpec = {
  sheetSrc: '/assets/aistudio/sprites_jc_b5fed4ae.png',
  portraitSrc: '/assets/aistudio/jc_1cbc4bd2.webp',
  sheetWidth: 1254,
  sheetHeight: 1254,
  targetHeightPx: 148,
  frames: [
    { x: 31, y: 4, w: 231, h: 310, ax: 123, ay: 310 },
    { x: 364, y: 4, w: 213, h: 310, ax: 107, ay: 310 },
    { x: 669, y: 5, w: 258, h: 309, ax: 115, ay: 309 },
    { x: 1020, y: 5, w: 189, h: 307, ax: 76, ay: 307 },
    { x: 35, y: 390, w: 215, h: 239, ax: 104, ay: 239 },
    { x: 369, y: 314, w: 211, h: 302, ax: 107, ay: 302 },
    { x: 660, y: 314, w: 264, h: 313, ax: 140, ay: 313 },
    { x: 987, y: 312, w: 250, h: 315, ax: 130, ay: 315 },
    { x: 14, y: 638, w: 301, h: 299, ax: 148, ay: 299 },
    { x: 369, y: 626, w: 191, h: 315, ax: 100, ay: 315 },
    { x: 670, y: 629, w: 247, h: 311, ax: 93, ay: 311 },
    { x: 963, y: 629, w: 277, h: 312, ax: 140, ay: 312 },
    { x: 38, y: 946, w: 235, h: 289, ax: 119, ay: 289 },
    { x: 315, y: 1117, w: 331, h: 120, ax: 187, ay: 120 },
    { x: 687, y: 940, w: 228, h: 304, ax: 109, ay: 304 },
    { x: 974, y: 999, w: 276, h: 239, ax: 141, ay: 239 },
  ],
};

export const BOSS5_SHEET_SPEC: GridSheetSpec = {
  sheetSrc: '/assets/aistudio/sprites_jefe_final_f79c6b76.png',
  portraitSrc: '/assets/aistudio/jefe_final_514a85e9.png',
  sheetWidth: 2400,
  sheetHeight: 2400,
  targetHeightPx: 170,
  frames: [
    { x: 118, y: 30, w: 372, h: 569, ax: 182, ay: 569 },
    { x: 736, y: 9, w: 382, h: 591, ax: 164, ay: 591 },
    { x: 1319, y: 13, w: 395, h: 572, ax: 207, ay: 572 },
    { x: 1957, y: 28, w: 403, h: 554, ax: 212, ay: 554 },
    { x: 103, y: 738, w: 375, h: 442, ax: 172, ay: 442 },
    { x: 762, y: 600, w: 325, h: 600, ax: 162, ay: 600 },
    { x: 1318, y: 640, w: 414, h: 549, ax: 209, ay: 549 },
    { x: 1920, y: 612, w: 422, h: 577, ax: 219, ay: 577 },
    { x: 41, y: 1251, w: 524, h: 524, ax: 251, ay: 524 },
    { x: 740, y: 1200, w: 319, h: 595, ax: 179, ay: 595 },
    { x: 1328, y: 1213, w: 437, h: 564, ax: 134, ay: 564 },
    { x: 1904, y: 1209, w: 443, h: 579, ax: 206, ay: 579 },
    { x: 63, y: 1835, w: 469, h: 542, ax: 262, ay: 542 },
    { x: 615, y: 2105, w: 585, h: 276, ax: 446, ay: 276 },
    { x: 1200, y: 1800, w: 515, h: 585, ax: 329, ay: 585 },
    { x: 1894, y: 1877, w: 466, h: 469, ax: 249, ay: 469 },
  ],
};

export const ENEMY_SHEET_SPECS: Partial<Record<EnemyType, GridSheetSpec>> = {
  zombie: {
    sheetSrc: '/assets/aistudio/sprites_tio_rene_e442da99.png',
    portraitSrc: '/assets/aistudio/tiorene_7629446b.webp',
    sheetWidth: 2400,
    sheetHeight: 2400,
    targetHeightPx: 116,
    frames: [
      { x: 92, y: 0, w: 446, h: 600, ax: 220, ay: 600 },
      { x: 741, y: 0, w: 407, h: 600, ax: 201, ay: 600 },
      { x: 1345, y: 0, w: 420, h: 600, ax: 202, ay: 600 },
      { x: 1990, y: 0, w: 314, h: 600, ax: 165, ay: 600 },
      { x: 73, y: 600, w: 407, h: 600, ax: 189, ay: 600 },
      { x: 748, y: 600, w: 352, h: 600, ax: 190, ay: 600 },
      { x: 1359, y: 600, w: 440, h: 600, ax: 205, ay: 600 },
      { x: 1908, y: 600, w: 477, h: 600, ax: 230, ay: 600 },
      { x: 10, y: 1200, w: 570, h: 580, ax: 258, ay: 580 },
      { x: 756, y: 1200, w: 379, h: 576, ax: 196, ay: 576 },
      { x: 1309, y: 1200, w: 425, h: 600, ax: 182, ay: 600 },
      { x: 1839, y: 1200, w: 555, h: 580, ax: 271, ay: 580 },
      { x: 54, y: 1809, w: 534, h: 535, ax: 300, ay: 535 },
      { x: 614, y: 2109, w: 586, h: 245, ax: 309, ay: 245 },
      { x: 1200, y: 1800, w: 565, h: 567, ax: 293, ay: 567 },
      { x: 1833, y: 1847, w: 523, h: 480, ax: 194, ay: 480 },
    ],
  },
  cachorro: {
    sheetSrc: '/assets/aistudio/sprite_papimicky_5010f76b.png',
    portraitSrc: '/assets/aistudio/papimicky_87a9ebeb.png',
    sheetWidth: 1254,
    sheetHeight: 1254,
    targetHeightPx: 108,
    frames: [
      { x: 52, y: 15, w: 198, h: 292, ax: 96, ay: 292 },
      { x: 372, y: 7, w: 191, h: 303, ax: 94, ay: 303 },
      { x: 671, y: 16, w: 217, h: 293, ax: 103, ay: 293 },
      { x: 992, y: 10, w: 213, h: 300, ax: 94, ay: 300 },
      { x: 58, y: 377, w: 183, h: 245, ax: 72, ay: 245 },
      { x: 388, y: 313, w: 157, h: 266, ax: 59, ay: 266 },
      { x: 668, y: 324, w: 216, h: 298, ax: 103, ay: 298 },
      { x: 993, y: 319, w: 235, h: 305, ax: 115, ay: 305 },
      { x: 18, y: 640, w: 278, h: 292, ax: 122, ay: 292 },
      { x: 400, y: 627, w: 148, h: 309, ax: 64, ay: 309 },
      { x: 694, y: 627, w: 226, h: 313, ax: 62, ay: 313 },
      { x: 979, y: 630, w: 257, h: 306, ax: 122, ay: 306 },
      { x: 32, y: 949, w: 281, h: 294, ax: 144, ay: 294 },
      { x: 313, y: 1078, w: 314, h: 133, ax: 203, ay: 133 },
      { x: 627, y: 940, w: 263, h: 304, ax: 163, ay: 304 },
      { x: 972, y: 1002, w: 271, h: 233, ax: 136, ay: 233 },
    ],
  },
  canero: {
    sheetSrc: '/assets/aistudio/3_Papi_Micky_Zombie_a4e1373d.png',
    sheetWidth: 2400,
    sheetHeight: 2400,
    targetHeightPx: 120,
    frames: [
      { x: 82, y: 0, w: 458, h: 597, ax: 231, ay: 597 },
      { x: 720, y: 0, w: 419, h: 595, ax: 205, ay: 595 },
      { x: 1351, y: 17, w: 385, h: 578, ax: 181, ay: 578 },
      { x: 1962, y: 19, w: 407, h: 567, ax: 185, ay: 567 },
      { x: 105, y: 722, w: 383, h: 474, ax: 163, ay: 474 },
      { x: 737, y: 599, w: 360, h: 536, ax: 170, ay: 536 },
      { x: 1368, y: 616, w: 416, h: 580, ax: 202, ay: 580 },
      { x: 1935, y: 609, w: 440, h: 587, ax: 218, ay: 587 },
      { x: 25, y: 1202, w: 547, h: 595, ax: 241, ay: 595 },
      { x: 746, y: 1194, w: 393, h: 607, ax: 202, ay: 607 },
      { x: 1344, y: 1202, w: 445, h: 598, ax: 161, ay: 598 },
      { x: 1862, y: 1202, w: 530, h: 587, ax: 263, ay: 587 },
      { x: 48, y: 1803, w: 528, h: 578, ax: 293, ay: 578 },
      { x: 597, y: 2082, w: 670, h: 282, ax: 343, ay: 282 },
      { x: 1353, y: 1800, w: 442, h: 581, ax: 216, ay: 581 },
      { x: 1855, y: 1887, w: 537, h: 479, ax: 213, ay: 479 },
    ],
  },
  domestico: {
    sheetSrc: '/assets/aistudio/4_Tronco_Renacentista_b09832bc.png',
    sheetWidth: 2400,
    sheetHeight: 2400,
    targetHeightPx: 122,
    frames: [
      { x: 105, y: 13, w: 429, h: 582, ax: 209, ay: 582 },
      { x: 733, y: 8, w: 392, h: 580, ax: 190, ay: 580 },
      { x: 1303, y: 8, w: 437, h: 593, ax: 209, ay: 593 },
      { x: 1962, y: 10, w: 413, h: 576, ax: 148, ay: 576 },
      { x: 111, y: 737, w: 377, h: 455, ax: 160, ay: 455 },
      { x: 756, y: 599, w: 360, h: 547, ax: 161, ay: 547 },
      { x: 1342, y: 628, w: 432, h: 574, ax: 211, ay: 574 },
      { x: 1941, y: 609, w: 426, h: 593, ax: 208, ay: 593 },
      { x: 27, y: 1208, w: 559, h: 581, ax: 241, ay: 581 },
      { x: 739, y: 1190, w: 365, h: 611, ax: 204, ay: 611 },
      { x: 1321, y: 1208, w: 461, h: 585, ax: 190, ay: 585 },
      { x: 1878, y: 1208, w: 507, h: 591, ax: 241, ay: 591 },
      { x: 29, y: 1814, w: 545, h: 575, ax: 316, ay: 575 },
      { x: 612, y: 2092, w: 682, h: 289, ax: 328, ay: 289 },
      { x: 1357, y: 1799, w: 423, h: 593, ax: 207, ay: 593 },
      { x: 1872, y: 1902, w: 513, h: 481, ax: 177, ay: 481 },
    ],
  },
  chupetona: {
    sheetSrc: '/assets/aistudio/5_Tronco_Oficinista_642a2db3.png',
    sheetWidth: 1254,
    sheetHeight: 1254,
    targetHeightPx: 114,
    frames: [
      { x: 50, y: 6, w: 242, h: 307, ax: 119, ay: 307 },
      { x: 372, y: 1, w: 237, h: 311, ax: 116, ay: 311, excludeRects: [{ x: 450, y: 306, w: 82, h: 8 }] },
      { x: 692, y: 7, w: 227, h: 305, ax: 106, ay: 305 },
      { x: 1026, y: 5, w: 211, h: 304, ax: 94, ay: 304 },
      { x: 55, y: 372, w: 211, h: 250, ax: 93, ay: 250 },
      { x: 386, y: 306, w: 194, h: 292, ax: 93, ay: 292, excludeRects: [{ x: 370, y: 305, w: 60, h: 8 }, { x: 535, y: 305, w: 76, h: 8 }] },
      { x: 702, y: 318, w: 240, h: 306, ax: 118, ay: 306 },
      { x: 1000, y: 313, w: 247, h: 311, ax: 121, ay: 311 },
      { x: 13, y: 628, w: 291, h: 303, ax: 140, ay: 303 },
      { x: 386, y: 625, w: 207, h: 313, ax: 110, ay: 313 },
      { x: 685, y: 628, w: 244, h: 308, ax: 104, ay: 308, excludeRects: [{ x: 845, y: 929, w: 70, h: 8 }] },
      { x: 973, y: 626, w: 277, h: 309, ax: 128, ay: 309 },
      { x: 14, y: 939, w: 287, h: 303, ax: 168, ay: 303 },
      { x: 314, y: 1101, w: 358, h: 145, ax: 187, ay: 145 },
      { x: 706, y: 930, w: 235, h: 312, ax: 114, ay: 312, excludeRects: [{ x: 730, y: 928, w: 110, h: 8 }] },
      { x: 965, y: 974, w: 275, h: 260, ax: 106, ay: 260 },
    ],
  },
  fan: {
    sheetSrc: '/assets/aistudio/6_Tio_Rene_Zombie_7be13d43.png',
    sheetWidth: 2400,
    sheetHeight: 2400,
    targetHeightPx: 116,
    frames: [
      { x: 78, y: 0, w: 477, h: 609, ax: 237, ay: 609 },
      { x: 731, y: 0, w: 412, h: 605, ax: 204, ay: 605, excludeRects: [{ x: 890, y: 596, w: 175, h: 12 }] },
      { x: 1357, y: 0, w: 413, h: 608, ax: 189, ay: 608, excludeRects: [{ x: 1525, y: 596, w: 105, h: 14 }] },
      { x: 1983, y: 0, w: 400, h: 600, ax: 173, ay: 600, excludeRects: [{ x: 2125, y: 592, w: 70, h: 10 }] },
      { x: 59, y: 674, w: 485, h: 533, ax: 196, ay: 533 },
      { x: 748, y: 597, w: 385, h: 555, ax: 177, ay: 555, excludeRects: [{ x: 730, y: 597, w: 160, h: 9 }, { x: 1060, y: 597, w: 80, h: 9 }] },
      { x: 1376, y: 597, w: 436, h: 611, ax: 212, ay: 611, excludeRects: [{ x: 1380, y: 597, w: 135, h: 12 }, { x: 1630, y: 597, w: 115, h: 10 }] },
      { x: 1916, y: 593, w: 482, h: 624, ax: 239, ay: 624, excludeRects: [{ x: 2200, y: 593, w: 110, h: 10 }, { x: 1920, y: 1200, w: 150, h: 18 }, { x: 2250, y: 1200, w: 120, h: 18 }] },
      { x: 13, y: 1206, w: 580, h: 591, ax: 286, ay: 591, excludeRects: [{ x: 70, y: 1206, w: 240, h: 6 }] },
      { x: 741, y: 1175, w: 398, h: 641, ax: 212, ay: 641 },
      { x: 1309, y: 1204, w: 488, h: 606, ax: 217, ay: 606, excludeRects: [{ x: 1630, y: 1777, w: 140, h: 34 }] },
      { x: 1883, y: 1199, w: 517, h: 612, ax: 252, ay: 612, excludeRects: [{ x: 1920, y: 1199, w: 130, h: 18 }, { x: 2260, y: 1199, w: 115, h: 15 }] },
      { x: 19, y: 1805, w: 557, h: 568, ax: 323, ay: 568 },
      { x: 588, y: 2082, w: 712, h: 293, ax: 347, ay: 293 },
      { x: 1344, y: 1780, w: 472, h: 599, ax: 234, ay: 599, excludeRects: [{ x: 1430, y: 1777, w: 195, h: 32 }] },
      { x: 1847, y: 1839, w: 551, h: 515, ax: 220, ay: 515 },
    ],
  },
  manager: {
    sheetSrc: '/assets/aistudio/7_Tronco_Manager_32b846e8.png',
    portraitSrc: '/assets/aistudio/7_troncomanager_54fd0bb0.png',
    sheetWidth: 2400,
    sheetHeight: 2400,
    targetHeightPx: 124,
    frames: [
      { x: 109, y: 13, w: 415, h: 580, ax: 205, ay: 580 },
      { x: 746, y: 11, w: 418, h: 578, ax: 204, ay: 578 },
      { x: 1345, y: 10, w: 404, h: 572, ax: 200, ay: 572 },
      { x: 1952, y: 27, w: 352, h: 559, ax: 203, ay: 559 },
      { x: 126, y: 750, w: 349, h: 446, ax: 177, ay: 446 },
      { x: 806, y: 609, w: 289, h: 476, ax: 143, ay: 476 },
      { x: 1409, y: 626, w: 354, h: 566, ax: 172, ay: 566 },
      { x: 1914, y: 622, w: 446, h: 572, ax: 217, ay: 572 },
      { x: 54, y: 1217, w: 558, h: 563, ax: 239, ay: 563 },
      { x: 771, y: 1202, w: 326, h: 589, ax: 166, ay: 589 },
      { x: 1321, y: 1221, w: 461, h: 565, ax: 184, ay: 565, excludeRects: [{ x: 1630, y: 1783, w: 90, h: 4 }] },
      { x: 1832, y: 1208, w: 547, h: 576, ax: 259, ay: 576 },
      { x: 61, y: 1807, w: 509, h: 551, ax: 270, ay: 551 },
      { x: 632, y: 2069, w: 625, h: 272, ax: 285, ay: 272 },
      { x: 1386, y: 1784, w: 394, h: 593, ax: 185, ay: 593, excludeRects: [{ x: 1470, y: 1783, w: 110, h: 4 }] },
      { x: 1870, y: 1885, w: 488, h: 461, ax: 201, ay: 461 },
    ],
  },
};

export const ENEMY_SPRITE_SPECS: Record<EnemyType, SpriteAssetSpec> = {
  zombie: {
    src: '/assets/aistudio/tiorene_7629446b.webp',
    targetHeightPx: 116,
    preserveAlpha: true,
  },
  cachorro: {
    src: '/assets/aistudio/papimicky_87a9ebeb.png',
    targetHeightPx: 108,
    preserveAlpha: true,
  },
  canero: {
    src: '/assets/aistudio/3_Papi_Micky_Zombie_a4e1373d.png',
    targetHeightPx: 120,
    preserveAlpha: true,
    sourceFrame: { x: 82, y: 0, w: 458, h: 597, ax: 231, ay: 597 },
  },
  domestico: {
    src: '/assets/aistudio/4_Tronco_Renacentista_b09832bc.png',
    targetHeightPx: 122,
    preserveAlpha: true,
    sourceFrame: { x: 105, y: 13, w: 429, h: 582, ax: 209, ay: 582 },
  },
  chupetona: {
    src: '/assets/aistudio/5_Tronco_Oficinista_642a2db3.png',
    targetHeightPx: 114,
    preserveAlpha: true,
    sourceFrame: { x: 50, y: 6, w: 242, h: 307, ax: 119, ay: 307 },
  },
  fan: {
    src: '/assets/aistudio/6_Tio_Rene_Zombie_7be13d43.png',
    targetHeightPx: 116,
    preserveAlpha: true,
    sourceFrame: { x: 78, y: 0, w: 477, h: 609, ax: 237, ay: 609 },
  },
  manager: {
    src: '/assets/aistudio/7_troncomanager_54fd0bb0.png',
    targetHeightPx: 124,
    preserveAlpha: true,
  },
};

export const BOSS_SPRITE_SPECS: Record<1 | 2 | 3 | 4 | 5, SpriteAssetSpec> = {
  1: {
    src: '/assets/aistudio/tronco_54fd0bb0.png',
    targetHeightPx: 168,
    preserveAlpha: true,
  },
  2: {
    src: '/assets/aistudio/CARLITOSRUN_f314eaac.png',
    targetHeightPx: 148,
    preserveAlpha: true,
  },
  3: {
    src: '/assets/aistudio/ivanmartinez_2150299d.webp',
    targetHeightPx: 146,
    preserveAlpha: true,
  },
  4: {
    src: '/assets/aistudio/jc_1cbc4bd2.webp',
    targetHeightPx: 148,
    preserveAlpha: true,
  },
  5: {
    src: '/assets/aistudio/jefe_final_514a85e9.png',
    targetHeightPx: 170,
    preserveAlpha: true,
  },
};

export const BREAKABLE_SPRITE_SPECS: Record<BreakableType, SpriteAssetSpec> = {
  barril: {
    src: '/src/assets/images/breakable_barril_1795065772613.jpg',
    targetHeightPx: 54,
  },
  cajon: {
    src: '/src/assets/images/breakable_cajon_1795065772037.jpg',
    targetHeightPx: 46,
  },
  tacho: {
    src: '/src/assets/images/breakable_tacho_1795065771263.jpg',
    targetHeightPx: 52,
  },
  carrito: {
    src: '/src/assets/images/breakable_carrito_1795065771569.jpg',
    targetHeightPx: 72,
    extraHoleSeeds: [[0.687, 0.389]],
  },
  bolsa: {
    src: '/src/assets/images/breakable_bolsa_1795065771710.jpg',
    targetHeightPx: 38,
  },
  parlante: {
    src: '/src/assets/images/breakable_parlante_1795065772165.jpg',
    targetHeightPx: 66,
  },
};

export const PICKUP_SPRITE_SPECS: Record<ItemType, SpriteAssetSpec> = {
  empanada: {
    src: '/src/assets/images/item_empanada_1795065772507.jpg',
    targetHeightPx: 26,
  },
  sandwich: {
    src: '/src/assets/images/item_sandwich_1795065772434.jpg',
    targetHeightPx: 28,
  },
  energia: {
    src: '/src/assets/images/item_energia_1795065771710.jpg',
    targetHeightPx: 32,
  },
  billete: {
    src: '/src/assets/images/item_billete_1795065772132.jpg',
    targetHeightPx: 26,
  },
  disco: {
    src: '/src/assets/images/item_disco_1795065771212.jpg',
    targetHeightPx: 32,
  },
  '1up': {
    src: '/src/assets/images/item_1up_1795065771734.jpg',
    targetHeightPx: 30,
    extraHoleSeeds: [[0.502, 0.351]],
  },
  tubo: {
    src: '/src/assets/images/weapon_tubo_1795065771736.jpg',
    targetHeightPx: 34,
  },
  bate: {
    src: '/src/assets/images/weapon_bate_1795065771783.jpg',
    targetHeightPx: 36,
  },
  botella: {
    src: '/src/assets/images/weapon_botella_1795065772153.jpg',
    targetHeightPx: 32,
  },
  fierro: {
    src: '/src/assets/images/weapon_fierro_sprite.png',
    targetHeightPx: 34,
    preserveAlpha: true,
  },
};

export const HELD_WEAPON_SPRITE_SPECS: Record<WeaponType, SpriteAssetSpec> = {
  tubo: {
    src: '/src/assets/images/weapon_tubo_sprite.png',
    targetHeightPx: 22,
    preserveAlpha: true,
  },
  bate: {
    src: '/src/assets/images/weapon_bate_sprite.png',
    targetHeightPx: 26,
    preserveAlpha: true,
  },
  botella: {
    src: '/src/assets/images/weapon_botella_sprite.png',
    targetHeightPx: 24,
    preserveAlpha: true,
  },
  fierro: {
    src: '/src/assets/images/weapon_fierro_sprite.png',
    targetHeightPx: 26,
    preserveAlpha: true,
  },
};

export const STAGE_BG_PATHS: Record<StageTheme, string> = {
  poblacion: '/src/assets/images/bg_n1_poblacion_chile_1795075247534.jpg',
  feria: '/src/assets/images/bg_n2_feria_chile_1795075247588.jpg',
  metro: '/src/assets/images/bg_n3_metro_chile_1795075247500.jpg',
  discoteca: '/src/assets/images/bg_n4_discoteca_chile_1795075247216.jpg',
  torre: '/src/assets/images/bg_n5_torre_chile_1795075247294.jpg',
};

export interface KeyedBoundsResult {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cropWidth: number;
  cropHeight: number;
  ax: number;
  ay: number;
}

function isNearWhiteBackground(r: number, g: number, b: number): boolean {
  const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
  const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
  return minC >= 220 && maxC - minC <= 34;
}

function isNeutralHaloPixel(r: number, g: number, b: number): boolean {
  const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
  const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
  return minC >= 188 && maxC - minC <= 28;
}

/**
 * Pure RGBA edge-connected BFS background remover + tight crop + foot centroid anchor.
 * Preserves interior white pixels (aprons, collars, eyes, teeth) inside black outlines
 * while removing outer #FFFFFF background, optional enclosed hole seeds, and 1px halo.
 */
export function floodFillRemoveBackgroundRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  extraHoleSeeds: readonly [number, number][] = []
): KeyedBoundsResult {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const off = idx * 4;
    if (isNearWhiteBackground(data[off], data[off + 1], data[off + 2])) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  for (const [nx, ny] of extraHoleSeeds) {
    const sx = Math.round(nx * (width - 1));
    const sy = Math.round(ny * (height - 1));
    tryEnqueue(sx, sy);
  }

  while (head < tail) {
    const idx = queue[head++];
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) tryEnqueue(x - 1, y);
    if (x + 1 < width) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y + 1 < height) tryEnqueue(x, y + 1);
  }

  const haloClear: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const off = idx * 4;
      if (data[off + 3] === 0) continue;
      const touchesBg =
        (x > 0 && visited[idx - 1] === 1) ||
        (x + 1 < width && visited[idx + 1] === 1) ||
        (y > 0 && visited[idx - width] === 1) ||
        (y + 1 < height && visited[idx + width] === 1);
      if (touchesBg && isNeutralHaloPixel(data[off], data[off + 1], data[off + 2])) {
        haloClear.push(idx);
      }
    }
  }
  for (const idx of haloClear) {
    data[idx * 4 + 3] = 0;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
      cropWidth: width,
      cropHeight: height,
      ax: Math.round(width / 2),
      ay: height,
    };
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  const feetThresholdY = minY + Math.floor(cropHeight * 0.74);
  let sumX = 0;
  let count = 0;
  for (let y = feetThresholdY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        sumX += x - minX;
        count++;
      }
    }
  }

  const ax = count > 0 ? Math.round(sumX / count) : Math.round(cropWidth / 2);

  return {
    minX,
    minY,
    maxX,
    maxY,
    cropWidth,
    cropHeight,
    ax,
    ay: cropHeight,
  };
}

function computeOpaqueBoundsRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 16
): KeyedBoundsResult {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
      cropWidth: width,
      cropHeight: height,
      ax: Math.round(width / 2),
      ay: height,
    };
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const feetThresholdY = minY + Math.floor(cropHeight * 0.74);
  let sumX = 0;
  let count = 0;
  for (let y = feetThresholdY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaThreshold) {
        sumX += x - minX;
        count++;
      }
    }
  }

  const ax = count > 0 ? Math.round(sumX / count) : Math.round(cropWidth / 2);

  return {
    minX,
    minY,
    maxX,
    maxY,
    cropWidth,
    cropHeight,
    ax,
    ay: cropHeight,
  };
}

function bakeFlashCanvas(canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = width;
  flashCanvas.height = height;
  const flashCtx = flashCanvas.getContext('2d');
  if (flashCtx) {
    flashCtx.imageSmoothingEnabled = false;
    flashCtx.drawImage(canvas, 0, 0);
    flashCtx.globalCompositeOperation = 'source-in';
    flashCtx.fillStyle = '#FFFFFF';
    flashCtx.fillRect(0, 0, width, height);
  }
  return flashCanvas;
}

const imagePromiseCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let pending = imagePromiseCache.get(src);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        imagePromiseCache.delete(src);
        reject(new Error(`No se pudo cargar imagen: ${src}`));
      };
      img.src = src;
    });
    imagePromiseCache.set(src, pending);
  }
  return pending;
}

function createProcessedSpriteFromImage(
  img: HTMLImageElement,
  spec: SpriteAssetSpec,
  maxWorkSize = 320
): ProcessedPixelSprite {
  const srcX = spec.sourceFrame ? spec.sourceFrame.x : 0;
  const srcY = spec.sourceFrame ? spec.sourceFrame.y : 0;
  const natW = spec.sourceFrame ? spec.sourceFrame.w : img.naturalWidth || 320;
  const natH = spec.sourceFrame ? spec.sourceFrame.h : img.naturalHeight || 320;
  const scale = Math.min(1, maxWorkSize / Math.max(natW, natH));
  const workW = Math.max(1, Math.round(natW * scale));
  const workH = Math.max(1, Math.round(natH * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = workW;
  workCanvas.height = workH;
  const workCtx = workCanvas.getContext('2d');
  if (!workCtx) {
    throw new Error('Contexto 2D no disponible para procesar sprite.');
  }
  workCtx.imageSmoothingEnabled = false;
  workCtx.drawImage(img, srcX, srcY, natW, natH, 0, 0, workW, workH);

  const imgData = workCtx.getImageData(0, 0, workW, workH);
  const bounds = spec.preserveAlpha
    ? computeOpaqueBoundsRgba(imgData.data, workW, workH)
    : floodFillRemoveBackgroundRgba(
        imgData.data,
        workW,
        workH,
        spec.extraHoleSeeds ?? []
      );
  if (!spec.preserveAlpha) {
    workCtx.putImageData(imgData, 0, 0);
  }

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = bounds.cropWidth;
  cropCanvas.height = bounds.cropHeight;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    throw new Error('Contexto 2D no disponible para recorte.');
  }
  cropCtx.imageSmoothingEnabled = false;
  cropCtx.drawImage(
    workCanvas,
    bounds.minX,
    bounds.minY,
    bounds.cropWidth,
    bounds.cropHeight,
    0,
    0,
    bounds.cropWidth,
    bounds.cropHeight
  );

  const flashCanvas = bakeFlashCanvas(cropCanvas, bounds.cropWidth, bounds.cropHeight);

  return {
    canvas: cropCanvas,
    flashCanvas,
    width: bounds.cropWidth,
    height: bounds.cropHeight,
    ax: bounds.ax,
    ay: bounds.ay,
    targetHeightPx: spec.targetHeightPx,
  };
}

function preSliceGridSheet(
  img: HTMLImageElement,
  spec: GridSheetSpec
): ProcessedPixelSprite[] {
  const baseH = spec.frames[0]?.h || 300;
  const sliceScale = Math.min(1, (spec.targetHeightPx * 2) / Math.max(1, baseH));

  return spec.frames.map((frame) => {
    const dw = Math.max(1, Math.round(frame.w * sliceScale));
    const dh = Math.max(1, Math.round(frame.h * sliceScale));
    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh);
      if (frame.excludeRects) {
        for (const r of frame.excludeRects) {
          ctx.clearRect(
            Math.floor((r.x - frame.x) * sliceScale),
            Math.floor((r.y - frame.y) * sliceScale),
            Math.ceil(r.w * sliceScale),
            Math.ceil(r.h * sliceScale)
          );
        }
      }
      // Strip near-zero export alpha noise (e.g. alpha=1 backgrounds) so cutouts and hit flashes remain razor clean
      const imgData = ctx.getImageData(0, 0, dw, dh);
      const data = imgData.data;
      let dirty = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0 && data[i] <= 12) {
          data[i] = 0;
          dirty = true;
        }
      }
      if (dirty) {
        ctx.putImageData(imgData, 0, 0);
      }
    }
    const flashCanvas = bakeFlashCanvas(c, dw, dh);
    return {
      canvas: c,
      flashCanvas,
      width: dw,
      height: dh,
      ax: Math.round(frame.ax * sliceScale),
      ay: Math.round(frame.ay * sliceScale),
      targetHeightPx: spec.targetHeightPx,
    };
  });
}

function createStageBackgroundCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = 960;
  const h = 540;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
  }
  return canvas;
}

function createTitleBackgroundCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const dstW = 960;
  const dstH = 540;
  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const srcW = img.naturalWidth || dstW;
  const srcH = img.naturalHeight || dstH;
  const work = document.createElement('canvas');
  work.width = srcW;
  work.height = srcH;
  const wctx = work.getContext('2d');
  if (!wctx) {
    ctx.drawImage(img, 0, 0, dstW, dstH);
    return canvas;
  }
  wctx.drawImage(img, 0, 0, srcW, srcH);

  let detectedStart = 0;
  try {
    const sampleData = wctx.getImageData(0, 0, Math.floor(srcW * 0.45), srcH).data;
    const scanMaxX = Math.floor(srcW * 0.45);
    const minLitRows = Math.max(4, Math.floor((srcH / 4) * 0.04));
    for (let x = 0; x < scanMaxX; x++) {
      let litRows = 0;
      for (let y = 16; y < srcH - 16; y += 4) {
        const off = (y * scanMaxX + x) * 4;
        if (sampleData[off] + sampleData[off + 1] + sampleData[off + 2] > 28) {
          litRows++;
        }
      }
      if (litRows >= minLitRows) {
        detectedStart = x + 4;
        break;
      }
    }
  } catch {
    detectedStart = Math.round(srcW * 0.31);
  }

  // Step slightly past the leftmost dark brick corner (~4.5% of image) so roofline is open
  // and mirror stays strictly within the open alley before the demon silhouette (~63% width)
  const trimmedStart = Math.min(Math.floor(srcW * 0.42), detectedStart + Math.round(srcW * 0.042));
  const layout = computeTitleBgCropLayout(srcW, srcH, trimmedStart, dstW, dstH);
  ctx.imageSmoothingEnabled = true;

  if (layout.leftFillW > 0) {
    const maxSafeMirrorEnd = Math.floor(srcW * 0.625);
    const safeLeftSrcW = Math.min(layout.leftSrcW, Math.max(120, maxSafeMirrorEnd - layout.activeStartX));
    ctx.save();
    ctx.translate(layout.leftFillW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      work,
      layout.activeStartX,
      0,
      safeLeftSrcW,
      srcH,
      0,
      0,
      layout.leftFillW,
      dstH
    );
    ctx.restore();

    const leftVignette = ctx.createLinearGradient(0, 0, layout.leftFillW * 0.65, 0);
    leftVignette.addColorStop(0, 'rgba(6, 2, 6, 0.42)');
    leftVignette.addColorStop(1, 'rgba(6, 2, 6, 0)');
    ctx.fillStyle = leftVignette;
    ctx.fillRect(0, 0, layout.leftFillW, dstH);
  }

  ctx.drawImage(
    work,
    layout.activeStartX,
    0,
    layout.activeW,
    srcH,
    layout.mainDrawX,
    0,
    layout.mainDrawW,
    dstH
  );

  return canvas;
}

function createMirroredSeamlessBgCanvas(
  baseCanvas: HTMLCanvasElement,
  theme?: StageTheme
): HTMLCanvasElement {
  const w = baseCanvas.width;
  const h = baseCanvas.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(baseCanvas, 0, 0, w, h);
  ctx.restore();

  if (theme === 'poblacion') {
    const baseCtx = baseCanvas.getContext('2d');
    if (baseCtx) {
      const imgData = baseCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // 1. Paint out mirrored duplicate moon on alt tiles using adjacent starry sky patch
      let mMinX = w;
      let mMinY = h;
      let mMaxX = -1;
      let mMaxY = -1;
      for (let y = 10; y < 140; y++) {
        for (let x = 500; x < w - 20; x++) {
          const off = (y * w + x) * 4;
          const r = data[off];
          const g = data[off + 1];
          const b = data[off + 2];
          if (r > 165 && g > 165 && b > 140) {
            if (x < mMinX) mMinX = x;
            if (x > mMaxX) mMaxX = x;
            if (y < mMinY) mMinY = y;
            if (y > mMaxY) mMaxY = y;
          }
        }
      }
      if (mMaxX >= mMinX && mMaxY >= mMinY) {
        const pad = 8;
        const sx = Math.max(0, mMinX - pad);
        const sy = Math.max(0, mMinY - pad);
        const sw = Math.min(w - sx, mMaxX - mMinX + 1 + pad * 2);
        const sh = Math.min(150 - sy, mMaxY - mMinY + 1 + pad * 2);
        const mirroredX = w - (sx + sw);
        const skySampleX = Math.max(0, sx - sw - 32);
        ctx.drawImage(baseCanvas, skySampleX, sy, sw, sh, mirroredX, sy, sw, sh);
      }

      // 2. Keep "ALMACÉN" signboard upright on mirrored tiles so text never appears backwards
      let sMinX = w;
      let sMinY = h;
      let sMaxX = -1;
      let sMaxY = -1;
      for (let y = 308; y <= 340; y++) {
        for (let x = 635; x <= 765; x++) {
          const off = (y * w + x) * 4;
          const r = data[off];
          const g = data[off + 1];
          const b = data[off + 2];
          if (r > 130 && g > 110 && b > 85) {
            if (x < sMinX) sMinX = x;
            if (x > sMaxX) sMaxX = x;
            if (y < sMinY) sMinY = y;
            if (y > sMaxY) sMaxY = y;
          }
        }
      }
      if (sMaxX >= sMinX && sMaxY >= sMinY && sMaxX - sMinX > 40) {
        const sx = Math.max(0, sMinX - 2);
        const sy = Math.max(0, sMinY - 2);
        const sw = Math.min(w - sx, sMaxX - sMinX + 5);
        const sh = Math.min(h - sy, sMaxY - sMinY + 5);
        const mirroredX = w - (sx + sw);
        ctx.drawImage(baseCanvas, sx, sy, sw, sh, mirroredX, sy, sw, sh);
      }
    }
  }

  return canvas;
}

export function processTitleLogoCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = Math.min(720, img.naturalWidth || 720);
  const h = Math.max(1, Math.round(w * ((img.naturalHeight || 405) / Math.max(1, img.naturalWidth || 720))));
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d');
  if (!ctx) return work;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Strip neutral white background and enclosed letter counter holes while preserving gold, crimson, and black outline
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    const r = data[off];
    const g = data[off + 1];
    const b = data[off + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    if (minC >= 205 && maxC - minC <= 28) {
      data[off + 3] = 0;
    }
  }

  // Clean 1px neutral light fringe bordering transparent pixels
  const fringe: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const off = idx * 4;
      if (data[off + 3] === 0) continue;
      const touchesBg =
        (x > 0 && data[(idx - 1) * 4 + 3] === 0) ||
        (x + 1 < w && data[(idx + 1) * 4 + 3] === 0) ||
        (y > 0 && data[(idx - w) * 4 + 3] === 0) ||
        (y + 1 < h && data[(idx + w) * 4 + 3] === 0);
      if (touchesBg) {
        const r = data[off];
        const g = data[off + 1];
        const b = data[off + 2];
        const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
        const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
        if (minC >= 165 && maxC - minC <= 32) {
          fringe.push(idx);
        }
      }
    }
  }
  for (const idx of fringe) {
    data[idx * 4 + 3] = 0;
  }

  ctx.putImageData(imgData, 0, 0);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return work;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (octx) {
    octx.imageSmoothingEnabled = false;
    octx.drawImage(work, minX, minY, cw, ch, 0, 0, cw, ch);
  }
  return out;
}

let cachedTitleLogoPromise: Promise<HTMLCanvasElement> | null = null;

export function loadProcessedTitleLogo(): Promise<HTMLCanvasElement> {
  if (!cachedTitleLogoPromise) {
    cachedTitleLogoPromise = loadImage(TITLE_LOGO_PATH).then((img) => processTitleLogoCanvas(img));
  }
  return cachedTitleLogoPromise;
}

export async function loadAllWorldAssets(): Promise<WorldAssets> {
  const enemies: Partial<Record<EnemyType, ProcessedPixelSprite>> = {};
  const enemySheets: Partial<Record<EnemyType, ProcessedPixelSprite[]>> = {};
  const bosses: Partial<Record<number, ProcessedPixelSprite>> = {};
  let boss1Frames: ProcessedPixelSprite[] = [];
  let boss2Frames: ProcessedPixelSprite[] = [];
  let boss3Frames: ProcessedPixelSprite[] = [];
  let boss4Frames: ProcessedPixelSprite[] = [];
  let boss5Frames: ProcessedPixelSprite[] = [];
  const breakables: Partial<Record<BreakableType, ProcessedPixelSprite>> = {};
  const pickups: Partial<Record<ItemType, ProcessedPixelSprite>> = {};
  const heldWeapons: Partial<Record<WeaponType, ProcessedPixelSprite>> = {};
  const backgrounds: Partial<Record<StageTheme, HTMLCanvasElement>> = {};
  const backgroundsAlt: Partial<Record<StageTheme, HTMLCanvasElement>> = {};
  let bonusCourtBg: HTMLCanvasElement | null = null;
  let titleBg: HTMLCanvasElement | null = null;
  const errors: string[] = [];

  const enemyEntries = Object.entries(ENEMY_SPRITE_SPECS) as [EnemyType, SpriteAssetSpec][];
  const enemySheetEntries = Object.entries(ENEMY_SHEET_SPECS) as [EnemyType, GridSheetSpec][];
  const bossEntries = Object.entries(BOSS_SPRITE_SPECS) as [string, SpriteAssetSpec][];
  const breakableEntries = Object.entries(BREAKABLE_SPRITE_SPECS) as [BreakableType, SpriteAssetSpec][];
  const pickupEntries = Object.entries(PICKUP_SPRITE_SPECS) as [ItemType, SpriteAssetSpec][];
  const heldWeaponEntries = Object.entries(HELD_WEAPON_SPRITE_SPECS) as [WeaponType, SpriteAssetSpec][];
  const bgEntries = Object.entries(STAGE_BG_PATHS) as [StageTheme, string][];

  await Promise.all([
    ...enemySheetEntries.map(async ([type, spec]) => {
      try {
        const img = await loadImage(spec.sheetSrc);
        const frames = preSliceGridSheet(img, spec);
        enemySheets[type] = frames;
        if (frames[0]) {
          enemies[type] = frames[0];
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    ...enemyEntries.map(async ([type, spec]) => {
      if (ENEMY_SHEET_SPECS[type]) return;
      try {
        const img = await loadImage(spec.src);
        enemies[type] = createProcessedSpriteFromImage(img, spec);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    ...bossEntries.map(async ([idStr, spec]) => {
      const id = Number(idStr);
      try {
        const img = await loadImage(spec.src);
        bosses[id] = createProcessedSpriteFromImage(img, spec);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    (async () => {
      try {
        const img = await loadImage(BOSS1_SHEET_SPEC.sheetSrc);
        boss1Frames = preSliceGridSheet(img, BOSS1_SHEET_SPEC);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
    (async () => {
      try {
        const img = await loadImage(BOSS2_SHEET_SPEC.sheetSrc);
        boss2Frames = preSliceGridSheet(img, BOSS2_SHEET_SPEC);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
    (async () => {
      try {
        const img = await loadImage(BOSS3_SHEET_SPEC.sheetSrc);
        boss3Frames = preSliceGridSheet(img, BOSS3_SHEET_SPEC);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
    (async () => {
      try {
        const img = await loadImage(BOSS4_SHEET_SPEC.sheetSrc);
        boss4Frames = preSliceGridSheet(img, BOSS4_SHEET_SPEC);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
    (async () => {
      try {
        const img = await loadImage(BOSS5_SHEET_SPEC.sheetSrc);
        boss5Frames = preSliceGridSheet(img, BOSS5_SHEET_SPEC);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
    ...breakableEntries.map(async ([kind, spec]) => {
      try {
        const img = await loadImage(spec.src);
        breakables[kind] = createProcessedSpriteFromImage(img, spec, 256);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    ...pickupEntries.map(async ([item, spec]) => {
      try {
        const img = await loadImage(spec.src);
        pickups[item] = createProcessedSpriteFromImage(img, spec, 224);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    ...heldWeaponEntries.map(async ([weapon, spec]) => {
      try {
        const img = await loadImage(spec.src);
        heldWeapons[weapon] = createProcessedSpriteFromImage(img, spec, 320);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    ...bgEntries.map(async ([theme, src]) => {
      try {
        const img = await loadImage(src);
        const base = createStageBackgroundCanvas(img);
        backgrounds[theme] = base;
        backgroundsAlt[theme] = createMirroredSeamlessBgCanvas(base, theme);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
    (async () => {
      try {
        const img = await loadImage(TITLE_BG_PATH);
        titleBg = createTitleBackgroundCanvas(img);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
    (async () => {
      if (!BONUS_COURT_BG_PATH) return;
      try {
        const img = await loadImage(BONUS_COURT_BG_PATH);
        bonusCourtBg = createStageBackgroundCanvas(img);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    })(),
  ]);

  return {
    enemies,
    enemySheets,
    bosses,
    boss1Frames,
    boss2Frames,
    boss3Frames,
    boss4Frames,
    boss5Frames,
    breakables,
    pickups,
    heldWeapons,
    backgrounds,
    backgroundsAlt,
    bonusCourtBg,
    titleBg,
    errors,
  };
}
