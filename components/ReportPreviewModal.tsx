'use client';

import { useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import RadarChart from './RadarChart';
import { fmtDate, LEVELS } from '@/lib/formModel';

interface MatchCard {
  id: string;
  lv?: string;
  partido?: string;
  fpartidoLabel: string;
  categoria?: string;
  club?: string;
  observador?: string;
  link1?: string;
  link2?: string;
  val_partido: string;
  val_proy: string;
  valoracion?: string;
  avg: number | null;
}

interface Group {
  id: string;
  title: string;
  series: { id: string; label: string; axes: { label: string; value: number; text: string }[]; nivel?: string }[];
}

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  nombre: string;
  foto?: string;
  fotoUrl?: string;
  base: [string, string][];
  kpis: [string, string][];
  matchCards: MatchCard[];
  groups: Group[];
}

function Badge({ v }: { v?: string }) {
  if (!v) return null;
  const n = v.charAt(0);
  const label = v.replace(/^\d\./, '');
  return <span className={`badge v${n}`}>{label.charAt(0) + label.slice(1).toLowerCase()}</span>;
}

function matchTitle(value?: string) {
  const title = String(value ?? '').trim();
  return !title || /^\d+(?:[.,]\d+)?$/.test(title) ? 'Sin partido' : title;
}

function validExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function externalLinkLabel(value: string, fallback: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('transfermarkt')) return 'Transfermarkt';
    if (host.includes('besoccer')) return 'BeSoccer';
    return host || fallback;
  } catch {
    return fallback;
  }
}

