import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import {
  CHARACTERS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  STORY,
} from '../game/data';
import { NoFirmoEngine, type GamepadUiAction } from '../game/engine';
import { formatTimeMMSS } from '../game/rules';
import type { CharacterId, HudSnapshot } from '../game/types';
import {
  CHAR_SELECT_BG_PATH,
  HERO_PORTRAIT_PATHS,
  loadProcessedTitleLogo,
} from '../game/worldSprites';
import { CharacterIdlePreview, CharacterPortraitCrop } from './SpritePreview';
import { TitleCastBackdrop } from './TitleCastBackdrop';
import { TouchControls } from './TouchControls';

const INITIAL_HUD: HudSnapshot = {
  screen: 'CARGA',
  charId: 'marcianeke',
  charName: 'MARCIANEKE',
  hp: 100,
  maxHp: 100,
  hpFlashRed: false,
  lives: 3,
  score: 0,
  highScore: 0,
  continuesLeft: 3,
  continueCountdown: 10,
  levelNumber: 1,
  levelName: 'POBLACIÓN DE NOCHE',
  levelTimer: 0,
  powerUp: null,
  powerUpTimer: 0,
  lastTargetName: null,
  lastTargetHp: 0,
  lastTargetMaxHp: 0,
  bossName: null,
  bossHp: 0,
  bossMaxHp: 0,
  bossPhase: 1,
  bossDangerActive: false,
  showGoArrow: false,
  tutorialHint: null,
  bannerText: null,
  dialogueSpeaker: null,
  dialogueText: null,
  specialBannerText: null,
  muted: false,
  musicVolume: 0.65,
  sfxVolume: 0.85,
  reduceEffects: false,
  debugEnabled: false,
  debugHitboxes: false,
  debugGodMode: false,
  levelResults: null,
  endingStep: 0,
  prologueStep: 0,
  spriteError: null,
  availableCharacters: ['bayron', 'marcianeke', 'crismj'],
  gamepadConnected: false,
  gamepadName: null,
};

const CHAR_ORDER: CharacterId[] = ['bayron', 'marcianeke', 'crismj'];
const MENU_ITEMS = ['JUGAR', 'CONTROLES', 'OPCIONES', 'CRÉDITOS'] as const;
type MenuModal = 'controls' | 'options' | 'credits' | null;

const GoldPixelArrow = memo(function GoldPixelArrow({
  direction,
}: {
  direction: 'left' | 'right';
}) {
  return (
    <svg
      viewBox="0 0 18 22"
      className={`h-5 w-4 shrink-0 sm:h-6 sm:w-5 ${direction === 'left' ? 'scale-x-[-1]' : ''}`}
      aria-hidden="true"
    >
      <polygon
        points="2,2 16,11 2,20"
        fill="#FFD23F"
        stroke="#05070D"
        strokeWidth="2.5"
        strokeLinejoin="miter"
      />
      <polygon points="4,6 13,11 4,16" fill="#F59E0B" />
    </svg>
  );
});

const SpeakerIcon = memo(function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current sm:h-5 sm:w-5" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      {muted ? (
        <path d="M16.5 8.5L15 10l2.5 2.5L15 15l1.5 1.5 2.5-2.5 2.5 2.5L23 15l-2.5-2.5L23 10l-1.5-1.5-2.5 2.5-2.5-2.5z" />
      ) : (
        <>
          <path d="M15.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          <path d="M18.5 12c0 3.04-1.72 5.64-4.25 6.92v-2.13c1.38-1.01 2.25-2.79 2.25-4.79s-.87-3.78-2.25-4.79V5.08C16.78 6.36 18.5 8.96 18.5 12z" />
        </>
      )}
    </svg>
  );
});

const GamepadIcon = memo(function GamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current sm:h-5 sm:w-5" aria-hidden="true">
      <path d="M6 6h12a4 4 0 0 1 3.9 3.1l1 4.6A3 3 0 0 1 19.9 17c-1.1 0-2-.5-2.6-1.4L16 13.5H8l-1.3 2.1A3.1 3.1 0 0 1 4.1 17a3 3 0 0 1-3-3.3l1-4.6A4 4 0 0 1 6 6zm1 3v2H5v2h2v2h2v-2h2v-2H9V9H7zm9.5 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </svg>
  );
});

