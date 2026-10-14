// lib/importExport.ts
//
// Utilidades para importar y exportar informes masivamente en formato CSV, Excel (.xlsx, .xls) o JSON.

import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { canonicalReportFieldKey, excelSerialDate, normalizeReportData, norm, type ReportData } from './formModel';
import { createReport, listAllReports, updateReport, type ReportRow } from './reports';

export interface ParsedImportRow {
  data: ReportData;
  isValid: boolean;
  error?: string;
}

function setImportedValue(rowData: ReportData, key: string, value: unknown) {
  const text = String(value ?? '').trim();
  if (!text || !key) return;

  if (key === 'partido') {
    const date = excelSerialDate(value);
    if (date) {
      rowData.fpartido = rowData.fpartido || date;
      return;
    }
  }

  // Evita que dos columnas distintas mal clasificadas con la misma clave
  // (p. ej. "Valor del partido" y "Partido visto" cayendo ambas en "partido")
  // se sobrescriban entre sí; conserva el primer valor recibido.
  if (rowData[key] != null && rowData[key] !== '') return;

  rowData[key] = key === 'fnac' || key === 'fpartido' ? excelSerialDate(value) ?? text : text;
}


/** Mapeador de columnas comunes de CSV/Excel a las claves internas del Método Orense */
const HEADER_MAP: Record<string, string> = {
  nombre: 'nombre',
  nombre_jugador: 'nombre',
  jugador: 'nombre',
  fnac: 'fnac',
  fecha_nacimiento: 'fnac',
  fecha_nac: 'fnac',
  nacimiento: 'fnac',
  nacionalidad: 'nacionalidad',
  altura: 'altura',
  lateralidad: 'lateralidad',
  club: 'club',
  partido: 'partido',
  partido_visto: 'partido',
  fpartido: 'fpartido',
  fecha_partido: 'fpartido',
  visualizacion: 'visualizacion',
  rol: 'rol',
  categoria: 'categoria',
  categoria_vista: 'categoria',
  tipo_informe: 'tipo_informe',
  tipo: 'tipo_informe',
  nivel: 'tipo_informe',
  observador: 'observador',
  lugar_nac: 'lugar_nac',
  lugar_nacimiento: 'lugar_nac',
  puesto: 'puesto',
  puesto_especifico: 'puesto',
  val_partido: 'val_partido',
  valoracion_partido: 'val_partido',
  importancia_partido: 'val_partido',
  relevancia_partido: 'val_partido',
  impacto_partido: 'val_partido',
  importancia_del_partido: 'val_partido',
  relevancia_del_partido: 'val_partido',
  value_match: 'val_partido',
  match_importance: 'val_partido',
  val_proy: 'val_proy',
  valoracion_proyeccion: 'val_proy',
  valoracion: 'valoracion',
  valoracion_final: 'valoracion',
  agente: 'agente',
  link1: 'link1',
  link2: 'link2',
  fortalezas: 'fortalezas',
  oportunidades: 'oportunidades',
  obs_generales: 'obs_generales',
  foto_url: 'foto_url'
};

