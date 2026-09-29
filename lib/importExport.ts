// lib/importExport.ts
//
// Utilidades para importar y exportar informes masivamente en formato CSV, Excel (.xlsx, .xls) o JSON.

import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import type { ReportData } from './formModel';
import { createReport } from './reports';

export interface ParsedImportRow {
  data: ReportData;
  isValid: boolean;
  error?: string;
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

  if (clean.includes('fecha_del_partido') || clean.includes('fecha_partido') || clean === 'fpartido') {
    return 'fpartido';
  }

  if (clean.includes('valoracion_del_partido') || clean.includes('val_partido')) {
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
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Detectar delimitador (coma o punto y coma)
  const firstLine = lines[0];
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  // Extraer encabezados mapeándolos de forma inteligente
  const mappedHeaders = splitCSVLine(lines[0], delimiter).map((h) => mapHeaderToFieldKey(h));

  const results: ParsedImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    if (values.every((v) => !v)) continue;

    const rowData: ReportData = {};
    mappedHeaders.forEach((key, idx) => {
      if (values[idx] !== undefined && values[idx] !== '' && key) {
        rowData[key] = values[idx];
      }
    });

    // Default para observador si no vino especificado
    if (!rowData.observador) {
      rowData.observador = 'SECRETARÍA TÉCNICA';
    }

    // Default para tipo de informe si no vino especificado
    if (!rowData.tipo_informe) {
      rowData.tipo_informe = 'INFORME GENERAL DESCRIPTIVO – RECIÉN CONOCIDO – PRIMER INFORME';
    }

    // Validar requeridos básicos
    let error: string | undefined;
    if (!rowData.nombre) {
      error = 'Falta el nombre del jugador';
    }

    results.push({
      data: rowData,
      isValid: !error,
      error
    });
  }

  return results;
}

/** Divide una línea de CSV respetando comillas */
function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/** Procesa el contenido de un archivo de Excel (.xlsx, .xls) a partir de su ArrayBuffer */
export function parseExcel(arrayBuffer: ArrayBuffer): ParsedImportRow[] {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    return rawRows.map((row) => {
      const rowData: ReportData = {};
      Object.keys(row).forEach((rawKey) => {
        const targetKey = mapHeaderToFieldKey(rawKey);
        const val = String(row[rawKey]).trim();
        if (val !== '' && targetKey) {
          rowData[targetKey] = val;
        }
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

/** Inserta una lista de informes en Supabase en bloques (batch) */
export async function bulkInsertReports(
  supabase: SupabaseClient,
  items: ReportData[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: 0,
      failed: items.length,
      errors: ['La sesión expiró o no tiene permiso para importar.']
    }
  }

  const batchSize = 100;
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const { error } = await supabase
      .from('reports')
      .insert(batch.map((data) => ({ data, created_by: user.id })));

    if (!error) {
      success += batch.length;
    } else {
      for (const item of batch) {
        try {
          await createReport(supabase, item);
          success++;
        } catch (itemError: any) {
          failed++;
          errors.push(`Error al insertar a ${item.nombre || 'registro'}: ${itemError.message || 'Error desconocido'}`);
        }
      }
    }

    onProgress?.(Math.min(start + batch.length, items.length), items.length);
  }

  return { success, failed, errors };
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
