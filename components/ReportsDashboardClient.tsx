'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReportRow } from '@/lib/reports';
import { keyOf, deleteReport } from '@/lib/reports';
import { createClient } from '@/lib/supabase/client';
import { fmtDate, LEVELS, VALORACION, CATEGORIAS, OBSERVADORES } from '@/lib/formModel';

interface Props {
  initialReports: ReportRow[];
}

export default function ReportsDashboardClient({ initialReports }: Props) {
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>(initialReports);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedObservador, setSelectedObservador] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedNivel, setSelectedNivel] = useState('');
  const [selectedValoracion, setSelectedValoracion] = useState('');

  async function handleDelete(id: string, nombre: string) {
    const confirmed = window.confirm(`¿Eliminar el informe de "${nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      await deleteReport(supabase, id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert('Error al eliminar el informe. Intenta de nuevo.');
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  // 1. Estadísticas globales (sin filtrar)
  const totalReports = reports.length;

  const uniquePlayerKeys = useMemo(() => {
    const keys = new Set<string>();
    reports.forEach(r => {
      const k = keyOf(r.data);
      if (k) keys.add(k);
    });
    return keys.size;
  }, [reports]);

  const ficharCount = useMemo(() => {
    return reports.filter(r => r.data.valoracion && String(r.data.valoracion).startsWith('5.')).length;
  }, [reports]);

  const interesanteCount = useMemo(() => {
    return reports.filter(r => r.data.valoracion && String(r.data.valoracion).startsWith('4.')).length;
  }, [reports]);

  // Distribución por nivel
  const levelDistribution = useMemo(() => {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reports.forEach(r => {
      const tipo = r.data.tipo_informe || '';
      if (tipo.includes('N1') || tipo.includes('general')) dist[1]++;
      else if (tipo.includes('N2') || tipo.includes('deportivo')) dist[2]++;
      else if (tipo.includes('N3') || tipo.includes('específico') || tipo.includes('especifico')) dist[3]++;
      else if (tipo.includes('N4') || tipo.includes('final')) dist[4]++;
      else if (tipo.includes('N5') || tipo.includes('institucional')) dist[5]++;
      else dist[1]++; // default
    });
    return dist;
  }, [reports]);

  // Distribución por valoración
  const valDistribution = useMemo(() => {
    const dist: Record<string, number> = {
      FICHAR: 0,
      INTERESANTE: 0,
      'SEGUIR VIENDO': 0,
      DESCARTAR: 0,
      OTRO: 0
    };
    reports.forEach(r => {
      const val = String(r.data.valoracion || '');
      if (val.includes('FICHAR')) dist.FICHAR++;
      else if (val.includes('INTERESANTE')) dist.INTERESANTE++;
      else if (val.includes('SEGUIR VIENDO')) dist['SEGUIR VIENDO']++;
      else if (val.includes('DESCARTAR')) dist.DESCARTAR++;
      else dist.OTRO++;
    });
    return dist;
  }, [reports]);

  // 2. Informes filtrados
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const d = r.data;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nom = (d.nombre || '').toLowerCase();
        const clb = (d.club || '').toLowerCase();
        const prt = (d.partido || '').toLowerCase();
        const obs = (d.observador || '').toLowerCase();
        const pst = (d.puesto || '').toLowerCase();
        if (!nom.includes(q) && !clb.includes(q) && !prt.includes(q) && !obs.includes(q) && !pst.includes(q)) {
          return false;
        }
      }
      if (selectedObservador && d.observador !== selectedObservador) return false;
      if (selectedCategoria && d.categoria !== selectedCategoria) return false;
      if (selectedNivel) {
        const tipo = d.tipo_informe || '';
        if (!tipo.toLowerCase().includes(selectedNivel.toLowerCase())) return false;
      }
      if (selectedValoracion && (!d.valoracion || !d.valoracion.includes(selectedValoracion))) return false;

      return true;
    });
  }, [reports, search, selectedObservador, selectedCategoria, selectedNivel, selectedValoracion]);

  // Helper de badges para valoración
  const renderValBadge = (val?: string) => {
    if (!val) return <span className="text-gray-400 text-xs">Sin valorar</span>;
    if (val.includes('FICHAR')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">5 · FICHAR</span>;
    }
    if (val.includes('INTERESANTE')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">4 · INTERESANTE</span>;
    }
    if (val.includes('SEGUIR VIENDO')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">3 · SEGUIR VIENDO</span>;
    }
    if (val.includes('DESCARTAR')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">2 · DESCARTAR</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{val}</span>;
  };

  // Helper de badge para nivel de informe
  const renderLevelBadge = (tipo?: string) => {
    if (!tipo) return <span className="text-gray-400 text-xs">Desconocido</span>;
    let bg = '#5d7a30';
    let label = tipo;
    if (tipo.includes('N1') || tipo.toLowerCase().includes('general')) { bg = '#b58a1e'; label = 'N1 General'; }
    else if (tipo.includes('N2') || tipo.toLowerCase().includes('deportivo')) { bg = '#5d7a30'; label = 'N2 Deportivo'; }
    else if (tipo.includes('N3') || tipo.toLowerCase().includes('específico') || tipo.toLowerCase().includes('especifico')) { bg = '#2e6f43'; label = 'N3 Específico'; }
    else if (tipo.includes('N4') || tipo.toLowerCase().includes('final')) { bg = '#15502e'; label = 'N4 Final'; }
    else if (tipo.includes('N5') || tipo.toLowerCase().includes('institucional')) { bg = '#0f3a22'; label = 'N5 Institucional'; }

    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: bg }}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. KPIs Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Informes</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalReports}</p>
            <p className="text-xs text-gray-500 mt-1">Registrados en la base compartida</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0f3a22]/10 text-[#0f3a22] flex items-center justify-center font-bold text-xl">
            📋
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Jugadores Únicos</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{uniquePlayerKeys}</p>
            <p className="text-xs text-gray-500 mt-1">Con al menos 1 informe</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xl">
            ⚽
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Para Fichar</p>
            <p className="text-3xl font-bold text-emerald-700 mt-1">{ficharCount}</p>
            <p className="text-xs text-emerald-600 mt-1">Valoración 5 · FICHAR</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xl">
            ⭐
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Interesantes</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{interesanteCount}</p>
            <p className="text-xs text-blue-600 mt-1">Valoración 4 · INTERESANTE</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
            👀
          </div>
        </div>
      </div>

      {/* 2. Distribución visual / Gráficos en barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Niveles */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
            <span>📊</span> Distribución por Nivel de Informe
          </h3>
          <div className="space-y-3">
            {LEVELS.map(lvl => {
              const count = levelDistribution[lvl.n] || 0;
              const pct = totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
              return (
                <div key={lvl.n} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-700 font-semibold">{lvl.short}</span>
                    <span className="text-gray-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: lvl.bg }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por Valoración */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
            <span>🎯</span> Resumen de Valoraciones
          </h3>
          <div className="space-y-3">
            {[
              { key: 'FICHAR', label: '5 · FICHAR', color: 'bg-emerald-500', count: valDistribution.FICHAR },
              { key: 'INTERESANTE', label: '4 · INTERESANTE', color: 'bg-blue-500', count: valDistribution.INTERESANTE },
              { key: 'SEGUIR VIENDO', label: '3 · SEGUIR VIENDO', color: 'bg-amber-500', count: valDistribution['SEGUIR VIENDO'] },
              { key: 'DESCARTAR', label: '2 · DESCARTAR', color: 'bg-red-500', count: valDistribution.DESCARTAR },
            ].map(item => {
              const pct = totalReports > 0 ? Math.round((item.count / totalReports) * 100) : 0;
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-700 font-semibold">{item.label}</span>
                    <span className="text-gray-500">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Barra de Búsqueda y Filtros */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg text-gray-900">
              Resumen de Informes ({filteredReports.length})
            </h3>
            <Link
              href="/reports/import"
              className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-[#0f3a22] text-white hover:bg-[#15502e] transition-colors shadow-sm"
            >
              📥 Importar datos
            </Link>
          </div>
          {(search || selectedObservador || selectedCategoria || selectedNivel || selectedValoracion) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedObservador('');
                setSelectedCategoria('');
                setSelectedNivel('');
                setSelectedValoracion('');
              }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Búsqueda por texto */}
          <div className="lg:col-span-1">
            <input
              type="text"
              placeholder="Buscar jugador, club..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            />
          </div>

          {/* Filtro Observador */}
          <div>
            <select
              value={selectedObservador}
              onChange={e => setSelectedObservador(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            >
              <option value="">Todos los observadores</option>
              {OBSERVADORES.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Filtro Categoría */}
          <div>
            <select
              value={selectedCategoria}
              onChange={e => setSelectedCategoria(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Nivel */}
          <div>
            <select
              value={selectedNivel}
              onChange={e => setSelectedNivel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            >
              <option value="">Todos los niveles</option>
              <option value="N1">N1 General</option>
              <option value="N2">N2 Deportivo</option>
              <option value="N3">N3 Específico</option>
              <option value="N4">N4 Final</option>
              <option value="N5">N5 Institucional</option>
            </select>
          </div>

          {/* Filtro Valoración */}
          <div>
            <select
              value={selectedValoracion}
              onChange={e => setSelectedValoracion(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
            >
              <option value="">Todas las valoraciones</option>
              <option value="FICHAR">5 · FICHAR</option>
              <option value="INTERESANTE">4 · INTERESANTE</option>
              <option value="SEGUIR VIENDO">3 · SEGUIR VIENDO</option>
              <option value="DESCARTAR">2 · DESCARTAR</option>
            </select>
          </div>
        </div>

        {/* 4. Tabla de Informes */}
        {filteredReports.length === 0 ? (
          <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-lg font-semibold">No se encontraron informes</p>
            <p className="text-sm text-gray-400 mt-1">Prueba cambiando los criterios de búsqueda o filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Puesto / Cat.</th>
                  <th className="px-4 py-3">Tipo de Informe</th>
                  <th className="px-4 py-3">Valoración</th>
                  <th className="px-4 py-3">Observador</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredReports.map(r => {
                  const d = r.data;
                  const pKey = keyOf(d);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {fmtDate(d.fpartido || r.created_at.slice(0, 10))}
                      </td>

                      <td className="px-4 py-3.5">
                        <Link
                          href={`/players/${encodeURIComponent(pKey)}`}
                          className="font-bold text-gray-900 hover:text-[#0f3a22] transition-colors"
                        >
                          {d.nombre || 'Sin nombre'}
                        </Link>
                        {d.club && (
                          <div className="text-xs text-gray-500 mt-0.5">{d.club}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-gray-800">{d.puesto || 'N/D'}</span>
                        {d.categoria && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">
                            {d.categoria}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderLevelBadge(d.tipo_informe)}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderValBadge(d.valoracion)}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                        {d.observador || '—'}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                        <Link
                          href={`/reports/${r.id}/edit`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
                        >
                          Editar / Ver
                        </Link>
                        <Link
                          href={`/players/${encodeURIComponent(pKey)}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0f3a22] hover:bg-[#15502e] text-white transition-colors"
                        >
                          Tablero
                        </Link>
                        <button
                          onClick={() => handleDelete(r.id, d.nombre || 'jugador')}
                          disabled={deletingId === r.id}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors disabled:opacity-50"
                          title="Eliminar informe"
                        >
                          {deletingId === r.id ? (
                            <span className="animate-pulse">...</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