const PixelTitleLogo = memo(function PixelTitleLogo({
  getBeatLevel,
  onReady,
}: {
  getBeatLevel: () => number;
  onReady?: () => void;
}) {
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulseWrapRef = useRef<HTMLDivElement | null>(null);
  const glowBackRef = useRef<HTMLDivElement | null>(null);
  const beatGetterRef = useRef(getBeatLevel);
  beatGetterRef.current = getBeatLevel;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadProcessedTitleLogo()
      .then((processed) => {
        if (!active) return;
        const canvas = logoCanvasRef.current;
        if (!canvas) return;
        canvas.width = processed.width;
        canvas.height = processed.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(processed, 0, 0);
        }
        setLoaded(true);
        onReady?.();
      })
      .catch(() => {
        if (active) onReady?.();
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTransform = '';
    let lastGlowOpacity = '';
    const animate = (now: number) => {
      if (!document.hidden) {
        const wrap = pulseWrapRef.current;
        if (wrap) {
          const beat = Math.max(0, Math.min(1, beatGetterRef.current()));
          const scale = 1 + beat * 0.068;
          const bounceY = -beat * 5;
          const tilt = Math.sin(now * 0.0044) * beat * 1.4;
          const nextTransform = `translate3d(0, ${bounceY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${tilt.toFixed(2)}deg)`;
          if (nextTransform !== lastTransform) {
            lastTransform = nextTransform;
            wrap.style.transform = nextTransform;
          }
          const glowEl = glowBackRef.current;
          if (glowEl) {
            const nextOpacity = (0.38 + beat * 0.52).toFixed(2);
            if (nextOpacity !== lastGlowOpacity) {
              lastGlowOpacity = nextOpacity;
              glowEl.style.opacity = nextOpacity;
            }
          }
        }
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={pulseWrapRef}
      data-testid="title-logo-pulse"
      className="relative flex w-[56%] min-w-[200px] max-w-[360px] items-center justify-center will-change-transform sm:w-[33%] sm:max-w-[380px]"
    >
      <div
        ref={glowBackRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-full blur-xl will-change-[opacity]"
        style={{
          opacity: 0.38,
          background:
            'radial-gradient(circle, rgba(220,38,38,0.65) 0%, rgba(220,38,38,0.18) 55%, rgba(220,38,38,0) 80%)',
        }}
      />
      <canvas
        ref={logoCanvasRef}
        aria-label="FIRMADO EN SANGRE"
        className={`pixel-canvas relative block max-h-[15.5vh] w-auto max-w-full object-contain drop-shadow-[0_6px_0_#05070D] ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!loaded && (
        <h1 className="arcade-outline font-arcade relative text-center text-2xl font-black text-[#FFD23F] sm:text-4xl">
          FIRMADO EN SANGRE
        </h1>
      )}
    </div>
  );
});

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<NoFirmoEngine | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [menuIndex, setMenuIndex] = useState(0);
  const [pauseIndex, setPauseIndex] = useState(0);
  const [optionsIndex, setOptionsIndex] = useState(4);
  const [activeModal, setActiveModal] = useState<MenuModal>(null);
  const [typedLength, setTypedLength] = useState(0);
  const [gamepadNotice, setGamepadNotice] = useState<'connected' | 'disconnected' | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [titleLogoReady, setTitleLogoReady] = useState(false);
  const [titleCastReady, setTitleCastReady] = useState(false);
  const prevGamepadConnectedRef = useRef<boolean | null>(null);
  const uiNavHandlerRef = useRef<(action: GamepadUiAction) => void>(() => {});

  const markTitleLogoReady = useCallback(() => setTitleLogoReady(true), []);
  const markTitleCastReady = useCallback(() => setTitleCastReady(true), []);

  useEffect(() => {
    let active = true;
    const fontSet = document.fonts;
    void Promise.all([
      fontSet.load('400 16px "Silkscreen"'),
      fontSet.load('700 16px "Silkscreen"'),
      fontSet.load('400 16px "Press Start 2P"'),
      fontSet.load('400 16px "Bungee"'),
    ]).finally(() => {
      if (active) setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prev = prevGamepadConnectedRef.current;
    prevGamepadConnectedRef.current = hud.gamepadConnected;
    if (prev === null) {
      if (!hud.gamepadConnected) return;
      setGamepadNotice('connected');
    } else if (prev !== hud.gamepadConnected) {
      setGamepadNotice(hud.gamepadConnected ? 'connected' : 'disconnected');
    } else {
      return;
    }
    const timer = window.setTimeout(() => {
      setGamepadNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [hud.gamepadConnected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new NoFirmoEngine(canvas, (snap) => {
      setHud(snap);
    });
    engine.setUiNavHandler((action) => uiNavHandlerRef.current(action));
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.setUiNavHandler(null);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Reset modal when leaving title screen and pause index when leaving pause screen
  useEffect(() => {
    if (hud.screen !== 'MENÚ') {
      setActiveModal(null);
    }
    if (hud.screen !== 'PAUSA') {
      setPauseIndex(0);
    }
  }, [hud.screen]);

  useEffect(() => {
    if (activeModal === 'options') {
      setOptionsIndex(4);
    }
  }, [activeModal]);

  uiNavHandlerRef.current = (action: GamepadUiAction) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (hud.screen === 'MENÚ') {
      if (activeModal === 'options') {
        if (action === 'up') {
          engine.playUiMoveSound();
          setOptionsIndex((prev) => (prev + 4) % 5);
        } else if (action === 'down') {
          engine.playUiMoveSound();
          setOptionsIndex((prev) => (prev + 1) % 5);
        } else if (action === 'left' || action === 'right') {
          const delta = action === 'right' ? 0.05 : -0.05;
          if (optionsIndex === 0) engine.setMusicVolume(hud.musicVolume + delta);
          else if (optionsIndex === 1) engine.setSfxVolume(hud.sfxVolume + delta);
        } else if (action === 'confirm') {
          if (optionsIndex === 2) {
            engine.playUiConfirmSound();
            engine.toggleMute();
          } else if (optionsIndex === 3) {
            engine.playUiConfirmSound();
            engine.toggleReduceEffects();
          } else if (optionsIndex === 4) {
            engine.playUiConfirmSound();
            setActiveModal(null);
          }
        } else if (action === 'cancel' || action === 'start') {
          engine.playUiConfirmSound();
          setActiveModal(null);
        }
        return;
      }

      if (activeModal !== null) {
        if (action === 'confirm' || action === 'cancel' || action === 'start') {
          engine.playUiConfirmSound();
          setActiveModal(null);
        }
        return;
      }

      if (action === 'up') {
        engine.playUiMoveSound();
        setMenuIndex((prev) => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (action === 'down') {
        engine.playUiMoveSound();
        setMenuIndex((prev) => (prev + 1) % MENU_ITEMS.length);
      } else if (action === 'confirm' || action === 'start') {
        const choice = MENU_ITEMS[menuIndex];
        if (choice === 'JUGAR') engine.goToPrologue();
        else if (choice === 'CONTROLES') {
          engine.playUiConfirmSound();
          setActiveModal('controls');
        } else if (choice === 'OPCIONES') {
          engine.playUiConfirmSound();
          setActiveModal('options');
        } else if (choice === 'CRÉDITOS') {
          engine.playUiConfirmSound();
          setActiveModal('credits');
        }
      }
      return;
    }

    if (hud.screen === 'PAUSA') {
      if (action === 'up') {
        engine.playUiMoveSound();
        setPauseIndex((prev) => (prev + 4) % 5);
      } else if (action === 'down') {
        engine.playUiMoveSound();
        setPauseIndex((prev) => (prev + 1) % 5);
      } else if (action === 'confirm') {
        if (pauseIndex === 0) engine.togglePause();
        else if (pauseIndex === 1) engine.restartLevelOrGame();
        else if (pauseIndex === 2) engine.toggleMute();
        else if (pauseIndex === 3) engine.toggleReduceEffects();
        else if (pauseIndex === 4) engine.returnToTitle();
      }
    }
  };

  // Keyboard navigation on MENÚ matching arcade selector (Up/Down/Enter/Escape)
  useEffect(() => {
    if (hud.screen !== 'MENÚ') return;

    const onMenuKey = (e: KeyboardEvent) => {
      if (activeModal !== null) {
        if (
          e.code === 'Escape' ||
          ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') &&
            (document.activeElement as HTMLElement | null)?.tagName !== 'INPUT')
        ) {
          e.preventDefault();
          e.stopPropagation();
          engineRef.current?.playUiConfirmSound();
          setActiveModal(null);
        }
        return;
      }

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        e.stopPropagation();
        engineRef.current?.playUiMoveSound();
        setMenuIndex((prev) => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        engineRef.current?.playUiMoveSound();
        setMenuIndex((prev) => (prev + 1) % MENU_ITEMS.length);
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        e.stopPropagation();
        const choice = MENU_ITEMS[menuIndex];
        if (choice === 'JUGAR') engineRef.current?.goToPrologue();
        else if (choice === 'CONTROLES') {
          engineRef.current?.playUiConfirmSound();
          setActiveModal('controls');
        } else if (choice === 'OPCIONES') {
          engineRef.current?.playUiConfirmSound();
          setActiveModal('options');
        } else if (choice === 'CRÉDITOS') {
          engineRef.current?.playUiConfirmSound();
          setActiveModal('credits');
        }
      }
    };

    window.addEventListener('keydown', onMenuKey, true);
    return () => window.removeEventListener('keydown', onMenuKey, true);
  }, [hud.screen, menuIndex, activeModal]);

  // Typewriter effect for Prologue screens
  useEffect(() => {
    if (hud.screen !== 'HISTORIA') return;
    const fullText = STORY.prologue[hud.prologueStep] ?? '';
    setTypedLength(0);
    const id = window.setInterval(() => {
      setTypedLength((prev) => {
        if (prev >= fullText.length) {
          clearInterval(id);
          return prev;
        }
        return prev + 2;
      });
    }, 22);
    return () => clearInterval(id);
  }, [hud.screen, hud.prologueStep]);

  const handleMenuHover = (idx: number) => {
    if (menuIndex !== idx) {
      engineRef.current?.playUiMoveSound();
      setMenuIndex(idx);
    }
  };

  const handleMenuActivate = (idx: number) => {
    setMenuIndex(idx);
    const choice = MENU_ITEMS[idx];
    if (choice === 'JUGAR') engineRef.current?.goToPrologue();
    else if (choice === 'CONTROLES') {
      engineRef.current?.playUiConfirmSound();
      setActiveModal('controls');
    } else if (choice === 'OPCIONES') {
      engineRef.current?.playUiConfirmSound();
      setActiveModal('options');
    } else if (choice === 'CRÉDITOS') {
      engineRef.current?.playUiConfirmSound();
      setActiveModal('credits');
    }
  };

  const handleSelectSwipeStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    swipeStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleSelectSwipeEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? swipeStartX.current;
    const delta = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) > 40) {
      const idx = hud.availableCharacters.indexOf(hud.charId);
      if (idx >= 0) {
        const nextIdx =
          delta < 0
            ? (idx + 1) % hud.availableCharacters.length
            : (idx - 1 + hud.availableCharacters.length) % hud.availableCharacters.length;
        engineRef.current?.selectCharacter(hud.availableCharacters[nextIdx]);
      }
    }
  };

  const getBeatLevel = useCallback(() => engineRef.current?.getMusicBeatLevel() ?? 0, []);

  const handleTouchJoystick = useCallback((x: number, y: number) => {
    engineRef.current?.setTouchJoystick(x, y);
  }, []);

  const handleTouchButton = useCallback((btn: 'A' | 'B' | 'ESP', pressed: boolean) => {
    engineRef.current?.triggerTouchButton(btn, pressed);
  }, []);

  const isPlayingHud =
    hud.screen === 'JUGANDO' || hud.screen === 'JEFE_INTRO' || hud.screen === 'BONUS';

  const currentPrologueText = STORY.prologue[hud.prologueStep] ?? '';
  const shownPrologueText = currentPrologueText.slice(0, typedLength);

  const isMenuScreen = hud.screen === 'MENÚ';
  const gamepadLabel = hud.gamepadName === 'XBOX' ? 'MANDO XBOX' : 'MANDO';

  return (
    <main className="font-arcade fixed inset-0 flex items-center justify-center overflow-hidden bg-[#0B0F1E]">
      {/* Full-viewport stage on MENÚ; responsive 16:9 letterbox stage during gameplay */}
      <div
        className={
          isMenuScreen
            ? 'relative h-full w-full overflow-hidden bg-[#0B0F1E]'
            : 'relative aspect-video max-h-full w-full max-w-[177.78vh] overflow-hidden border border-[#3A3F4B]/50 bg-[#0B0F1E]'
        }
      >
        {/* Isolated Canvas Mount */}
        <div className="absolute inset-0">
          <canvas
            ref={canvasRef}
            width={LOGICAL_WIDTH}
            height={LOGICAL_HEIGHT}
            data-testid="game-canvas"
            className={`pixel-canvas block h-full w-full ${isMenuScreen ? 'object-cover' : ''}`}
          />
        </div>

        {/* Floating Xbox/Gamepad connection notice on gameplay/intermission screens */}
        {gamepadNotice && !isMenuScreen && (
          <div
            data-testid="gamepad-toast-box"
            role="status"
            aria-live="polite"
            className={`arcade-panel pointer-events-none absolute top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 ${
              gamepadNotice === 'connected' ? '!border-[#7CFF4F]' : '!border-[#EF4444]'
            }`}
          >
            <span className={gamepadNotice === 'connected' ? 'text-[#7CFF4F]' : 'text-[#EF4444]'}>
              <GamepadIcon />
            </span>
            <div className="leading-tight">
              <div
                className={`arcade-outline-sm text-[10px] font-black whitespace-nowrap sm:text-xs ${
                  gamepadNotice === 'connected' ? 'text-[#7CFF4F]' : 'text-[#FCA5A5]'
                }`}
              >
                {gamepadNotice === 'connected'
                  ? `${gamepadLabel} CONECTADO`
                  : 'MANDO DESCONECTADO'}
              </div>
              {gamepadNotice === 'connected' && (
                <div className="text-[8px] font-bold whitespace-nowrap text-[#19E3FF] sm:text-[9px]">
                  BOTONES AUTO-ASIGNADOS
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sprite Load Error Screen */}
        {hud.spriteError && hud.availableCharacters.length === 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0B0F1E]/95 p-6 text-center">
            <div className="arcade-panel max-w-lg p-6">
              <h2 className="arcade-outline mb-2 text-xl font-black text-[#FFD23F]">
                ERROR AL CARGAR SPRITES
              </h2>
              <p className="text-sm text-white/90">{hud.spriteError}</p>
            </div>
          </div>
        )}

        {(hud.screen === 'CARGA' || hud.screen === 'MENÚ') &&
          (!fontsReady || !titleLogoReady || !titleCastReady) && (
          <div
            className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0B0F1E]"
            role="status"
            aria-live="polite"
          >
            <div className="arcade-panel px-6 py-5 text-center">
              <div className="arcade-outline text-lg font-black text-[#FFD23F]">CARGANDO...</div>
            </div>
          </div>
        )}

        {/* TITLE SCREEN (MENÚ) — 3 foreground heroes, 4 shadowed stage bosses, giant Stage 5 Overlord behind, top logo & lower arcade menu dock */}
        {hud.screen === 'MENÚ' && (
          <section className="absolute inset-0 z-20 flex flex-col items-center justify-between">
            <TitleCastBackdrop
              reduceEffects={hud.reduceEffects}
              getBeatLevel={getBeatLevel}
              onReady={markTitleCastReady}
            />

            {/* Desktop/tablet top-left Xbox/Gamepad Connected Box */}
            {hud.gamepadConnected && (
              <div
                data-testid="gamepad-connected-box"
                role="status"
                aria-live="polite"
                className="arcade-panel pointer-events-none hidden items-center gap-2 !border-[#7CFF4F] px-3.5 py-2 sm:absolute sm:top-4 sm:left-5 sm:z-30 sm:flex"
              >
                <span className="text-[#7CFF4F]">
                  <GamepadIcon />
                </span>
                <div className="leading-tight">
                  <div className="arcade-outline-sm text-xs font-black whitespace-nowrap text-[#7CFF4F]">
                    {gamepadLabel} CONECTADO
                  </div>
                  <div className="text-[9px] font-bold whitespace-nowrap text-[#19E3FF]">
                    BOTONES AUTO-ASIGNADOS
                  </div>
                </div>
              </div>
            )}

            {/* Top-right Sound Toggle + Record badge */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 sm:top-4 sm:right-5">
              <button
                type="button"
                tabIndex={-1}
                data-testid="sound-toggle-btn"
                aria-pressed={hud.muted}
                onClick={(e) => {
                  e.currentTarget.blur();
                  engineRef.current?.toggleMute();
                }}
                className={`arcade-panel flex h-9 w-9 cursor-pointer items-center justify-center sm:h-11 sm:w-11 ${
                  hud.muted
                    ? '!border-[#EF4444] !bg-[#450A0A]/90 text-[#FCA5A5] hover:text-white'
                    : 'text-[#19E3FF] hover:text-[#FFD23F]'
                }`}
                aria-label={hud.muted ? 'Encender sonido' : 'Apagar sonido'}
                title={hud.muted ? 'Encender sonido (M)' : 'Apagar sonido (M)'}
              >
                <SpeakerIcon muted={hud.muted} />
              </button>
              <div className="arcade-panel px-2.5 py-1 text-right sm:px-4 sm:py-2">
                <div className="text-[8px] font-bold text-[#19E3FF] sm:text-[10px]">RÉCORD</div>
                <div className="arcade-outline-sm tabular-nums text-xs font-black text-[#FFD23F] sm:text-lg">
                  {hud.highScore}
                </div>
              </div>
            </div>

            {/* Top Header: Beat-pulsing Logo + Tagline framed above Boss 5's face (pointer-events-none so top-right mute stays clickable) */}
            <div className="pointer-events-none relative z-20 flex w-full shrink-0 flex-col items-center px-3 pt-2 sm:px-6 sm:pt-3">
              <PixelTitleLogo getBeatLevel={getBeatLevel} onReady={markTitleLogoReady} />
              <p className="arcade-outline-sm mt-1 text-center text-[11px] font-bold tracking-[0.18em] text-[#19E3FF] sm:mt-1.5 sm:text-sm">
                Beat 'Em Up 2D Urbano Chileno
              </p>
            </div>

            {/* Bottom Menu Dock overlapping only lower street/flames so all heroes & bosses remain visible */}
            <div className="relative z-30 mt-auto mb-1.5 flex w-full flex-col items-center px-3 sm:mb-2 sm:px-6">
              {/* Mobile-only Xbox/Gamepad Connected Box placed neatly above the menu dock */}
              {hud.gamepadConnected && (
                <div
                  role="status"
                  aria-live="polite"
                  className="arcade-panel pointer-events-none mb-1.5 flex items-center gap-2 !border-[#7CFF4F] px-3 py-1 sm:hidden"
                >
                  <span className="text-[#7CFF4F]">
                    <GamepadIcon />
                  </span>
                  <div className="arcade-outline-sm text-[9px] font-black whitespace-nowrap text-[#7CFF4F]">
                    {gamepadLabel} CONECTADO · AUTO-ASIGNADO
                  </div>
                </div>
              )}
              <div className="flex w-full max-w-[350px] flex-col items-center bg-[#05070D]/82 px-3 py-1.5 ring-1 ring-[#F59E0B]/45 backdrop-blur-[2px] sm:max-w-[430px] sm:px-5 sm:py-2">
                <nav
                  aria-label="Menú Principal"
                  className="flex w-full max-w-[230px] flex-col items-center gap-0.5 sm:max-w-[285px] sm:gap-1"
                >
                  {MENU_ITEMS.map((label, idx) => {
                    const isSelected = menuIndex === idx;
                    return (
                      <div key={label} className="flex w-full items-center justify-center gap-1.5">
                        {isSelected ? (
                          <>
                            <GoldPixelArrow direction="right" />
                            <button
                              type="button"
                              data-start={label === 'JUGAR' ? 'true' : undefined}
                              onMouseEnter={() => handleMenuHover(idx)}
                              onClick={() => handleMenuActivate(idx)}
                              className="arcade-selected-bar flex-1 cursor-pointer px-3 py-0.5 text-center text-xs font-black tracking-widest transition-transform hover:scale-[1.03] active:scale-95 sm:px-4 sm:py-1 sm:text-sm"
                            >
                              {label}
                            </button>
                            <GoldPixelArrow direction="left" />
                          </>
                        ) : (
                          <button
                            type="button"
                            data-start={label === 'JUGAR' ? 'true' : undefined}
                            onMouseEnter={() => handleMenuHover(idx)}
                            onClick={() => handleMenuActivate(idx)}
                            className="arcade-menu-link cursor-pointer px-3 py-0.5 text-center text-xs font-black tracking-widest sm:px-4 sm:py-0.5 sm:text-sm"
                          >
                            {label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </nav>

                <div className="arcade-outline-sm mt-1 truncate text-center text-[8px] leading-tight font-bold tracking-wider whitespace-nowrap text-white/90 sm:mt-1.5 sm:text-[9px]">
                  ▲▼ MENÚ · ENTER ELEGIR · WASD · J GOLPE · K SALTO · J+K ESP
                </div>
                {hud.gamepadConnected && (
                  <div
                    data-testid="gamepad-status-badge"
                    className="arcade-outline-sm mt-0.5 text-center text-[8px] leading-tight font-bold tracking-wider text-[#7CFF4F] sm:text-[9px]"
                  >
                    MANDO {hud.gamepadName} LISTO · STICK/CRUCETA MOVER · A/X GOLPE · B SALTO · Y/RB ESP
                  </div>
                )}
              </div>
            </div>

            {/* White Footer Marquee Banner with Borderless Black Text */}
            <footer className="relative z-30 w-full shrink-0">
              <div className="arcade-footer-ribbon overflow-hidden py-2 sm:py-2.5">
                <div className="arcade-marquee-track">
                  {[0, 1].map((dup) => (
                    <div key={dup} className="flex shrink-0 items-center">
                      {Array.from({ length: 4 }).map((_, rep) => (
                        <span
                          key={`${dup}-${rep}`}
                          className="arcade-ribbon-text flex items-center gap-5 px-6 text-sm tracking-[0.14em] whitespace-nowrap text-black sm:gap-7 sm:px-9 sm:text-lg"
                        >
                          <span aria-hidden="true">★</span>
                          <span>IDEADO Y DESARROLLADO POR SCONE L@BS</span>
                          <span aria-hidden="true">★</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </footer>
          </section>
        )}

        {/* CONTROLS MODAL */}
        {activeModal === 'controls' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05070D]/88 p-4">
            <div className="arcade-panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6">
              <h2 className="arcade-outline mb-3 text-center text-lg font-black text-[#FFD23F] sm:text-xl">
                CONTROLES DE CALLE
              </h2>
              <ul className="space-y-1.5 text-xs text-white/95 sm:text-sm">
                <li>
                  <strong className="text-[#19E3FF]">FLECHAS / WASD:</strong> Moverte (doble toque = correr)
                </li>
                <li>
                  <strong className="text-[#E83BFF]">J (A):</strong> Golpe / combo: J,J,J rápido · J,J,pausa,J pesado derriba · J,J,K lanza
                </li>
                <li>
                  <strong className="text-[#FFD23F]">K (B):</strong> Salto (+ J en el aire = ataque descendente que derriba)
                </li>
                <li>
                  <strong className="text-[#7CFF4F]">J + K (o ESP):</strong> Especial (-8 HP si golpea)
                </li>
                <li>
                  <strong className="text-[#19E3FF]">CAMINAR PEGADO:</strong> Agarrar (J rodillazo, K suplex)
                </li>
                <li>
                  <strong className="text-[#FFD23F]">P / ENTER / M:</strong> Pausa / Silenciar audio
                </li>
              </ul>

              <div className="mt-4 border-t border-[#F59E0B]/40 pt-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap text-xs font-black text-[#7CFF4F] sm:text-sm">
                    MANDO XBOX (AUTO)
                  </span>
                  <span
                    className={`shrink-0 whitespace-nowrap text-[10px] font-black ${
                      hud.gamepadConnected ? 'text-[#7CFF4F]' : 'text-[#19E3FF]/80'
                    }`}
                  >
                    {hud.gamepadConnected ? `CONECTADO: ${hud.gamepadName}` : 'ESPERANDO MANDO'}
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-white/90 sm:text-xs">
                  <li>
                    <strong className="text-[#19E3FF]">STICK IZQ. / CRUCETA:</strong> Moverte (doble toque = correr) · Navegar menús
                  </li>
                  <li>
                    <strong className="text-[#7CFF4F]">A / X:</strong> Golpe / Combo / Recoger · Confirmar
                  </li>
                  <li>
                    <strong className="text-[#EF4444]">B:</strong> Salto (+ A/X aire = patada) · Volver / Cerrar
                  </li>
                  <li>
                    <strong className="text-[#FFD23F]">Y / LB / RB (o A+B):</strong> Especial (-8 HP si golpea)
                  </li>
                  <li>
                    <strong className="text-[#E83BFF]">LT / RT + MOVER:</strong> Correr rápido
                  </li>
                  <li>
                    <strong className="text-[#FFD23F]">MENU / VIEW:</strong> Pausa · Silenciar audio
                  </li>
                </ul>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2">
                <GoldPixelArrow direction="right" />
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.playUiConfirmSound();
                    setActiveModal(null);
                  }}
                  className="arcade-selected-bar cursor-pointer px-8 py-2 text-sm font-black"
                >
                  ENTENDIDO
                </button>
                <GoldPixelArrow direction="left" />
              </div>
            </div>
          </div>
        )}

        {/* OPTIONS MODAL */}
        {activeModal === 'options' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05070D]/88 p-4">
            <div className="arcade-panel w-full max-w-sm p-5 text-center sm:p-6">
              <h2 className="arcade-outline mb-4 text-lg font-black text-[#FFD23F] sm:text-xl">
                OPCIONES
              </h2>
              <div className="flex flex-col gap-3.5 text-left">
                <div
                  className={`flex flex-col gap-1 px-1 py-0.5 ${
                    optionsIndex === 0 ? 'ring-1 ring-[#FFD23F]/75' : ''
                  }`}
                >
                  <label
                    htmlFor="music-volume-slider"
                    className="flex items-center justify-between text-xs font-black text-[#19E3FF] sm:text-sm"
                  >
                    <span>VOLUMEN MÚSICA</span>
                    <span className="tabular-nums text-[#FFD23F]">
                      {Math.round(hud.musicVolume * 100)}%
                    </span>
                  </label>
                  <input
                    id="music-volume-slider"
                    data-testid="music-volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(hud.musicVolume * 100)}
                    onChange={(e) =>
                      engineRef.current?.setMusicVolume(Number(e.currentTarget.value) / 100)
                    }
                    className="arcade-slider w-full"
                  />
                </div>

                <div
                  className={`flex flex-col gap-1 px-1 py-0.5 ${
                    optionsIndex === 1 ? 'ring-1 ring-[#FFD23F]/75' : ''
                  }`}
                >
                  <label
                    htmlFor="sfx-volume-slider"
                    className="flex items-center justify-between text-xs font-black text-[#19E3FF] sm:text-sm"
                  >
                    <span>VOLUMEN EFECTOS</span>
                    <span className="tabular-nums text-[#FFD23F]">
                      {Math.round(hud.sfxVolume * 100)}%
                    </span>
                  </label>
                  <input
                    id="sfx-volume-slider"
                    data-testid="sfx-volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(hud.sfxVolume * 100)}
                    onChange={(e) =>
                      engineRef.current?.setSfxVolume(Number(e.currentTarget.value) / 100)
                    }
                    className="arcade-slider w-full"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.playUiConfirmSound();
                    engineRef.current?.toggleMute();
                  }}
                  className={`arcade-menu-link cursor-pointer py-1 text-center text-sm font-black sm:text-base ${
                    optionsIndex === 2 ? 'text-[#FFD23F] ring-1 ring-[#FFD23F]/75' : ''
                  }`}
                >
                  SONIDO: {hud.muted ? 'OFF' : 'ON'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.playUiConfirmSound();
                    engineRef.current?.toggleReduceEffects();
                  }}
                  className={`arcade-menu-link cursor-pointer py-1 text-center text-sm font-black sm:text-base ${
                    optionsIndex === 3 ? 'text-[#FFD23F] ring-1 ring-[#FFD23F]/75' : ''
                  }`}
                >
                  REDUCIR EFECTOS: {hud.reduceEffects ? 'SÍ' : 'NO'}
                </button>
              </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                {optionsIndex === 4 && <GoldPixelArrow direction="right" />}
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.playUiConfirmSound();
                    setActiveModal(null);
                  }}
                  className="arcade-selected-bar cursor-pointer px-8 py-2 text-sm font-black"
                >
                  CERRAR
                </button>
                {optionsIndex === 4 && <GoldPixelArrow direction="left" />}
              </div>
            </div>
          </div>
        )}

        {/* CREDITS MODAL */}
        {activeModal === 'credits' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05070D]/88 p-4">
            <div className="arcade-panel w-full max-w-md p-5 text-center sm:p-6">
              <h2 className="arcade-outline mb-3 text-lg font-black text-[#FFD23F] sm:text-xl">
                CRÉDITOS
              </h2>
              <p className="text-xs leading-relaxed text-white/95 sm:text-sm">
                <strong className="text-[#E83BFF]">FIRMADO EN SANGRE</strong>
                <br />
                Beat &apos;Em Up 2D Urbano Chileno · Santiago de Chile.
              </p>
              <div className="mt-3 space-y-1 text-[11px] text-[#19E3FF] sm:text-xs">
                <div>PROTAGONISTAS: BAYRON FIRE · MARCIANEKE · CRIS MJ</div>
                <div>ESCENARIOS: POBLACIÓN · FERIA LIBRE · METRO · DISCO · TORRE</div>
                <div className="text-[#EF4444]">VILLANO PRINCIPAL: DEVIL GONZALEZ Y SU EJÉRCITO DE ANDROIDES</div>
                <div>JEFES DE RUTA: EL TRONCO · CARLITOS RUN · IVAN MARTINEZ · EL JC QUE LE DICEN</div>
                <div>HORDAS: PAPIS MICKYS · TÍOS RENES · TRONCOS BIZARROS</div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <GoldPixelArrow direction="right" />
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.playUiConfirmSound();
                    setActiveModal(null);
                  }}
                  className="arcade-selected-bar cursor-pointer px-8 py-2 text-sm font-black"
                >
                  VOLVER
                </button>
                <GoldPixelArrow direction="left" />
              </div>
            </div>
          </div>
        )}

        {/* PROLOGUE (HISTORIA) */}
        {hud.screen === 'HISTORIA' && (
          <section className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070D]/88 p-4 sm:p-6">
            <div className="arcade-panel w-full max-w-2xl p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between text-xs font-bold text-[#19E3FF]">
                <span>PRÓLOGO · {hud.prologueStep + 1} / {STORY.prologue.length}</span>
                <button
                  type="button"
                  onClick={() => engineRef.current?.skipPrologueToSelect()}
                  className="arcade-menu-link cursor-pointer text-xs font-black"
                >
                  SALTAR PRÓLOGO
                </button>
              </div>
              <p className="min-h-[112px] text-sm leading-relaxed text-white sm:text-base">
                {shownPrologueText}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <GoldPixelArrow direction="right" />
                <button
                  type="button"
                  onClick={() => engineRef.current?.advancePrologue()}
                  className="arcade-selected-bar cursor-pointer px-6 py-2 text-sm font-black"
                >
                  {hud.prologueStep < STORY.prologue.length - 1 ? 'SIGUIENTE' : 'ELEGIR CANTANTE'}
                </button>
                <GoldPixelArrow direction="left" />
              </div>
            </div>
          </section>
        )}

        {/* CHARACTER SELECT (SELECCIÓN) — FULL-HEIGHT 3-PANEL COLORED BACKDROP + FULL-BODY HEROES */}
        {hud.screen === 'SELECCIÓN' && (
          <section
            onTouchStart={handleSelectSwipeStart}
            onTouchEnd={handleSelectSwipeEnd}
            className="absolute inset-0 z-30 flex flex-col justify-between overflow-hidden bg-[#05070D]"
          >
            {/* Uploaded 3-panel textured background (Red / Steel Gray / Magenta) */}
            <img
              src={CHAR_SELECT_BG_PATH}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#05070D]/85 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#05070D]/90 to-transparent" />

            {/* Compact Top Bar */}
            <div className="relative z-10 flex items-center justify-between px-2.5 pt-1.5 pb-0.5 sm:px-5 sm:pt-2.5 sm:pb-1">
              <h2 className="arcade-outline text-[11px] font-black text-[#FFD23F] sm:text-xl">
                ELIGE TU CANTANTE — FIRMADO EN SANGRE
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="sound-toggle-btn"
                  aria-pressed={hud.muted}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.toggleMute();
                  }}
                  className={`arcade-panel flex h-7 w-7 cursor-pointer items-center justify-center sm:h-8 sm:w-8 ${
                    hud.muted
                      ? '!border-[#EF4444] !bg-[#450A0A]/90 text-[#FCA5A5] hover:text-white'
                      : 'text-[#19E3FF] hover:text-[#FFD23F]'
                  }`}
                  aria-label={hud.muted ? 'Encender sonido' : 'Apagar sonido'}
                  title={hud.muted ? 'Encender sonido (M)' : 'Apagar sonido (M)'}
                >
                  <SpeakerIcon muted={hud.muted} />
                </button>
                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToTitle()}
                  className="arcade-menu-link cursor-pointer text-[10px] font-black sm:text-sm"
                >
                  VOLVER
                </button>
              </div>
            </div>

            {/* 3 Full-Height Vertical Colored Panels with Full-Body Characters + 3D Depth */}
            <div className="relative z-10 grid min-h-0 flex-1 grid-cols-3 gap-1.5 px-2 py-1 sm:gap-4 sm:px-5 sm:py-2">
              {CHAR_ORDER.map((cid) => {
                const c = CHARACTERS[cid];
                const enabled = hud.availableCharacters.includes(cid);
                const selected = hud.charId === cid;
                const portraitSrc = HERO_PORTRAIT_PATHS[cid];
                return (
                  <button
                    key={cid}
                    type="button"
                    disabled={!enabled}
                    onMouseEnter={() => {
                      if (enabled && hud.charId !== cid) {
                        engineRef.current?.selectCharacter(cid);
                      }
                    }}
                    onFocus={() => {
                      if (enabled && hud.charId !== cid) {
                        engineRef.current?.selectCharacter(cid);
                      }
                    }}
                    onClick={() => {
                      if (!enabled) return;
                      if (hud.charId === cid) {
                        engineRef.current?.startRun(cid);
                      } else {
                        engineRef.current?.selectCharacter(cid);
                      }
                    }}
                    className={`group relative flex h-full min-h-0 w-full cursor-pointer flex-col justify-end overflow-hidden text-left transition-all duration-200 ease-out ${
                      selected
                        ? 'z-20 -translate-y-1 scale-[1.05] border-2 border-[#FFD23F] bg-gradient-to-b from-[#FFD23F]/15 via-transparent to-[#05070D]/95 shadow-[0_14px_30px_rgba(255,210,63,0.42),inset_0_0_24px_rgba(245,158,11,0.38)] sm:-translate-y-2 sm:scale-[1.06]'
                        : 'z-0 translate-y-1 scale-[0.95] border border-white/15 bg-black/30 opacity-80 brightness-75 saturate-75 hover:opacity-100 hover:brightness-100'
                    } ${!enabled ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    {/* Full-body hero portrait filling panel height with forward float & shadow depth */}
                    <div className="pointer-events-none absolute inset-x-0 top-0.5 bottom-6 flex items-end justify-center sm:top-1 sm:bottom-20">
                      <img
                        src={portraitSrc}
                        alt={c.name}
                        className={`pixel-canvas h-full w-full object-contain object-bottom transition-all duration-200 ease-out ${
                          selected
                            ? 'arcade-hero-float brightness-110 drop-shadow-[0_12px_10px_#05070D]'
                            : 'scale-[0.95] brightness-75 drop-shadow-[0_4px_2px_#05070D]'
                        }`}
                      />
                    </div>

                    {/* Selected gold banner badge */}
                    {selected && (
                      <div className="arcade-selected-bar absolute top-1.5 left-1/2 z-20 hidden -translate-x-1/2 px-3 py-0.5 text-[11px] font-black tracking-widest whitespace-nowrap sm:block">
                        ◄ SELECCIONADO ►
                      </div>
                    )}

                    {/* Prominent hero nameplate & compact stats */}
                    <div className="relative z-10 w-full bg-gradient-to-t from-[#05070D] via-[#05070D]/92 to-transparent px-1.5 pt-3 pb-1 sm:px-3 sm:pt-7 sm:pb-2">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`arcade-outline truncate font-black leading-none tracking-wide ${
                            selected
                              ? 'text-xs text-[#FFD23F] sm:text-xl lg:text-2xl'
                              : 'text-[11px] text-[#E83BFF] sm:text-lg lg:text-xl'
                          }`}
                        >
                          {c.name}
                        </span>
                        <span className="hidden truncate text-[10px] font-bold text-[#19E3FF] sm:inline">
                          {c.archetypeTitle}
                        </span>
                      </div>

                      <div className="mt-1.5 hidden grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-bold sm:grid">
                        <StatBar label="VEL" val={c.bars.velocidad} color="#19E3FF" />
                        <StatBar label="FUE" val={c.bars.fuerza} color="#E83BFF" />
                        <StatBar label="ALC" val={c.bars.alcance} color="#FFD23F" />
                        <StatBar label="AGI" val={c.bars.agilidad} color="#7CFF4F" />
                      </div>
                      <div className="mt-0.5 hidden truncate text-[9px] font-bold text-[#19E3FF] sm:block">
                        COMBO: {c.comboName}
                      </div>
                      <div className="mt-0.5 hidden truncate text-[10px] font-bold text-[#FFD23F] sm:block">
                        ESP: {c.specialName}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Compact Bottom Confirm Bar */}
            <div className="relative z-10 flex items-center justify-between gap-2 px-2.5 pt-0.5 pb-1.5 sm:px-5 sm:pt-1 sm:pb-3">
              <span className="arcade-outline-sm text-[8px] font-bold text-white/90 sm:text-xs">
                {hud.gamepadConnected ? '◄ ► ELEGIR · A PELEAR · B VOLVER' : '◄ ► ELEGIR · ENTER CONFIRMA'}
              </span>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <GoldPixelArrow direction="right" />
                <button
                  type="button"
                  data-start="true"
                  onClick={() => engineRef.current?.startRun(hud.charId)}
                  className="arcade-selected-bar cursor-pointer px-3 py-1 text-[10px] font-black sm:px-7 sm:py-2 sm:text-sm"
                >
                  PELEAR (A)
                </button>
                <GoldPixelArrow direction="left" />
              </div>
            </div>
          </section>
        )}

        {/* PLAYING HUD */}
        {isPlayingHud && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-1.5 sm:p-4">
            {/* Top Bar */}
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              {/* Top-left: Portrait, HP, Lives, PASESITO, Last Enemy Hit */}
              <div className="flex flex-col gap-1">
                <div className="arcade-panel flex items-center gap-1.5 p-1 sm:gap-2 sm:p-1.5">
                  <div className="hidden sm:block">
                    <CharacterPortraitCrop charId={hud.charId} size={42} />
                  </div>
                  <div className="sm:hidden">
                    <CharacterPortraitCrop charId={hud.charId} size={28} />
                  </div>
                  <div className="w-24 sm:w-44">
                    <div className="flex items-center justify-between text-[9px] font-black sm:text-[11px]">
                      <span className="arcade-outline-sm truncate text-[#FFD23F]">
                        {hud.charName}
                      </span>
                      <span className="tabular-nums text-[#7CFF4F]">x{hud.lives}</span>
                    </div>
                    <div
                      className={`mt-0.5 h-2.5 w-full border sm:mt-1 sm:h-3.5 ${
                        hud.hpFlashRed
                          ? 'border-[#C1121F] bg-[#C1121F]/60'
                          : 'border-white/70 bg-[#1A0B2E]'
                      }`}
                    >
                      <div
                        className={`h-full transition-all duration-100 ${
                          hud.hpFlashRed
                            ? 'bg-[#C1121F]'
                            : hud.hp <= 25
                            ? 'bg-[#E83BFF]'
                            : 'bg-[#7CFF4F]'
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[8px] font-bold tabular-nums text-white/95 sm:text-[10px]">
                      <span>
                        HP {hud.hp}/{hud.maxHp}
                      </span>
                      {hud.powerUp && (
                        <span className="text-[#E83BFF]">
                          PASESITO ×{Math.ceil(hud.powerUpTimer)}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last Enemy Hit Bar */}
                {hud.lastTargetName && hud.lastTargetHp > 0 && (
                  <div className="w-32 border border-[#E83BFF] bg-[#05070D]/90 px-1.5 py-0.5 sm:w-44 sm:px-2 sm:py-1">
                    <div className="flex justify-between text-[8px] font-bold text-[#E83BFF] sm:text-[10px]">
                      <span className="truncate">{hud.lastTargetName}</span>
                      <span className="tabular-nums">{hud.lastTargetHp}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full bg-[#1A0B2E] sm:h-2">
                      <div
                        className="h-full bg-[#E83BFF]"
                        style={{
                          width: `${Math.max(
                            0,
                            (hud.lastTargetHp / Math.max(1, hud.lastTargetMaxHp)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Top-center: Boss HP Bar */}
              {hud.bossName && (
                <div className="arcade-panel w-40 px-2 py-1 sm:w-96 sm:px-2.5 sm:py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[9px] font-black text-[#FFD23F] sm:text-[11px]">
                    <span className="arcade-outline-sm truncate">{hud.bossName}</span>
                    <span className="shrink-0 tabular-nums text-[#E83BFF]">
                      {hud.bossHp}/{hud.bossMaxHp}
                    </span>
                  </div>
                  <div className="mt-0.5 h-2.5 w-full border border-[#F59E0B]/60 bg-[#1A0B2E] sm:mt-1 sm:h-3.5">
                    <div
                      className="h-full bg-[#C1121F] transition-all duration-100"
                      style={{
                        width: `${Math.max(0, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[7px] font-black tracking-wider sm:text-[8px]">
                    {[1, 2, 3].map((phase) => (
                      <span
                        key={phase}
                        className={`flex-1 text-center ${hud.bossPhase >= phase ? 'text-[#FFD23F]' : 'text-white/35'}`}
                      >
                        FASE {phase}
                      </span>
                    ))}
                  </div>
                  <div className="mt-0.5 hidden justify-center gap-2 text-[7px] font-bold tracking-wide text-white/75 sm:flex">
                    <span className="text-[#E83BFF]">↔ horizontal</span>
                    <span className="text-[#FFD23F]">◎ área</span>
                    <span className="text-[#19E3FF]">✦ proyectil</span>
                  </div>
                </div>
              )}

              {/* Top-right: Score, Record, Timer & Utility icon buttons */}
              <div className="flex items-start gap-1 sm:gap-2">
                <div className="arcade-panel px-1.5 py-0.5 text-right sm:px-2.5 sm:py-1">
                  <div className="arcade-outline-sm tabular-nums text-[10px] font-black text-[#FFD23F] sm:text-sm">
                    {hud.score} PTS
                  </div>
                  <div className="tabular-nums text-[8px] font-bold text-[#19E3FF] sm:text-[10px]">
                    REC {hud.highScore} · {formatTimeMMSS(hud.levelTimer)}
                  </div>
                </div>

                <div className="pointer-events-auto flex gap-1">
                  <button
                    type="button"
                    data-testid="sound-toggle-btn"
                    tabIndex={-1}
                    aria-pressed={hud.muted}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.toggleMute();
                    }}
                    className={`arcade-panel flex h-7 w-7 cursor-pointer items-center justify-center sm:h-8 sm:w-8 ${
                      hud.muted
                        ? '!border-[#EF4444] !bg-[#450A0A]/90 text-[#FCA5A5] hover:text-white'
                        : 'text-[#19E3FF] hover:text-[#FFD23F]'
                    }`}
                    aria-label={hud.muted ? 'Encender sonido' : 'Apagar sonido'}
                    title={hud.muted ? 'Encender sonido (M)' : 'Apagar sonido (M)'}
                  >
                    <SpeakerIcon muted={hud.muted} />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.togglePause();
                    }}
                    className="arcade-panel flex h-7 w-7 cursor-pointer items-center justify-center text-[#FFD23F] hover:text-[#E83BFF] sm:h-8 sm:w-8"
                    aria-label="Pausar juego"
                    title="Pausa (P)"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4">
                      <rect x="6" y="5" width="4" height="14" />
                      <rect x="14" y="5" width="4" height="14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Center Banners / Boss Danger Warning / Go Arrow */}
            <div className="flex flex-col items-center justify-center gap-2">
              {hud.bossDangerActive && (
                <div
                  data-testid="boss-danger-alert"
                  className="arcade-danger-alert px-5 py-1.5 text-center sm:px-8 sm:py-2"
                >
                  <div className="arcade-outline text-xs font-black tracking-widest text-[#FFD23F] sm:text-lg">
                    ⚠ ¡PELIGRO! — JEFE EN CAMINO ⚠
                  </div>
                </div>
              )}

              {hud.bannerText && (
                <div className="arcade-selected-bar px-6 py-2 text-center">
                  <div className="text-sm font-black sm:text-xl">{hud.bannerText}</div>
                </div>
              )}

              {hud.specialBannerText && (
                <div className="arcade-outline text-xl font-black text-[#19E3FF] sm:text-3xl">
                  {hud.specialBannerText}
                </div>
              )}

              {hud.showGoArrow && (
                <div className="arcade-selected-bar animate-pulse self-end px-4 py-1.5 text-base font-black">
                  ¡VAMOS! ►
                </div>
              )}
            </div>

            {/* Bottom area: Tutorial / Boss Dialogue / Debug tag */}
            <div className="flex flex-col items-center gap-1.5">
              {hud.dialogueText && (
                <div className="arcade-panel w-full max-w-2xl px-4 py-2 text-xs sm:text-sm">
                  <span className="font-black text-[#FFD23F]">{hud.dialogueSpeaker}: </span>
                  <span className="text-white">{hud.dialogueText}</span>
                </div>
              )}

              {hud.tutorialHint && (
                <div className="arcade-panel px-3 py-1 text-xs font-bold text-[#19E3FF]">
                  {hud.tutorialHint}
                </div>
              )}

              {hud.debugEnabled && (
                <div className="bg-[#05070D]/90 px-2 py-0.5 text-[10px] font-bold text-[#7CFF4F]">
                  DEBUG: F1 Cajas ({hud.debugHitboxes ? 'ON' : 'OFF'}) · F2 Nivel · F3 Dios (
                  {hud.debugGodMode ? 'ON' : 'OFF'}) · F4 Jefe · F5 Personaje
                </div>
              )}
            </div>
          </div>
        )}

        {/* MOBILE TOUCH CONTROLS (only during active play) */}
        {isPlayingHud && (
          <TouchControls onJoystick={handleTouchJoystick} onButton={handleTouchButton} />
        )}

        {/* GLOBAL FLOATING SPEAKER TOGGLE ON INTERMISSION/MODAL SCREENS */}
        {!isPlayingHud && hud.screen !== 'MENÚ' && hud.screen !== 'SELECCIÓN' && hud.screen !== 'CARGA' && (
          <button
            type="button"
            tabIndex={-1}
            data-testid="sound-toggle-btn"
            aria-pressed={hud.muted}
            onClick={(e) => {
              e.currentTarget.blur();
              engineRef.current?.toggleMute();
            }}
            className={`arcade-panel absolute top-3 right-3 z-40 flex h-8 w-8 cursor-pointer items-center justify-center sm:top-5 sm:right-6 sm:h-10 sm:w-10 ${
              hud.muted
                ? '!border-[#EF4444] !bg-[#450A0A]/90 text-[#FCA5A5] hover:text-white'
                : 'text-[#19E3FF] hover:text-[#FFD23F]'
            }`}
            aria-label={hud.muted ? 'Encender sonido' : 'Apagar sonido'}
            title={hud.muted ? 'Encender sonido (M)' : 'Apagar sonido (M)'}
          >
            <SpeakerIcon muted={hud.muted} />
          </button>
        )}

        {/* PAUSE MODAL */}
        {hud.screen === 'PAUSA' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070D]/86 p-4">
            <div className="arcade-panel w-full max-w-sm p-6 text-center">
              <h2 className="arcade-outline mb-4 text-2xl font-black text-[#FFD23F]">PAUSA</h2>
              <div className="flex flex-col items-center gap-2.5">
                {[
                  {
                    label: 'REANUDAR (P)',
                    onActivate: () => engineRef.current?.togglePause(),
                    sizeClass: 'text-sm',
                  },
                  {
                    label: 'REINICIAR (R)',
                    onActivate: () => engineRef.current?.restartLevelOrGame(),
                    sizeClass: 'text-sm',
                  },
                  {
                    label: `SONIDO: ${hud.muted ? 'OFF' : 'ON'}`,
                    onActivate: () => engineRef.current?.toggleMute(),
                    sizeClass: 'text-xs',
                  },
                  {
                    label: `REDUCIR EFECTOS: ${hud.reduceEffects ? 'SÍ' : 'NO'}`,
                    onActivate: () => engineRef.current?.toggleReduceEffects(),
                    sizeClass: 'text-xs',
                  },
                  {
                    label: 'VOLVER AL MENÚ',
                    onActivate: () => engineRef.current?.returnToTitle(),
                    sizeClass: 'text-sm',
                  },
                ].map((item, idx) => {
                  const selected = pauseIndex === idx;
                  return (
                    <div key={item.label} className="flex w-full items-center justify-center gap-1.5">
                      {selected ? (
                        <>
                          <GoldPixelArrow direction="right" />
                          <button
                            type="button"
                            onMouseEnter={() => setPauseIndex(idx)}
                            onClick={item.onActivate}
                            className={`arcade-selected-bar flex-1 cursor-pointer py-2 font-black ${item.sizeClass}`}
                          >
                            {item.label}
                          </button>
                          <GoldPixelArrow direction="left" />
                        </>
                      ) : (
                        <button
                          type="button"
                          onMouseEnter={() => setPauseIndex(idx)}
                          onClick={item.onActivate}
                          className={`arcade-menu-link cursor-pointer py-1 font-black ${item.sizeClass}`}
                        >
                          {item.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* LEVEL COMPLETE MODAL */}
        {hud.screen === 'NIVEL_COMPLETO' && hud.levelResults && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070D]/90 p-4">
            <div className="arcade-panel w-full max-w-md p-6">
              <h2 className="arcade-outline text-xl font-black text-[#FFD23F]">
                NIVEL {hud.levelNumber} COMPLETADO
              </h2>
              <p className="mt-1 text-xs text-[#19E3FF]">
                {STORY.levelRewards[hud.levelNumber]}
              </p>
              <div className="mt-4 space-y-1.5 border-y border-[#F59E0B]/40 py-3 text-sm tabular-nums">
                <div className="flex justify-between">
                  <span>BONUS TIEMPO</span>
                  <span className="font-bold text-[#19E3FF]">+{hud.levelResults.timeBonus}</span>
                </div>
                <div className="flex justify-between">
                  <span>BONUS VIDA</span>
                  <span className="font-bold text-[#7CFF4F]">+{hud.levelResults.hpBonus}</span>
                </div>
                <div className="flex justify-between">
                  <span>CERO DAÑO AL JEFE</span>
                  <span className="font-bold text-[#FFD23F]">
                    +{hud.levelResults.noDamageBossBonus}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-base font-black text-white">
                  <span>TOTAL</span>
                  <span>{hud.levelResults.totalScore} PTS</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <GoldPixelArrow direction="right" />
                <button
                  type="button"
                  onClick={() => engineRef.current?.nextAfterLevelResults()}
                  className="arcade-selected-bar flex-1 cursor-pointer py-2.5 text-sm font-black"
                >
                  SIGUIENTE ETAPA
                </button>
                <GoldPixelArrow direction="left" />
              </div>
            </div>
          </div>
        )}

        {/* CONTINUE COUNTDOWN */}
        {hud.screen === 'CONTINUAR' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070D]/90 p-4">
            <div className="arcade-panel w-full max-w-sm p-6 text-center">
              <h2 className="arcade-outline text-2xl font-black text-[#FFD23F]">¿CONTINUAR?</h2>
              <div className="arcade-outline my-4 tabular-nums text-6xl font-black text-[#E83BFF]">
                {hud.continueCountdown}
              </div>
              <p className="mb-4 text-xs text-white/80">
                Continues restantes: {hud.continuesLeft} (el puntaje vuelve a 0)
              </p>
              <div className="flex flex-col items-center gap-3">
                <div className="flex w-full items-center gap-1.5">
                  <GoldPixelArrow direction="right" />
                  <button
                    type="button"
                    disabled={hud.continuesLeft <= 0}
                    onClick={() => engineRef.current?.continueGame()}
                    className="arcade-selected-bar flex-1 cursor-pointer py-2.5 text-sm font-black disabled:opacity-40"
                  >
                    CONTINUAR
                  </button>
                  <GoldPixelArrow direction="left" />
                </div>
                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToTitle()}
                  className="arcade-menu-link cursor-pointer py-1 text-sm font-black"
                >
                  RENDIRSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {hud.screen === 'GAME_OVER' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070D]/92 p-4">
            <div className="arcade-panel w-full max-w-sm p-6 text-center">
              <h2 className="arcade-outline text-3xl font-black text-[#C1121F]">GAME OVER</h2>
              <p className="mt-2 text-xs text-white/85">
                Llegaste al Nivel {hud.levelNumber} · {hud.levelName}
              </p>
              <div className="my-4 grid grid-cols-2 gap-2 border-y border-[#F59E0B]/40 py-3 tabular-nums text-xs">
                <div>
                  <div className="text-white/60">PUNTAJE</div>
                  <div className="text-base font-black text-[#FFD23F]">{hud.score}</div>
                </div>
                <div>
                  <div className="text-white/60">RÉCORD</div>
                  <div className="text-base font-black text-[#19E3FF]">{hud.highScore}</div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <div className="flex w-full items-center gap-1.5">
                  <GoldPixelArrow direction="right" />
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => engineRef.current?.restartLevelOrGame()}
                    className="arcade-selected-bar flex-1 cursor-pointer py-2.5 text-sm font-black"
                  >
                    VOLVER A INTENTAR
                  </button>
                  <GoldPixelArrow direction="left" />
                </div>
                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToTitle()}
                  className="arcade-menu-link cursor-pointer py-1 text-xs font-black"
                >
                  MENÚ PRINCIPAL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VICTORY & ENDING VIGNETTES */}
        {hud.screen === 'VICTORIA' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070D]/94 p-4">
            <div className="arcade-panel w-full max-w-xl p-6 text-center">
              {hud.endingStep < 3 ? (
                <>
                  <div className="mb-2 text-xs font-bold text-[#19E3FF]">
                    FINAL · VIÑETA {hud.endingStep + 1} / 3
                  </div>
                  <div className="my-4 border border-[#F59E0B]/60 bg-[#05070D] p-6">
                    <p className="text-base font-bold text-white">
                      {STORY.endingPanels[hud.endingStep]}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <GoldPixelArrow direction="right" />
                    <button
                      type="button"
                      onClick={() => engineRef.current?.advanceEnding()}
                      className="arcade-selected-bar cursor-pointer px-8 py-2 text-sm font-black"
                    >
                      CONTINUAR
                    </button>
                    <GoldPixelArrow direction="left" />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="arcade-outline text-2xl font-black text-[#FFD23F]">
                    ¡VICTORIA SIN CADENAS!
                  </h2>
                  <div className="my-3 flex items-center justify-center gap-4">
                    <CharacterIdlePreview charId={hud.charId} width={92} height={106} />
                    <div className="max-w-xs text-left">
                      <div className="text-sm font-black text-[#19E3FF]">{hud.charName}</div>
                      <p className="mt-1 text-xs italic text-white">
                        &ldquo;{CHARACTERS[hud.charId].endingLine}&rdquo;
                      </p>
                      <div className="mt-2 tabular-nums text-sm font-black text-[#FFD23F]">
                        PUNTAJE FINAL: {hud.score}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <GoldPixelArrow direction="right" />
                    <button
                      type="button"
                      data-start="true"
                      onClick={() => engineRef.current?.returnToTitle()}
                      className="arcade-selected-bar cursor-pointer px-7 py-2.5 text-sm font-black"
                    >
                      VOLVER AL MENÚ
                    </button>
                    <GoldPixelArrow direction="left" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const StatBar = memo(function StatBar({
  label,
  val,
  color,
}: {
  label: string;
  val: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-6 text-white/80">{label}</span>
      <div className="flex flex-1 gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="h-1.5 flex-1"
            style={{ backgroundColor: n <= val ? color : '#262B38' }}
          />
        ))}
      </div>
    </div>
  );
});