/** Resuelve de forma inteligente el nombre de columna de Excel/CSV a la clave del formulario */
export function mapHeaderToFieldKey(rawHeader: string): string {
  if (!rawHeader) return '';
  const clean = rawHeader
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9_]/g, '_');

  const legacyField = canonicalReportFieldKey(clean);
  if (legacyField !== clean) return legacyField;

  // Si existe coincidencia exacta
  if (HEADER_MAP[clean]) return HEADER_MAP[clean];

  // Reglas difusas por patrones comunes
  if (
    clean.startsWith('nombre') ||
    clean.includes('nombre_del_jugador') ||
    clean.includes('nombre_jugador') ||
    clean.includes('primer_nombre') ||
    clean === 'jugador'
  ) {
    return 'nombre';
  }

  if (clean.includes('fecha_de_nacimiento') || clean.includes('fecha_nac') || clean === 'fnac' || clean === 'nacimiento') {
    return 'fnac';
  }

  if (/^fecha_(?:de_|del_)?partido/.test(clean) || clean === 'fpartido') {
    return 'fpartido';
  }

  if (clean.includes('valoracion_del_partido') || clean.includes('val_partido') || clean.includes('valor_del_partido') || clean.includes('valor_partido') || clean.includes('importancia_del_partido') || clean.includes('importancia_partido') || clean.includes('relevancia_del_partido') || clean.includes('relevancia_partido')) {
    return 'val_partido';
  }

  if (clean.startsWith('valoracion') && clean.includes('partido')) {
    return 'val_partido';
  }

  if (clean.includes('proyeccion') || clean.includes('val_proy')) {
    return 'val_proy';
  }

  if (clean === 'valoracion' || clean.startsWith('valoracion') || clean.includes('valoracion_final')) {
    return 'valoracion';
  }

  if (clean.includes('puesto') || clean.includes('posicion')) {
    return 'puesto';
  }

  if (clean.includes('categoria')) {
    return 'categoria';
  }

  if (clean.includes('tipo_de_informe') || clean.includes('tipo_informe') || clean.includes('nivel')) {
    return 'tipo_informe';
  }

  if (clean.includes('observador') || clean.includes('scout')) {
    return 'observador';
  }

  if (clean.includes('club') || clean.includes('equipo')) {
    return 'club';
  }

  if (clean.includes('partido')) {
    return 'partido';
  }

  if (clean.includes('nacionalidad')) {
    return 'nacionalidad';
  }

  if (clean.includes('altura')) {
    return 'altura';
  }

  if (clean.includes('lateralidad')) {
    return 'lateralidad';
  }

  if (clean.includes('lugar_de_nacimiento') || clean.includes('lugar_nac') || clean.includes('canton') || clean.includes('ciudad')) {
    return 'lugar_nac';
  }

  return clean;
}

/** Procesa el contenido de un archivo CSV (soporta comas o punto y coma como delimitador) */
export function parseCSV(text: string): ParsedImportRow[] {
  const records = parseCSVRecords(text.replace(/^\uFEFF/, ''));
  if (records.length < 2) return [];

  const mappedHeaders = records[0].map((h) => mapHeaderToFieldKey(h.replace(/\s+/g, ' ').trim()));

  // Las columnas "OBSERVACION" se repiten en la hoja: la que sigue a una posición
  // (ARQUERO, CENTRAL, ...) es la observación de esa caracterización.
  mappedHeaders.forEach((key, idx) => {
    if (key !== 'observacion' && key !== 'obsercacion') return;
    const previous = mappedHeaders[idx - 1] ?? '';
    const position = previous.match(/^car_([A-Z]+)$/);
    if (position) mappedHeaders[idx] = `car_obs_${position[1]}`;
  });
  const results: ParsedImportRow[] = [];

  for (const values of records.slice(1)) {
    if (values.every((v) => !v.trim())) continue;

    const rowData: ReportData = {};
    mappedHeaders.forEach((key, idx) => {
      if (values[idx] !== undefined) setImportedValue(rowData, key, values[idx]);
    });

    if (!rowData.observador) {
      rowData.observador = 'SECRETARÍA TÉCNICA';
    }

    if (!rowData.tipo_informe) {
      rowData.tipo_informe = 'INFORME GENERAL DESCRIPTIVO – RECIÉN CONOCIDO – PRIMER INFORME';
    }

    let error: string | undefined;
    if (!rowData.nombre) {
      error = 'Falta el nombre del jugador';
    }

    results.push({ data: rowData, isValid: !error, error });
  }

  return results;
}

/** Lee registros CSV completos: respeta comillas dobles, comillas escapadas y saltos de línea dentro de una celda. */
function parseCSVRecords(text: string): string[][] {
  const firstLineEnd = text.search(/\r?\n/);
  const firstLine = firstLineEnd < 0 ? text : text.slice(0, firstLineEnd);
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

/** Procesa el contenido de un archivo de Excel (.xlsx, .xls) a partir de su ArrayBuffer */
export function parseExcel(arrayBuffer: ArrayBuffer): ParsedImportRow[] {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    return rawRows.map((row) => {
      const rowData: ReportData = {};
      Object.keys(row).forEach((rawKey) => {
        const targetKey = mapHeaderToFieldKey(rawKey);
        setImportedValue(rowData, targetKey, row[rawKey]);
      });

      // Default para observador si no vino especificado
      if (!rowData.observador) {
        rowData.observador = 'SECRETARÍA TÉCNICA';
      }

      // Default para tipo de informe si no vino especificado
      if (!rowData.tipo_informe) {
        rowData.tipo_informe = 'INFORME GENERAL DESCRIPTIVO – RECIÉN CONOCIDO – PRIMER INFORME';
      }

      let error: string | undefined;
      if (!rowData.nombre) {
        error = 'Falta el nombre del jugador';
      }

      return {
        data: rowData,
        isValid: !error,
        error
      };
    });
  } catch (e: any) {
    return [{ data: {}, isValid: false, error: 'Error al leer el archivo Excel: ' + e.message }];
  }
}

