import { memo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface TouchControlsProps {
  onJoystick: (x: number, y: number) => void;
  onButton: (btn: 'A' | 'B' | 'ESP', pressed: boolean) => void;
}

export const TouchControls = memo(function TouchControls({
  onJoystick,
  onButton,
}: TouchControlsProps) {
  const joyRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);

  const updateStick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }
    const nx = Math.abs(dx / maxR) < 0.18 ? 0 : dx / maxR; // Zona muerta
    const ny = Math.abs(dy / maxR) < 0.18 ? 0 : dy / maxR;
    onJoystick(nx, ny);
  };

  const handleJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    updateStick(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateStick(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    onJoystick(0, 0);
  };

  const handleButtonDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    btn: 'A' | 'B' | 'ESP',
  ) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onButton(btn, true);
  };

  const handleButtonUp = (
    e: ReactPointerEvent<HTMLButtonElement>,
    btn: 'A' | 'B' | 'ESP',
  ) => {
    onButton(btn, false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden">
      {/* Virtual Joystick */}
      <div
        ref={joyRef}
        onPointerDown={handleJoyDown}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyUp}
        onPointerCancel={handleJoyUp}
        className="pointer-events-auto relative flex h-32 w-32 touch-none items-center justify-center rounded-full border-2 border-[#19E3FF]/70 bg-[#0B0F1E]/75"
        aria-label="Joystick táctil"
      >
        <div
          ref={knobRef}
          className="h-12 w-12 rounded-full border-2 border-[#FFD23F] bg-[#FF2E88]/80"
          style={{ transform: 'translate3d(0px, 0px, 0)' }}
        />
      </div>

      {/* Action Buttons A, B, ESP */}
      <div className="pointer-events-auto flex items-end gap-3">
        <button
          type="button"
          onPointerDown={(e) => handleButtonDown(e, 'ESP')}
          onPointerUp={(e) => handleButtonUp(e, 'ESP')}
          onPointerCancel={(e) => handleButtonUp(e, 'ESP')}
          className="flex h-12 w-12 touch-none items-center justify-center rounded-full border-2 border-[#FFD23F] bg-[#1A0B2E]/90 text-xs font-bold text-[#FFD23F] active:scale-95"
          aria-label="Especial"
        >
          ESP
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleButtonDown(e, 'B')}
          onPointerUp={(e) => handleButtonUp(e, 'B')}
          onPointerCancel={(e) => handleButtonUp(e, 'B')}
          className="flex h-16 w-16 touch-none items-center justify-center rounded-full border-2 border-[#19E3FF] bg-[#0B0F1E]/85 text-lg font-bold text-[#19E3FF] active:scale-95"
          aria-label="Saltar (B)"
        >
          B
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleButtonDown(e, 'A')}
          onPointerUp={(e) => handleButtonUp(e, 'A')}
          onPointerCancel={(e) => handleButtonUp(e, 'A')}
          className="flex h-18 w-18 touch-none items-center justify-center rounded-full border-2 border-[#FF2E88] bg-[#C1121F]/85 text-xl font-bold text-white active:scale-95"
          aria-label="Atacar (A)"
        >
          A
        </button>
      </div>
    </div>
  );
});
