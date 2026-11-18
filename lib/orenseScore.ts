import type { ReportRow } from './reports';
import { keyOf } from './reports';
import { visibleSections } from './formModel';

export const ORENSE_SCORE_WEIGHTS = {
  finalRating: 0.25,
  matchRating: 0.15,
  performanceRating: 0.25,
  attributes: 0.35
} as const;

export const ORENSE_SCORE_FILTERS = [
  { value: 'muy-bueno', label: 'Muy bueno (4,00–5,00)' },
  { value: 'bueno', label: 'Bueno (3,75–3,99)' },
  { value: 'interesante', label: 'Interesante (3,25–3,74)' },
  { value: 'descartado', label: 'Descartado (<3,25)' },
  { value: 'sin-score', label: 'Sin Orense Score' }
] as const;

interface OrenseScoreMetrics {
  finalRating: number | null;
  matchRating: number | null;
  performanceRating: number | null;
  attributes: number | null;
}

export function orenseScoreBandOf(score: number) {
  if (score >= 4) return { value: 'muy-bueno', label: 'Muy bueno', color: '#14532d' } as const;
  if (score >= 3.75) return { value: 'bueno', label: 'Bueno', color: '#16a34a' } as const;
  if (score >= 3.25) return { value: 'interesante', label: 'Interesante', color: '#f97316' } as const;
  return { value: 'descartado', label: 'Descartado', color: '#dc2626' } as const;
}

export function matchesOrenseScoreBand(score: number | null, selectedBand: string) {
  if (!selectedBand) return true;
  if (selectedBand === 'sin-score') return score == null;
  if (score == null) return false;
  return orenseScoreBandOf(score).value === selectedBand;
}

function scoreOf(value: unknown): number | null {
  const score = Number.parseInt(String(value ?? '').charAt(0), 10);
  return score >= 1 && score <= 5 ? score : null;
}

function average(values: (number | null)[]) {
  const available = values.filter((value): value is number => value != null && Number.isFinite(value));
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
}

export function orenseScoreFromMetrics(metrics: OrenseScoreMetrics) {
  const { finalRating, matchRating, performanceRating, attributes } = metrics;
  if (finalRating == null || matchRating == null || performanceRating == null || attributes == null) return null;

  const score =
    finalRating * ORENSE_SCORE_WEIGHTS.finalRating +
    matchRating * ORENSE_SCORE_WEIGHTS.matchRating +
    performanceRating * ORENSE_SCORE_WEIGHTS.performanceRating +
    attributes * ORENSE_SCORE_WEIGHTS.attributes;
  return Math.round((score + Number.EPSILON) * 100) / 100;
}

function attributeAverage(report: ReportRow) {
  let total = 0;
  let count = 0;
  for (const section of visibleSections(report.data)) {
    for (const field of section.fields(report.data)) {
      const value = field.id ? report.data[field.id] : null;
      if (field.type === 'rate' && !field.values && typeof value === 'number' && Number.isFinite(value)) {
        total += value;
        count += 1;
      }
    }
  }
  return count ? total / count : null;
}

export function calculateOrenseScore(reports: ReportRow[]) {
  const finalRating = average(reports.map((report) => scoreOf(report.data.valoracion)));
  const matchRating = average(reports.map((report) => scoreOf(report.data.val_partido)));
  const performanceRating = average(reports.map((report) => scoreOf(report.data.val_proy)));
  const attributes = average(reports.map(attributeAverage));
  return orenseScoreFromMetrics({ finalRating, matchRating, performanceRating, attributes });
}

export function orenseScoresByPlayer(reports: ReportRow[]) {
  const grouped = new Map<string, ReportRow[]>();
  for (const report of reports) {
    const key = keyOf(report.data);
    if (!key || !report.data.nombre) continue;
    const playerReports = grouped.get(key) || [];
    playerReports.push(report);
    grouped.set(key, playerReports);
  }
  return new Map([...grouped].map(([key, playerReports]) => [key, calculateOrenseScore(playerReports)]));
}