export default function ReportPreviewModal({
  isOpen,
  onClose,
  reportId,
  nombre,
  foto,
  fotoUrl,
  base,
  kpis,
  matchCards,
  groups
}: ReportPreviewModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  async function handleDownloadPDF() {
    try {
      if (!contentRef.current) return;

      const options = {
        margin: [5, 5, 5, 5] as [number, number, number, number],
        filename: `informe-${nombre.replace(/\s+/g, '_')}-${reportId.slice(0, 8)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: { scale: 1.2, allowTaint: true, useCORS: true, logging: false },
        jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const, compress: true },
        pagebreak: { mode: 'css' as const, before: ['section'] },
        useCORS: true,
        letterRendering: true
      };

      html2pdf().set(options).from(contentRef.current).save();
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Error al generar el PDF. Intenta de nuevo.');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-2xl font-bold text-gray-900">Vista previa del informe</h2>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors"
              title="Descargar informe como PDF"
            >
              ⬇️ Descargar PDF
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="px-3 py-4 max-h-[calc(100vh-200px)] overflow-y-auto bg-white">
          {/* Header con Logo */}
          <div className="mb-4 pb-3 border-b-2 border-emerald-900">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-shrink-0">
                <img 
                  src="/orense-crest.png" 
                  alt="Escudo Orense" 
                  className="h-16 w-16 object-contain"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-emerald-900">SECRETARÍA TÉCNICA</h1>
                <p className="text-gray-600 text-xs mt-0.5">Método Orense de Scouting</p>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="text-gray-600">Generado: {new Date().toLocaleDateString('es-ES')}</p>
              <p className="text-gray-600">Hora: {new Date().toLocaleTimeString('es-ES')}</p>
            </div>
          </div>

          {/* Resumen biográfico */}
          <section className="mb-6 page-break-inside-avoid">
            <div className="mb-3">
              <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">📋 Resumen Biográfico</h2>
              <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex gap-2 flex-wrap items-start">
              {foto || fotoUrl ? (
                <div className="w-16 h-20 bg-gray-300 rounded-lg flex-none flex items-center justify-center text-xs text-gray-600">
                  [Foto]
                </div>
              ) : (
                <span className="w-16 h-20 rounded-lg bg-gray-300 grid place-items-center font-bold text-lg text-gray-600 flex-none">
                  {nombre.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}
                </span>
              )}
              <div className="flex-1 min-w-[200px]">
                <h3 className="text-lg font-bold text-gray-900">{nombre}</h3>
                <dl className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  {base.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-600">{k}</dt>
                      <dd className="font-medium text-gray-900 text-sm">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2">
                  {kpis.map(([v, l]) => (
                    <div key={l} className="bg-white border border-gray-200 rounded px-2 py-1 text-xs">
                      {l === 'Valoración actual' ? (
                        <Badge v={v} />
                      ) : (
                        <b className="font-bold text-base block text-gray-900">{v}</b>
                      )}
                      <span className="text-xs text-gray-600">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Informes deportivos */}
          {matchCards.length > 0 && (
            <section className="mb-6 page-break-inside-avoid">
              <div className="mb-3">
                <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">⚽ Informes Deportivos por Partido</h2>
                <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {matchCards.map((c) => (
                  <article key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2 grid gap-1 text-xs">
                    <div className="flex justify-between gap-2 items-start">
                      <div>
                        <div className="text-xs text-gray-600">
                          {c.fpartidoLabel}, {c.lv || 'Sin nivel'}
                        </div>
                        <h3 className="font-bold text-base text-gray-900">{matchTitle(c.partido)}</h3>
                      </div>
                      <Badge v={c.valoracion} />
                    </div>
                    <div className="text-xs text-gray-600">
                      {[c.categoria, c.club, c.observador && 'Observador ' + c.observador].filter(Boolean).join(', ')}
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div className="bg-white rounded px-1 py-0.5 border border-gray-200">
                        <small className="block text-gray-600 text-xs">Partido</small>
                        <b className="text-gray-900 text-xs">{c.val_partido || 'Sin dato'}</b>
                      </div>
                      <div className="bg-white rounded px-1 py-0.5 border border-gray-200">
                        <small className="block text-gray-600 text-xs">Proyección</small>
                        <b className="text-gray-900 text-xs">{c.val_proy || 'Sin dato'}</b>
                      </div>
                      <div className="bg-white rounded px-1 py-0.5 border border-gray-200">
                        <small className="block text-gray-600 text-xs">Atributos</small>
                        <b className="text-gray-900 text-xs">{c.avg != null ? `${c.avg.toFixed(1)}/5` : 'Sin dato'}</b>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="text-xs text-gray-600">Enlaces</span>
                      {validExternalUrl(c.link1) && (
                        <a
                          href={validExternalUrl(c.link1)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-emerald-700 underline"
                        >
                          {externalLinkLabel(c.link1!, 'Enlace 1')}
                        </a>
                      )}
                      {validExternalUrl(c.link2) && (
                        <a
                          href={validExternalUrl(c.link2)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-emerald-700 underline"
                        >
                          {externalLinkLabel(c.link2!, 'Enlace 2')}
                        </a>
                      )}
                      {!validExternalUrl(c.link1) && !validExternalUrl(c.link2) && (
                        <span className="text-xs text-gray-600">Sin enlaces registrados</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Gráficos de araña */}
          {groups.length > 0 && (
            <section className="mb-6 page-break-inside-avoid">
              <div className="mb-3">
                <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">📊 Análisis de Atributos (Gráficos)</h2>
                <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.map((g) => (
                  <div key={g.id} className="space-y-1">
                    <h3 className="font-bold text-sm text-emerald-900 bg-emerald-50 p-1.5 rounded border-l-4 border-yellow-500">
                      {g.title}
                    </h3>
                    {g.series.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                        <div className="text-xs font-semibold text-gray-700 mb-1 p-1 bg-white rounded border-l-2 border-emerald-600">
                          📅 {g.series[0].label}
                        </div>
                        <div style={{ width: '100%', height: '200px', marginTop: '8px' }}>
                          <RadarChart axes={g.series[0].axes} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="mt-4 pt-2 border-t-2 border-emerald-900 space-y-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-emerald-900 mb-1">INFORMACIÓN DEL DOCUMENTO</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-700">
                <div>
                  <span className="font-semibold text-gray-900">ID:</span>
                  <code className="block bg-white px-1 py-0.5 rounded mt-0.5 font-mono text-gray-600 text-xs">{reportId.slice(0, 12)}</code>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Jugador:</span>
                  <p className="block text-gray-700 mt-0.5 text-xs">{nombre}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center py-1">
              Generado por <strong>Método Orense de Scouting</strong>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            ⬇️ Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