/** Procesa el contenido de un archivo JSON */
export function parseJSON(text: string): ParsedImportRow[] {
  try {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list.map((item) => {
      if (typeof item !== 'object' || !item) {
        return { data: {}, isValid: false, error: 'Elemento JSON no válido' };
      }
      const data: ReportData = {};
      Object.keys(item).forEach((rawKey) => {
        const targetKey = mapHeaderToFieldKey(rawKey);
        if (item[rawKey] !== undefined && item[rawKey] !== null && targetKey) {
                data[targetKey] = item[rawKey];
        }
      });

      if (!data.observador) {
        data.observador = 'SECRETARÍA TÉCNICA';
      }
      if (!data.tipo_informe) {
        data.tipo_informe = 'INFORME GENERAL DESCRIPTIVO – RECIÉN CONOCIDO – PRIMER INFORME';
      }

      let error: string | undefined;
      if (!data.nombre) {
        error = 'Falta el nombre del jugador';
      }

      return {
        data,
        isValid: !error,
        error
      };
    });
  } catch (e: any) {
    return [{ data: {}, isValid: false, error: 'Formato JSON inválido: ' + e.message }];
  }
}

export interface BulkImportResult {
  success: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const isBlank = (value: unknown) => value == null || String(value).trim() === '';

function importIdentity(data: ReportData): string {
  return [norm(data.nombre || ''), data.fnac || '', norm(data.partido || ''), data.fpartido || ''].join('|');
}

/** Completa solo los campos vacíos del informe existente con los datos importados. */
function fillMissingFields(existing: ReportData, incoming: ReportData): ReportData | null {
  const merged = { ...existing };
  let changed = false;
  for (const [key, value] of Object.entries(incoming)) {
    if (!isBlank(value) && isBlank(merged[key])) {
      merged[key] = value;
      changed = true;
    }
  }
  return changed ? merged : null;
}

/**
 * Importa informes sin duplicar: si ya existe uno con el mismo jugador, fecha de
 * nacimiento y partido, solo completa sus campos vacíos; si no, lo inserta.
 */
export async function bulkInsertReports(
  supabase: SupabaseClient,
  items: ReportData[],
  onProgress?: (current: number, total: number) => void
): Promise<BulkImportResult> {
  const result: BulkImportResult = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  const existingByPlayerMatch = new Map<string, ReportRow[]>();
  try {
    for (const report of await listAllReports(supabase)) {
      const looseKey = `${norm(report.data.nombre || '')}|${report.data.fnac || ''}|${norm(report.data.partido || '')}`;
      existingByPlayerMatch.set(looseKey, [...(existingByPlayerMatch.get(looseKey) ?? []), report]);
    }
  } catch (error: any) {
    return {
      ...result,
      failed: items.length,
      errors: [`No se pudieron leer los informes existentes; no se importó nada para evitar duplicados: ${error.message || 'Error desconocido'}`]
    };
  }

  const toInsert: ReportData[] = [];
  const seenInFile = new Set<string>();
  let processed = 0;

  for (const raw of items) {
    const item = normalizeReportData(raw);
    const identity = importIdentity(item);
    processed++;

    if (seenInFile.has(identity)) {
      result.skipped++;
      continue;
    }
    seenInFile.add(identity);

    const looseKey = `${norm(item.nombre || '')}|${item.fnac || ''}|${norm(item.partido || '')}`;
    const candidates = existingByPlayerMatch.get(looseKey) ?? [];

    if (candidates.length === 0) {
      toInsert.push(item);
      continue;
    }

    // Si ya hay varios informes iguales en la base, se completan todos en lugar de crear otro.
    let touched = false;
    for (const existing of candidates) {
      const merged = fillMissingFields(existing.data, item);
      if (!merged) continue;
      touched = true;
      try {
        await updateReport(supabase, existing.id, merged);
        result.updated++;
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Error al actualizar a ${item.nombre || 'registro'}: ${error.message || 'Error desconocido'}`);
      }
    }
    if (!touched) result.skipped++;
    onProgress?.(processed, items.length);
  }

  const batchSize = 100;
  for (let start = 0; start < toInsert.length; start += batchSize) {
    const batch = toInsert.slice(start, start + batchSize);
    const { error } = await supabase.from('reports').insert(batch.map((data) => ({ data, created_by: null })));
    if (!error) {
      result.success += batch.length;
    } else {
      for (const item of batch) {
        try {
          await createReport(supabase, item);
          result.success++;
        } catch (itemError: any) {
          result.failed++;
          result.errors.push(`Error al insertar a ${item.nombre || 'registro'}: ${itemError.message || 'Error desconocido'}`);
        }
      }
    }
    onProgress?.(Math.min(items.length, processed), items.length);
  }

  return result;
}

/** Genera el contenido de la plantilla de ejemplo en formato CSV */
export function generateSampleCSV(): string {
  const headers = [
    'NOMBRE (ÚNICAMENTE PRIMER NOMBRE Y PRIMER APELLIDO, EN MAYÚSCULAS, SIN TILDE SIN PUNTOS)',
    'fnac',
    'nacionalidad',
    'altura',
    'lateralidad',
    'club',
    'partido',
    'fpartido',
    'visualizacion',
    'rol',
    'categoria',
    'tipo_informe',
    'observador',
    'puesto',
    'val_partido',
    'val_proy',
    'valoracion'
  ];

  const sampleRows = [
    [
      'CARLOS ZAMBRANO',
      '2005-04-12',
      'ECUADOR',
      '180 CM',
      'DERECHO',
      'ORENSE',
      'ORENSE VS IDV',
      '2026-09-20',
      'VIVO',
      'TITULAR',
      'S19',
      'INFORME DEPORTIVO – POCO CONOCIDO – 1 A 2 PARTIDOS',
      'DANIEL ARANGO',
      'MEDIOCENTRO',
      '4. ALTA RELEVANCIA',
      '5.MUY BUEN RENDIMIENTO: Supera lo propio.',
      '5.FICHAR'
    ],
    [
      'MIGUEL HERNÁNDEZ',
      '2008-08-25',
      'ECUADOR',
      '174 CM',
      'IZQUIERDO',
      'LIGA QUITO',
      'LIGA QUITO VS ORENSE',
      '2026-09-15',
      'VIVO',
      'TITULAR',
      'S15',
      'INFORME GENERAL DESCRIPTIVO – RECIÉN CONOCIDO – PRIMER INFORME',
      'JAVIER SEMELER',
      'EXTREMO',
      '3. RELEVANCIA NORMAL',
      '4.BUEN RENDIMIENTO: Iguala y puede superar lo propio.',
      '4.INTERESANTE'
    ]
  ];

  const csvLines = [headers.join(','), ...sampleRows.map((r) => r.map((val) => `"${val}"`).join(','))];
  return csvLines.join('\n');
}

/** Genera el contenido de la plantilla de ejemplo en formato JSON */
export function generateSampleJSON(): string {
  const sample = [
    {
      observador: 'DANIEL ARANGO',
      nombre: 'CARLOS ZAMBRANO',
      fnac: '2005-04-12',
      nacionalidad: 'ECUADOR',
      altura: '180 CM',
      lateralidad: 'DERECHO',
      club: 'ORENSE',
      partido: 'ORENSE VS IDV',
      fpartido: '2026-09-20',
      visualizacion: 'VIVO',
      rol: 'TITULAR',
      categoria: 'S19',
      tipo_informe: 'INFORME DEPORTIVO – POCO CONOCIDO – 1 A 2 PARTIDOS',
      puesto: 'MEDIOCENTRO',
      val_partido: '4. ALTA RELEVANCIA',
      val_proy: '5.MUY BUEN RENDIMIENTO: Supera lo propio.',
      valoracion: '5.FICHAR',
      car_MEDIOCENTRO: 'DEFENSIVO',
      car_obs_MEDIOCENTRO: 'Gran recuperación y criterio de distribución.'
    }
  ];

  return JSON.stringify(sample, null, 2);
}
