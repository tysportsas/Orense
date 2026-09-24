'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  parseCSV,
  parseExcel,
  parseJSON,
  bulkInsertReports,
  generateSampleCSV,
  generateSampleJSON,
  type ParsedImportRow
} from '@/lib/importExport';

export default function ImportReportsClient() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<'file' | 'url'>('file');
  const [fileName, setFileName] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function processFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setUrlError(null);

    const ext = file.name.toLowerCase();

    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        const rows = parseExcel(buffer);
        setParsedRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        let rows: ParsedImportRow[] = [];
        if (ext.endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
          rows = parseJSON(text);
        } else {
          rows = parseCSV(text);
        }
        setParsedRows(rows);
      };
      reader.readAsText(file);
    }
  }

  async function handleFetchFromUrl() {
    if (!urlInput.trim()) return;
    setLoadingUrl(true);
    setUrlError(null);
    setResult(null);

    try {
      const res = await fetch('/api/fetch-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });

      const json = await res.json();

      if (!res.ok) {
        setUrlError(json.error || 'No se pudo descargar la información de la URL proporcionada.');
        return;
      }

      const text = json.content as string;
      let rows: ParsedImportRow[] = [];
      if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
        rows = parseJSON(text);
      } else {
        rows = parseCSV(text);
      }

      setParsedRows(rows);
      setFileName(`Enlace web (${json.targetUrl || 'Google Sheets'})`);
    } catch (err: any) {
      setUrlError('Error al conectar con la URL: ' + err.message);
    } finally {
      setLoadingUrl(false);
    }
  }

  function downloadSample(type: 'csv' | 'json') {
    const content = type === 'csv' ? generateSampleCSV() : generateSampleJSON();
    const mime = type === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
    const filename = type === 'csv' ? 'plantilla_scouting_orense.csv' : 'plantilla_scouting_orense.json';

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const validRows = parsedRows.filter((r) => r.isValid);

  async function startImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setResult(null);
    setProgress({ current: 0, total: validRows.length });

    const supabase = createClient();
    const itemsToInsert = validRows.map((r) => r.data);

    const res = await bulkInsertReports(supabase, itemsToInsert, (current, total) => {
      setProgress({ current, total });
    });

    setResult(res);
    setImporting(false);

    if (res.success > 0) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Zona de descarga de plantillas */}
      <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-gray-900">
              Plantillas de Importación
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Descarga una plantilla de ejemplo en Excel/CSV o JSON estructurada con las columnas del Método Orense.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => downloadSample('csv')}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors"
            >
              📊 Plantilla Excel / CSV (.csv)
            </button>
            <button
              type="button"
              onClick={() => downloadSample('json')}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100 transition-colors"
            >
              📄 Plantilla JSON (.json)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Modalidad de Carga (Tabs: Archivo vs Enlace / Google Sheets) */}
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveMode('file')}
            className={`pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${
              activeMode === 'file'
                ? 'border-[#0f3a22] text-[#0f3a22]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            📁 Cargar Archivo (Excel, CSV, JSON)
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('url')}
            className={`pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${
              activeMode === 'url'
                ? 'border-[#0f3a22] text-[#0f3a22]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            🔗 Pegar enlace de Google Sheets o URL web
          </button>
        </div>

        {/* MODO ARCHIVO */}
        {activeMode === 'file' && (
          <div>
            <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-emerald-700/30 rounded-2xl cursor-pointer bg-emerald-900/5 hover:bg-emerald-900/10 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <span className="text-4xl mb-2">📊</span>
                <p className="mb-1 text-sm font-semibold text-gray-800">
                  Haz clic para seleccionar o arrastra tu archivo Excel, CSV o JSON aquí
                </p>
                <p className="text-xs text-gray-500">Formatos soportados: .xlsx, .xls, .csv, .json</p>
                {fileName && activeMode === 'file' && (
                  <p className="mt-3 text-xs font-bold text-[#0f3a22] bg-white px-3 py-1 rounded-full border border-line shadow-sm">
                    Archivo seleccionado: {fileName}
                  </p>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv, .json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv, application/json"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}

        {/* MODO ENLACE / GOOGLE SHEETS */}
        {activeMode === 'url' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Pega la URL de tu **Google Sheets** o un enlace directo a un archivo CSV/JSON público.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/TU-ID-DE-HOJA/edit..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
              />
              <button
                type="button"
                onClick={handleFetchFromUrl}
                disabled={loadingUrl || !urlInput.trim()}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#0f3a22] text-white hover:bg-[#15502e] disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
              >
                {loadingUrl ? 'Cargando…' : 'Obtener datos'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              💡 Para Google Sheets: asegúrate de haber compartido el documento con la opción <em>&quot;Cualquier persona con el enlace puede ver&quot;</em>.
            </p>

            {urlError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 font-medium">
                ⚠️ {urlError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Previsualización y Inserción */}
      {parsedRows.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display font-bold text-lg text-gray-900">
                Previsualización de Registros ({parsedRows.length})
              </h3>
              <p className="text-xs text-gray-500">
                {validRows.length} registro(s) válidos listos para importar | {parsedRows.length - validRows.length} con advertencias
              </p>
            </div>

            <button
              type="button"
              onClick={startImport}
              disabled={importing || validRows.length === 0}
              className="inline-flex items-center px-6 py-2.5 rounded-full font-bold text-sm bg-green text-white shadow hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {importing
                ? `Importando (${progress?.current}/${progress?.total})…`
                : `🚀 Importar ${validRows.length} informes a Supabase`}
            </button>
          </div>

          {/* Barra de progreso si está importando */}
          {importing && progress && (
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
              <div
                className="bg-green h-full rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Resultado de la importación */}
          {result && (
            <div
              className={`p-4 rounded-xl border ${
                result.failed === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <p className="font-bold text-sm">
                ✅ Importación completada: {result.success} informe(s) insertados con éxito.
              </p>
              {result.failed > 0 && (
                <div className="mt-2 text-xs space-y-1">
                  <p className="font-semibold text-red-700">{result.failed} informe(s) no pudieron insertarse:</p>
                  <ul className="list-disc list-inside text-red-600">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Tabla de previsualización */}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase border-b border-line">
                <tr>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5">Jugador</th>
                  <th className="px-3 py-2.5">Club</th>
                  <th className="px-3 py-2.5">Cat. / Puesto</th>
                  <th className="px-3 py-2.5">Nivel</th>
                  <th className="px-3 py-2.5">Valoración</th>
                  <th className="px-3 py-2.5">Observador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {parsedRows.map((row, idx) => {
                  const d = row.data;
                  return (
                    <tr key={idx} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50/40'}>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {row.isValid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            VÁLIDO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800" title={row.error}>
                            {row.error}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">{d.nombre || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{d.club || '—'}</td>
                      <td className="px-3 py-2.5">
                        {d.categoria || '—'} {d.puesto ? `· ${d.puesto}` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 truncate max-w-[150px]">{d.tipo_informe || '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-emerald-800">{d.valoracion || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{d.observador || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
