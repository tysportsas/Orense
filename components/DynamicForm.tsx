'use client';

// components/DynamicForm.tsx
//
// Arma el formulario completo (Datos generales → nivel del informe →
// secciones de ese nivel) a partir de lib/formModel.ts: la MISMA lógica
// de niveles y secciones que ya se probó en la versión de un solo
// archivo. Aquí solo cambia cómo se dibuja (React) y dónde se guarda
// (Supabase en vez de localStorage).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  visibleSections,
  validateSection,
  collect,
  type ReportData,
  type Field,
  type Section
} from '@/lib/formModel';
import FieldRenderer from './FieldRenderer';
import { createClient } from '@/lib/supabase/client';
import { createReport, updateReport, type ReportRow, type ObservedPlayerOption, keyOf } from '@/lib/reports';

export default function DynamicForm({
  initial,
  reportId,
  observedPlayers
}: {
  initial: ReportData;
  reportId?: string;
  observedPlayers?: ObservedPlayerOption[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ReportData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Determinar la clave seleccionada si initial ya viene con un jugador
  const initialKey = useMemo(() => {
    if (!initial.nombre || !observedPlayers) return '';
    const match = observedPlayers.find(
      (p) => keyOf(p.latestData) === keyOf(initial) || p.nombre.toLowerCase().trim() === (initial.nombre || '').toLowerCase().trim()
    );
    return match ? match.key : '';
  }, [initial, observedPlayers]);

  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string>(initialKey);

  const selectedPlayerObj = useMemo(() => {
    if (!selectedPlayerKey || !observedPlayers) return null;
    return observedPlayers.find((p) => p.key === selectedPlayerKey) || null;
  }, [selectedPlayerKey, observedPlayers]);

  const sections = useMemo(() => visibleSections(data), [data]);

  function handleSelectPlayer(key: string) {
    setSelectedPlayerKey(key);
    if (!key) {
      // "+ NUEVO JUGADOR": limpiar los campos precargados del jugador anterior
      setData((prev) => {
        const next = { ...prev };
        delete next.nombre;
        delete next.fnac;
        delete next.foto;
        delete next.foto_url;
        delete next.nacionalidad;
        delete next.altura;
        delete next.lateralidad;
        delete next.club;
        delete next.lugar_nac;
        delete next.puesto;
        delete next.agente;
        delete next.link1;
        delete next.link2;
        return next;
      });
      return;
    }

    const found = observedPlayers?.find((p) => p.key === key);
    if (found) {
      const prevData = found.latestData;
      setData((current) => ({
        ...current,
        nombre: prevData.nombre || current.nombre,
        fnac: prevData.fnac || current.fnac,
        foto: prevData.foto || current.foto,
        foto_url: prevData.foto_url || current.foto_url,
        nacionalidad: prevData.nacionalidad || current.nacionalidad,
        altura: prevData.altura || current.altura,
        lateralidad: prevData.lateralidad || current.lateralidad,
        club: prevData.club || current.club,
        lugar_nac: prevData.lugar_nac || current.lugar_nac,
        puesto: prevData.puesto || current.puesto,
        categoria: prevData.categoria || current.categoria,
        agente: prevData.agente || current.agente,
        link1: prevData.link1 || current.link1,
        link2: prevData.link2 || current.link2,
      }));
    }
  }

  function handleChange(field: Field, value: any) {
    setData((d) => {
      if (field.type === 'photo') {
        if (value && typeof value === 'object' && '__fotoUrl' in value) {
          return { ...d, foto_url: value.__fotoUrl || undefined };
        }
        return { ...d, foto: value || undefined };
      }
      const next = { ...d };
      if (value == null || value === '') delete next[field.id!];
      else next[field.id!] = value;
      return next;
    });
    if (field.id && errors[field.id]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[field.id!];
        return n;
      });
    }
  }

  function validateAll(): boolean {
    let allErrors: Record<string, string> = {};
    for (const sec of sections) {
      allErrors = { ...allErrors, ...validateSection(sec, data) };
    }
    setErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  }

  async function onSubmit() {
    if (!validateAll()) {
      const firstId = Object.keys(errors)[0];
      document.getElementById(`field-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const payload = collect(data);
      let row: ReportRow;
      if (reportId) row = await updateReport(supabase, reportId, payload);
      else row = await createReport(supabase, payload);
      const key = encodeURIComponent(
        (payload.nombre || '').trim().toLowerCase() + '|' + (payload.fnac || '')
      );
      router.push(`/players/${key}`);
      router.refresh();
    } catch (e: any) {
      setSaveError('No se pudo guardar el informe. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Selector de Jugador ya observado (solo cuando estamos en nuevo informe y hay jugadores) */}
      {observedPlayers && observedPlayers.length > 0 && !reportId && (
        <div className="bg-emerald-900/5 border border-emerald-800/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">🔍</span>
            <h3 className="font-display font-bold text-lg text-emerald-950">
              ¿Es un jugador ya observado o un nuevo registro?
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Selecciona un jugador de la lista para precargar automáticamente sus datos recopilados (nombre, club, foto, fecha de nacimiento, puesto, etc.), o elige <strong>+ NUEVO JUGADOR</strong> para hacer su primer registro.
          </p>
          <select
            value={selectedPlayerKey}
            onChange={(e) => handleSelectPlayer(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm bg-white font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f3a22]"
          >
            <option value="">➕ NUEVO JUGADOR (Primer registro)</option>
            {observedPlayers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.nombre} {p.club ? `(${p.club})` : ''} — {p.n_informes} informe{p.n_informes === 1 ? '' : 's'} previo{p.n_informes === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          {selectedPlayerKey && selectedPlayerObj && (
            <div className="mt-3 p-3 bg-emerald-100/80 border border-emerald-300/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
              <span className="text-base">✓</span>
              <div>
                Se precargaron los datos de <strong>{selectedPlayerObj.nombre}</strong> {selectedPlayerObj.club && `(${selectedPlayerObj.club})`}. Puedes modificarlos o completarlos para este nuevo informe.
              </div>
            </div>
          )}
        </div>
      )}

      {sections.map((sec: Section) => (
        <section key={sec.id} className="bg-surface border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-2xl">{sec.title}</h2>
          {sec.desc && <p className="text-muted mt-1 mb-4">{sec.desc}</p>}
          <div className="grid gap-5 mt-4">
            {sec.fields(data).map((f, i) =>
              f.type === 'note' ? (
                <FieldRenderer key={sec.id + '-note-' + i} field={f} value={null} onChange={() => {}} data={data} />
              ) : (
                <div id={`field-${f.id}`} key={f.id}>
                  <FieldRenderer
                    field={f}
                    value={data[f.id!]}
                    onChange={(v) => handleChange(f, v)}
                    error={errors[f.id!]}
                    data={data}
                  />
                </div>
              )
            )}
          </div>
        </section>
      ))}

      {saveError && (
        <p role="alert" className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {saveError}
        </p>
      )}

      <div className="flex justify-end gap-3 pb-10">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-full bg-green text-white font-semibold px-6 py-2.5 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : reportId ? 'Guardar cambios' : 'Guardar informe'}
        </button>
      </div>
    </div>
  );
}
