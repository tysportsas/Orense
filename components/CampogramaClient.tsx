'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { ReportRow } from '@/lib/reports';
import { keyOf, signedPhotoUrl } from '@/lib/reports';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIAS, OBSERVADORES } from '@/lib/formModel';

interface Props {
  initialReports: ReportRow[];
}

interface PlayerSummary {
  playerKey: string;
  nombre: string;
  club?: string;
  categoria?: string;
  puesto: string;
  lateralidad?: string;
  valoracion?: string;
  valScore: string;
  observador?: string;
  foto?: string;
  fotoUrl?: string;
  lastReportAt: string;
}

export default function CampogramaClient({ initialReports }: Props) {
  const [selectedValoracion, setSelectedValoracion] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [selectedObservador, setSelectedObservador] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Consolidar informes más recientes por jugador
  const uniquePlayers = useMemo(() => {
    const map = new Map<string, PlayerSummary>();

    initialReports.forEach((r) => {
      const d = r.data;
      const key = keyOf(d);
      if (!key || !d.nombre) return;

      const cleanNombre = String(d.nombre).trim();

      // Descartar frases u observaciones accidentales guardadas como nombre
      if (
        cleanNombre.length > 45 ||
        /^(considero|control|destacando|destacándose|jugador|el|la|un|una|posee|buen)\b/i.test(cleanNombre)
      ) {
        return;
      }

      const rawVal = d.valoracion || '';
      let score = '—';
      if (rawVal.includes('5.') || rawVal.includes('FICHAR')) score = '5';
      else if (rawVal.includes('4.') || rawVal.includes('INTERESANTE')) score = '4';
      else if (rawVal.includes('3.') || rawVal.includes('SEGUIR VIENDO')) score = '3';
      else if (rawVal.includes('2.') || rawVal.includes('DESCARTAR')) score = '2';
      else if (rawVal.includes('1.') || rawVal.includes('SIN VER')) score = '1';

      if (!map.has(key)) {
        map.set(key, {
          playerKey: key,
          nombre: cleanNombre,
          club: d.club,
          categoria: d.categoria,
          puesto: (d.puesto || 'SIN PUESTO').toUpperCase(),
          lateralidad: d.lateralidad,
          valoracion: d.valoracion,
          valScore: score,
          observador: d.observador,
          foto: d.foto,
          fotoUrl: d.foto_url,
          lastReportAt: r.created_at
        });
      } else {
        const existing = map.get(key)!;
        if (new Date(r.created_at) > new Date(existing.lastReportAt)) {
          existing.lastReportAt = r.created_at;
          existing.nombre = cleanNombre;
          if (d.puesto) existing.puesto = d.puesto.toUpperCase();
          if (d.valoracion) {
            existing.valoracion = d.valoracion;
            existing.valScore = score;
          }
          if (d.club) existing.club = d.club;
          if (d.categoria) existing.categoria = d.categoria;
          if (d.lateralidad) existing.lateralidad = d.lateralidad;
          if (d.foto) existing.foto = d.foto;
          if (d.foto_url) existing.fotoUrl = d.foto_url;
        }
      }
    });

    return Array.from(map.values());
  }, [initialReports]);

  // Filtrado de jugadores
  const filteredPlayers = useMemo(() => {
    return uniquePlayers.filter((p) => {
      if (selectedValoracion && (!p.valoracion || !p.valoracion.includes(selectedValoracion))) {
        return false;
      }
      if (selectedCategoria && p.categoria !== selectedCategoria) {
        return false;
      }
      if (selectedObservador && p.observador !== selectedObservador) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.nombre.toLowerCase().includes(q);
        const matchesClub = (p.club || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClub) return false;
      }
      return true;
    });
  }, [uniquePlayers, selectedValoracion, selectedCategoria, selectedObservador, searchQuery]);

  // Agrupación por zonas específicas del campo
  const pitchGroups = useMemo(() => {
    const porteros: PlayerSummary[] = [];
    const centralesIzq: PlayerSummary[] = [];
    const centralesDer: PlayerSummary[] = [];
    const lateralesIzq: PlayerSummary[] = [];
    const lateralesDer: PlayerSummary[] = [];
    const mediosCentro: PlayerSummary[] = [];
    const interiores: PlayerSummary[] = [];
    const mediasPuntas: PlayerSummary[] = [];
    const extremosIzq: PlayerSummary[] = [];
    const extremosDer: PlayerSummary[] = [];
    const delanteros: PlayerSummary[] = [];

    filteredPlayers.forEach((p) => {
      const pos = p.puesto;
      const lat = (p.lateralidad || '').toUpperCase();

      if (pos === 'ARQUERO' || pos === 'PORTERO') {
        porteros.push(p);
      } else if (pos === 'CENTRAL') {
        if (lat === 'IZQUIERDO' || centralesIzq.length <= centralesDer.length) {
          centralesIzq.push(p);
        } else {
          centralesDer.push(p);
        }
      } else if (pos === 'LATERAL') {
        if (lat === 'IZQUIERDO') {
          lateralesIzq.push(p);
        } else if (lat === 'DERECHO') {
          lateralesDer.push(p);
        } else {
          if (lateralesIzq.length <= lateralesDer.length) lateralesIzq.push(p);
          else lateralesDer.push(p);
        }
      } else if (pos === 'MEDIOCENTRO') {
        mediosCentro.push(p);
      } else if (pos === 'INTERIOR') {
        interiores.push(p);
      } else if (pos === 'MEDIAPUNTA') {
        mediasPuntas.push(p);
      } else if (pos === 'EXTREMO') {
        if (lat === 'IZQUIERDO') {
          extremosIzq.push(p);
        } else if (lat === 'DERECHO') {
          extremosDer.push(p);
        } else {
          if (extremosIzq.length <= extremosDer.length) extremosIzq.push(p);
          else extremosDer.push(p);
        }
      } else if (pos === 'PUNTA' || pos === 'DELANTERO') {
        delanteros.push(p);
      } else {
        mediosCentro.push(p);
      }
    });

    return {
      porteros,
      centralesIzq,
      centralesDer,
      lateralesIzq,
      lateralesDer,
      mediosCentro,
      interiores,
      mediasPuntas,
      extremosIzq,
      extremosDer,
      delanteros
    };
  }, [filteredPlayers]);

  return (
    <div className="space-y-6">
      {/* 1. Panel de Filtros Superior */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-display font-bold text-xl text-gray-900 flex items-center gap-2">
              <span>🏟️</span> Campograma Táctico de Jugadores
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Visualización en terreno de juego con nombres y puntuaciones según el filtro de valoración activo.
            </p>
          </div>
          {(selectedValoracion || selectedCategoria || selectedObservador || searchQuery) && (
            <button
              onClick={() => {
                setSelectedValoracion('');
                setSelectedCategoria('');
                setSelectedObservador('');
                setSearchQuery('');
              }}
              className="text-xs text-red-600 hover:text-red-800 font-bold underline"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Filtrar por Valoración</label>
            <select
              value={selectedValoracion}
              onChange={(e) => setSelectedValoracion(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3a22] bg-emerald-50/60 text-emerald-950"
            >
              <option value="">⭐ Todas las valoraciones</option>
              <option value="FICHAR">5 · FICHAR (Prioritarios)</option>
              <option value="INTERESANTE">4 · INTERESANTE</option>
              <option value="SEGUIR VIENDO">3 · SEGUIR VIENDO</option>
              <option value="DESCARTAR">2 · DESCARTAR</option>
              <option value="SIN VER">1 · SIN VER</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Categoría</label>
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Observador</label>
            <select
              value={selectedObservador}
              onChange={(e) => setSelectedObservador(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            >
              <option value="">Todos los observadores</option>
              {OBSERVADORES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Buscar Jugador</label>
            <input
              type="text"
              placeholder="Nombre o club..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            />
          </div>
        </div>
      </div>

      {/* 2. TERRENO DE JUEGO (CANCHA DE FÚTBOL) */}
      <div className="bg-[#afd496] rounded-3xl p-4 sm:p-8 border-4 border-[#86af6e] shadow-2xl relative overflow-hidden font-sans">
        {/* Marcado de Líneas Blancas de la Cancha */}
        <div className="absolute inset-4 sm:inset-6 border-4 border-white/90 rounded-2xl pointer-events-none flex flex-col justify-between">
          {/* Área superior (Delanteros) */}
          <div className="w-full flex justify-center">
            <div className="w-2/3 sm:w-1/2 h-36 border-b-4 border-x-4 border-white/90 relative">
              <div className="w-1/2 h-14 border-b-4 border-x-4 border-white/90 mx-auto" />
            </div>
          </div>

          {/* Línea Central y Círculo Central */}
          <div className="w-full border-t-4 border-white/90 relative flex items-center justify-center">
            <div className="w-48 h-48 border-4 border-white/90 rounded-full absolute -top-24" />
            <div className="w-3 h-3 bg-white rounded-full absolute" />
          </div>

          {/* Área inferior (Portero y Centrales) */}
          <div className="w-full flex justify-center">
            <div className="w-2/3 sm:w-1/2 h-36 border-t-4 border-x-4 border-white/90 relative">
              <div className="w-1/2 h-14 border-t-4 border-x-4 border-white/90 mx-auto absolute bottom-0 left-1/4" />
            </div>
          </div>
        </div>

        {/* Contador de Jugadores en esquina superior izquierda */}
        <div className="absolute top-6 left-6 z-20 bg-black text-white px-4 py-2 rounded-xl border border-white/20 shadow-lg text-center">
          <p className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">Jugadores</p>
          <p className="text-2xl font-black leading-none">{filteredPlayers.length}</p>
        </div>

        {/* 3. CAPAS DE POSICIONES TÁCTICAS EN LA CANCHA */}
        <div className="relative z-10 grid gap-8 pt-10 pb-4 max-w-6xl mx-auto">
          {/* FILA 1: DELANTEROS (Top Center) */}
          <div className="flex justify-center">
            <PitchPositionBox title="DELANTEROS" players={pitchGroups.delanteros} width="w-full max-w-md" />
          </div>

          {/* FILA 2: EXTREMOS Y MEDIAS PUNTAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <PitchPositionBox title="EXTREMOS IZQ." players={pitchGroups.extremosIzq} />
            <PitchPositionBox title="MEDIAS PUNTAS" players={pitchGroups.mediasPuntas} />
            <PitchPositionBox title="EXTREMOS DRCH." players={pitchGroups.extremosDer} />
          </div>

          {/* FILA 3: INTERIORES */}
          <div className="flex justify-center">
            <PitchPositionBox title="INTERIORES" players={pitchGroups.interiores} width="w-full max-w-md" />
          </div>

          {/* FILA 4: LATERALES Y MEDIOS CENTRO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <PitchPositionBox title="LATERALES IZQ." players={pitchGroups.lateralesIzq} />
            <PitchPositionBox title="MEDIOS CENTRO" players={pitchGroups.mediosCentro} />
            <PitchPositionBox title="LATERALES DRCH." players={pitchGroups.lateralesDer} />
          </div>

          {/* FILA 5: CENTRALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto w-full">
            <PitchPositionBox title="CENTRALES" players={pitchGroups.centralesIzq} />
            <PitchPositionBox title="CENTRALES" players={pitchGroups.centralesDer} />
          </div>

          {/* FILA 6: PORTEROS (Bottom Center) */}
          <div className="flex justify-center pt-2">
            <PitchPositionBox title="PORTEROS" players={pitchGroups.porteros} width="w-full max-w-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Caja contenedora translúcida de cada grupo de posición táctica en el terreno */
function PitchPositionBox({
  title,
  players,
  width = 'w-full'
}: {
  title: string;
  players: PlayerSummary[];
  width?: string;
}) {
  return (
    <div
      className={`${width} bg-white/35 backdrop-blur-md rounded-2xl p-3 border border-white/50 shadow-sm transition-all hover:bg-white/45`}
    >
      <h4 className="font-display font-black text-base text-[#c81e1e] text-center uppercase tracking-wider mb-2 drop-shadow-sm">
        {title}
      </h4>

      {players.length === 0 ? (
        <p className="text-xs text-gray-700/80 italic text-center py-2 font-medium">Sin jugadores</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {players.map((p) => (
            <PitchPlayerRow key={p.playerKey} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Fila individual de jugador sobre el campograma */
function PitchPlayerRow({ player }: { player: PlayerSummary }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const path = player.foto || player.fotoUrl;
    if (!path) return;

    if (/^https?:\/\//i.test(path)) {
      setPhotoUrl(path);
      return;
    }

    const supabase = createClient();
    signedPhotoUrl(supabase, path).then((url) => {
      if (alive && url) setPhotoUrl(url);
    });

    return () => {
      alive = false;
    };
  }, [player.foto, player.fotoUrl]);

  return (
    <Link
      href={`/players/${encodeURIComponent(player.playerKey)}`}
      className="flex items-center justify-between gap-3 py-1.5 px-2 border-b border-gray-400/30 hover:bg-white/95 rounded-xl transition-all group"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gray-100 border border-white overflow-hidden flex-shrink-0 grid place-items-center shadow-sm">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-gray-500 font-bold">⚽</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-black text-sm text-gray-950 group-hover:text-[#0f3a22] truncate leading-tight">
            {player.nombre}
          </p>
          {player.club && (
            <p className="text-[11px] font-bold text-gray-700 truncate leading-none uppercase mt-0.5">
              {player.club}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center flex-shrink-0">
        <span className="font-black text-xs w-7 h-7 rounded-lg bg-[#0f3a22] text-white flex items-center justify-center shadow">
          {player.valScore}
        </span>
      </div>
    </Link>
  );
}
