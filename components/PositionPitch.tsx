'use client';

import { useRef, useState } from 'react';

// Mapa de puesto (+ lateralidad) a coordenadas porcentuales sobre un campo
// vertical donde arriba = ataque (delanteros) y abajo = defensa (portero),
// igual que la orientación usada en el Campograma táctico.
const POSITION_COORDS: Record<string, { x: number; y: number; label: string }> = {
  ARQUERO: { x: 50, y: 90, label: 'POR' },
  PORTERO: { x: 50, y: 90, label: 'POR' },
  CENTRAL_IZQ: { x: 35, y: 75, label: 'DFC' },
  CENTRAL_DER: { x: 65, y: 75, label: 'DFC' },
  CENTRAL: { x: 50, y: 75, label: 'DFC' },
  LATERAL_IZQ: { x: 14, y: 68, label: 'LI' },
  LATERAL_DER: { x: 86, y: 68, label: 'LD' },
  LATERAL: { x: 14, y: 68, label: 'LAT' },
  MEDIOCENTRO: { x: 50, y: 50, label: 'MC' },
  INTERIOR_IZQ: { x: 30, y: 42, label: 'MI' },
  INTERIOR_DER: { x: 70, y: 42, label: 'MD' },
  INTERIOR: { x: 30, y: 42, label: 'INT' },
  MEDIAPUNTA: { x: 50, y: 28, label: 'MP' },
  EXTREMO_IZQ: { x: 18, y: 24, label: 'EI' },
  EXTREMO_DER: { x: 82, y: 24, label: 'ED' },
  EXTREMO: { x: 18, y: 24, label: 'EXT' },
  PUNTA: { x: 50, y: 12, label: 'DC' },
  DELANTERO: { x: 50, y: 12, label: 'DC' }
};

function resolvePosition(puesto?: string, lateralidad?: string) {
  const pos = String(puesto ?? '').trim().toUpperCase();
  if (!pos) return null;
  const lat = String(lateralidad ?? '').trim().toUpperCase();
  const sided = ['CENTRAL', 'LATERAL', 'INTERIOR', 'EXTREMO'];
  if (sided.includes(pos)) {
    const side = lat === 'IZQUIERDO' ? 'IZQ' : lat === 'DERECHO' ? 'DER' : null;
    if (side && POSITION_COORDS[`${pos}_${side}`]) return POSITION_COORDS[`${pos}_${side}`];
  }
  return POSITION_COORDS[pos] ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface PositionPitchProps {
  puesto?: string;
  lateralidad?: string;
  /** Coordenadas personalizadas (0-100) guardadas previamente; si no se dan, se calculan a partir del puesto. */
  posX?: number;
  posY?: number;
  /** Permite arrastrar el marcador para reubicarlo manualmente. */
  editable?: boolean;
  /** Se invoca al soltar el marcador, con las nuevas coordenadas en porcentaje. */
  onPositionChange?: (x: number, y: number) => void;
}

export default function PositionPitch({ puesto, lateralidad, posX, posY, editable = false, onPositionChange }: PositionPitchProps) {
  const defaultMarker = resolvePosition(puesto, lateralidad);
  const label = defaultMarker?.label ?? 'POS';
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(
    posX != null && posY != null ? { x: posX, y: posY } : defaultMarker ? { x: defaultMarker.x, y: defaultMarker.y } : null
  );
  const [dragging, setDragging] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  if (!coords) return null;

  function updateFromPointer(clientX: number, clientY: number) {
    const el = fieldRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 4, 96);
    setCoords({ x, y });
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!editable) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    updateFromPointer(e.clientX, e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    setDragging(false);
    const next = updateFromPointer(e.clientX, e.clientY);
    if (next) onPositionChange?.(next.x, next.y);
  }

  function handleReset() {
    if (!defaultMarker) return;
    setCoords({ x: defaultMarker.x, y: defaultMarker.y });
    onPositionChange?.(defaultMarker.x, defaultMarker.y);
  }

  return (
    <div className="w-28 flex-none">
      <div
        ref={fieldRef}
        className="relative w-28 h-36 rounded-2xl border-2 border-[#86af6e] shadow-sm overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #8fbf74 0%, #afd496 100%)', touchAction: editable ? 'none' : undefined }}
      >
        {/* Líneas blancas del campo */}
        <div className="absolute inset-1.5 border-2 border-white/90 rounded-lg pointer-events-none flex flex-col justify-between">
          <div className="w-full flex justify-center">
            <div className="w-2/3 h-6 border-b-2 border-x-2 border-white/90" />
          </div>
          <div className="w-full border-t-2 border-white/90 relative flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/90 rounded-full absolute -top-5" />
          </div>
          <div className="w-full flex justify-center">
            <div className="w-2/3 h-6 border-t-2 border-x-2 border-white/90" />
          </div>
        </div>

        {/* Marcador de posición */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
        >
          <span className={`w-5 h-5 rounded-full bg-gold border-2 border-white shadow ${dragging ? 'scale-125' : ''} transition-transform`} />
          <span className="text-[10px] font-bold text-white bg-black/60 px-1 rounded leading-tight pointer-events-none">
            {label}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 mt-1">
        <p className="text-xs text-muted text-center">Posición</p>
        {editable && (
          <button
            type="button"
            onClick={handleReset}
            title="Restablecer posición según el puesto"
            className="text-xs text-turf hover:underline"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
