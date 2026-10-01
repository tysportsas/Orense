'use client';

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

export default function PositionPitch({ puesto, lateralidad }: { puesto?: string; lateralidad?: string }) {
  const marker = resolvePosition(puesto, lateralidad);
  if (!marker) return null;

  return (
    <div className="w-28 flex-none">
      <div
        className="relative w-28 h-36 rounded-2xl border-2 border-[#86af6e] shadow-sm overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #8fbf74 0%, #afd496 100%)' }}
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
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        >
          <span className="w-5 h-5 rounded-full bg-gold border-2 border-white shadow" />
          <span className="text-[10px] font-bold text-white bg-black/60 px-1 rounded leading-tight">
            {marker.label}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted text-center mt-1">Posición</p>
    </div>
  );
}
