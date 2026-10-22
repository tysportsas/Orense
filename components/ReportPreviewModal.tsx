'use client';

import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import RadarChart from './RadarChart';
import PositionPitch from './PositionPitch';
import RatingsAverageChart from './RatingsAverageChart';
import { createClient } from '@/lib/supabase/client';
import { signedPhotoUrl } from '@/lib/reports';
import { fmtDate, LEVELS } from '@/lib/formModel';

interface MatchCard {
  id: string;
  lv?: string;
  partido?: string;
  fpartidoLabel: string;
  fpartido?: string;
  categoria?: string;
  club?: string;
  observador?: string;
  link1?: string;
  link2?: string;
  val_partido: string;
  val_proy: string;
  valoracion?: string;
  avg: number | null;
  notes?: { label: string; text: string }[];
}

interface Group {
  id: string;
  title: string;
  series: { id: string; label: string; axes: { label: string; value: number; text: string }[]; nivel?: string; obs?: { label: string; text: string }[] }[];
}

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  nombre: string;
  foto?: string;
  fotoUrl?: string;
  puesto?: string;
  lateralidad?: string;
  posX?: number;
  posY?: number;
  base: [string, string][];
  kpis: [string, string][];
  carac?: { puesto: string; titulo: string; desc: string; obs: string } | null;
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

function waitForImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll('img'));
  return Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
        setTimeout(() => resolve(), 3000);
      });
    })
  );
}

// Eliminado drawPhotoOnCanvas porque ya no usamos canvas

export default function ReportPreviewModal({
  isOpen,
  onClose,
  reportId,
  nombre,
  foto,
  fotoUrl,
  puesto,
  lateralidad,
  posX,
  posY,
  base,
  kpis,
  carac,
  matchCards,
  groups
}: ReportPreviewModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  // Refs para leer estado actual sin stale closure en callbacks asíncronos
  const photoLoadingRef = useRef(false);
  const photoRef = useRef<string | null>(null);           // siempre el dataUrl más reciente

  function setPhotoLoadingSync(val: boolean) {
    photoLoadingRef.current = val;
    setPhotoLoading(val);
  }

  useEffect(() => {
    let alive = true;

    async function resolvePhoto() {
      // Sin foto registrada → salir sin mostrar indicador de carga
      if (!foto && !fotoUrl) {
        if (alive) setPhoto(null);
        return;
      }

      if (alive) setPhotoLoadingSync(true);

      try {
        // Usamos el proxy server-side /api/photo-proxy para obtener la imagen
        // como base64 data URL, evitando completamente los bloqueos de CORS
        // que html2canvas sufre al intentar renderizar imágenes externas.
        let proxyUrl: string;
        if (foto) {
          proxyUrl = `/api/photo-proxy?path=${encodeURIComponent(foto)}`;
        } else {
          proxyUrl = `/api/photo-proxy?url=${encodeURIComponent(fotoUrl!)}`;
        }

        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
        const { dataUrl, error } = await res.json();
        if (error || !dataUrl) throw new Error(error || 'Sin dataUrl en respuesta');

        if (alive) { photoRef.current = dataUrl; setPhoto(dataUrl); }
      } catch (err) {
        console.warn('[ReportPreviewModal] Error al obtener foto via proxy:', err);
        // Fallback: intentar URL directa (puede no funcionar en el PDF pero sí en preview)
        if (alive) {
          if (foto) {
            const supabase = createClient();
            const directUrl = await signedPhotoUrl(supabase, foto);
            photoRef.current = directUrl;
            setPhoto(directUrl);
          } else if (fotoUrl) {
            photoRef.current = fotoUrl;
            setPhoto(fotoUrl);
          } else {
            photoRef.current = null;
            setPhoto(null);
          }
        }
      } finally {
        if (alive) setPhotoLoadingSync(false);
      }
    }

    resolvePhoto();
    return () => {
      alive = false;
    };
  }, [foto, fotoUrl]);



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
    const el = contentRef.current;
    if (!el) return;

    // Si la foto aún se está resolviendo (signedPhotoUrl / fetch a dataUrl),
    // esperar hasta 8 s para no capturar el PDF con la foto en blanco.
    // Usamos la ref para evitar el bug de closure stale con el estado de React.
    if (photoLoadingRef.current) {
      await new Promise<void>((resolve) => {
        const deadline = Date.now() + 8000;
        const check = () => {
          if (!photoLoadingRef.current) return resolve();
          if (Date.now() >= deadline) {
            console.warn('Timeout esperando la foto; el PDF puede no incluirla.');
            return resolve();
          }
          setTimeout(check, 100);
        };
        check();
      });
    }



    // Expandir para captura completa
    const originalMaxHeight = el.style.maxHeight;
    const originalOverflowY = el.style.overflowY;
    el.style.maxHeight = 'none';
    el.style.overflowY = 'visible';

    try {
      // Esperar a que todas las imágenes estáticas (logo, etc.) estén cargadas.
      await waitForImages(el);

      el.scrollTop = 0;
      // Solo para el PDF: radar comparativo compacto para que el bloque quepa en la hoja 1.
      const cmp = Array.from(el.querySelectorAll<HTMLElement>('.cmp-radar'));
      const prevMax = cmp.map((n) => n.style.maxWidth);
      cmp.forEach((n) => (n.style.maxWidth = '300px'));
      // El selector de informes es interactivo y la leyenda ya los identifica.
      el.querySelectorAll<HTMLElement>('.pdf-chips').forEach((n) => (n.style.display = 'none'));
      const base = el.getBoundingClientRect().top;
      const width = el.scrollWidth;
      // Zonas que no deben partirse entre páginas (en píxeles CSS relativos al contenido).
      const zones: [number, number][] = [];
      el.querySelectorAll<HTMLElement>('.pdf-avoid').forEach((n) => {
        const r = n.getBoundingClientRect();
        zones.push([r.top - base, r.bottom - base]);
      });
      // Los títulos de sección se mantienen unidos al contenido que sigue.
      el.querySelectorAll<HTMLElement>('.pdf-head').forEach((n) => {
        const r = n.getBoundingClientRect();
        zones.push([r.top - base, r.bottom - base + 70]);
      });

      const scale = 2;
      const canvas = await html2canvas(el, {
        scale,
        useCORS: false,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (doc: Document) => {
          // html2canvas desplaza el texto hacia abajo en cajas flex con bordes redondeados: se centra con block + line-height.
          const st = doc.createElement('style');
          st.textContent = `
            .badge { display: inline-block !important; padding: 0 14px !important; line-height: 26px !important; height: 26px; text-align: center; vertical-align: middle; }
            .pdf-center { display: block !important; text-align: center; }
          `;
          doc.head.appendChild(st);
        },
        windowWidth: width,
        windowHeight: el.scrollHeight
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const mx = 6, my = 8;
      const mmPerPx = (pageW - 2 * mx) / width; // mm por píxel CSS
      const pagePx = (pageH - 2 * my) / mmPerPx; // alto útil de página en píxeles CSS
      const totalPx = canvas.height / scale;

      let y = 0;
      let first = true;
      while (y < totalPx - 1) {
        let end = Math.min(y + pagePx, totalPx);
        if (end < totalPx) {
          for (let guard = 0; guard < 20; guard++) {
            const z = zones.find(([t, b]) => t > y + 40 && t < end && b > end);
            if (!z) break;
            end = z[0];
          }
        }
        const sliceH = Math.max(1, Math.round((end - y) * scale));
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, Math.round(y * scale), canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', mx, my, pageW - 2 * mx, (sliceH / scale) * mmPerPx, undefined, 'FAST');
        y = end;
      }
      cmp.forEach((n, i) => (n.style.maxWidth = prevMax[i]));
      pdf.save(`informe-${nombre.replace(/\s+/g, '_')}-${reportId.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      el.querySelectorAll<HTMLElement>('.cmp-radar').forEach((n) => (n.style.maxWidth = ''));
      el.querySelectorAll<HTMLElement>('.pdf-chips').forEach((n) => (n.style.display = ''));
      el.style.maxHeight = originalMaxHeight;
      el.style.overflowY = originalOverflowY;
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
              disabled={photoLoading}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors disabled:opacity-60 disabled:cursor-wait"
              title={photoLoading ? 'Preparando foto...' : 'Descargar informe como PDF'}
            >
              {photoLoading ? '⏳ Preparando...' : '⬇️ Descargar PDF'}
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
          <div className="mb-4 pb-3 border-b-2 border-emerald-900 pdf-avoid">
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
          <section className="mb-6">
            <div className="mb-3 pdf-head">
              <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">📋 Resumen Biográfico</h2>
              <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex gap-2 flex-wrap items-start">
              {photo ? (
                <div
                  style={{
                    backgroundImage: `url(${photo})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'top center',
                  }}
                  className="w-16 h-20 rounded-lg flex-shrink-0"
                  title={nombre}
                />
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
              <PositionPitch puesto={puesto} lateralidad={lateralidad} posX={posX} posY={posY} />
            </div>
            {carac && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2 text-xs">
                <p className="font-bold text-emerald-900 uppercase">Caracterización de {carac.puesto}</p>
                <p className="mt-0.5 text-gray-800">
                  <b>{carac.titulo}</b>
                  {carac.desc && <span className="text-gray-600"> — {carac.desc}</span>}
                </p>
                {carac.obs && (
                  <p className="mt-1 text-gray-700 whitespace-pre-line">
                    <b>Observación (informe N1): </b>
                    {carac.obs}
                  </p>
                )}
              </div>
            )}
          </section>

          {matchCards.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 pdf-head">
                <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">📊 Comparativo de informes</h2>
                <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
              </div>
              <div className="[&_.cmp-radar]:max-w-[440px] [&_.cmp-radar]:mx-auto">
                <RatingsAverageChart cards={matchCards} groups={groups} />
              </div>
            </section>
          )}

          {/* Informes deportivos */}
          {matchCards.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 pdf-head">
                <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">⚽ Informes Deportivos por Partido</h2>
                <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {matchCards.map((c) => (
                  <article key={c.id} className="pdf-avoid bg-gray-50 border border-gray-200 rounded-lg p-2 grid gap-1 text-xs">
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
                    {c.lv !== 'N5 Institucional' && (
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
                    )}
                    {c.notes?.map((o, i) => (
                      <p key={i} className="text-xs text-gray-700 bg-white rounded border border-gray-200 p-1.5 whitespace-pre-line">
                        <b>{o.label}: </b>
                        {o.text}
                      </p>
                    ))}
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
            <section className="mb-6">
              <div className="mb-3 pdf-head">
                <h2 className="text-lg font-bold text-emerald-900 uppercase tracking-wide">📊 Análisis de Atributos (Gráficos)</h2>
                <div className="h-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full mt-1 mb-2"></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.map((g) => (
                  <div key={g.id} className="space-y-1 pdf-avoid">
                    <h3 className="font-bold text-sm text-emerald-900 bg-emerald-50 p-1.5 rounded border-l-4 border-yellow-500">
                      {g.title}
                    </h3>
                    {g.series.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                        <div className="text-xs font-semibold text-gray-700 mb-1 p-1 bg-white rounded border-l-2 border-emerald-600">
                          📅 {g.series[0].label}
                        </div>
                        <div style={{ width: '100%', marginTop: '8px' }}>
                          <RadarChart axes={g.series[0].axes} />
                        </div>
                        {g.series[0].obs?.map((o, i) => (
                          <p key={i} className="text-xs text-gray-700 mt-1 bg-white rounded border border-gray-200 p-1.5 whitespace-pre-line">
                            <b>{o.label}: </b>
                            {o.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="mt-4 pt-2 border-t-2 border-emerald-900 space-y-1 pdf-avoid">
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
            disabled={photoLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {photoLoading ? '⏳ Preparando...' : '⬇️ Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
