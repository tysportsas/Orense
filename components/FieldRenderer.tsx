'use client';

// components/FieldRenderer.tsx
//
// Dibuja UN campo del formulario (cualquiera de los tipos definidos en
// lib/formModel.ts). El estado vive en el componente padre (DynamicForm);
// este componente es "tonto": recibe el valor y avisa cuando cambia.

import { useEffect, useRef, useState } from 'react';
import type { Field } from '@/lib/formModel';
import { cap } from '@/lib/formModel';
import { createClient } from '@/lib/supabase/client';
import { uploadPlayerPhoto, signedPhotoUrl } from '@/lib/reports';

const POS = ['ARQUERO', 'LATERAL', 'CENTRAL', 'MEDIOCENTRO', 'INTERIOR', 'EXTREMO', 'MEDIAPUNTA', 'PUNTA'];

function optOf(o: any) {
  return typeof o === 'string' ? { v: o, l: o } : o;
}

/** Campo de foto: es su propio componente (no un `case` con hooks) porque
 *  React exige que los hooks se llamen siempre en el mismo orden, y eso
 *  solo se puede garantizar si esta lógica vive en un componente aparte. */
function PhotoField({
  field,
  data,
  onChange
}: {
  field: Field;
  data: Record<string, any>;
  onChange: (v: any) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const foto = data.foto as string | undefined;
  const fotoUrl = data.foto_url as string | undefined;

  useEffect(() => {
    let alive = true;
    const target = foto || fotoUrl;
    if (!target) {
      setPreview(null);
      return;
    }
    if (/^https?:\/\//i.test(target)) {
      setPreview(target);
      return;
    }
    const supabase = createClient();
    signedPhotoUrl(supabase, target).then((u) => {
      if (alive) setPreview(u);
    });
    return () => {
      alive = false;
    };
  }, [foto, fotoUrl]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const path = await uploadPlayerPhoto(supabase, file);
      onChange(path);
      const url = await signedPhotoUrl(supabase, path);
      setPreview(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="block font-semibold mb-1">{field.label}</label>
      <p className="text-sm text-muted mb-2">
        La foto se guarda en Supabase Storage (privado) y solo la ven los observadores conectados.
      </p>
      <div className="flex gap-4 items-start flex-wrap">
        <div className="w-28 h-36 rounded-lg border border-dashed border-line bg-surface2 grid place-items-center overflow-hidden text-muted text-xs text-center">
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : foto || fotoUrl ? (
            <span className="p-2 text-xs">Cargando foto…</span>
          ) : (
            'Sin foto'
          )}
        </div>
        <div className="flex-1 min-w-[220px]">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-dashed border-turf px-4 py-2 font-semibold"
          >
            {busy ? 'Subiendo…' : foto || fotoUrl ? 'Cambiar foto' : 'Cargar foto'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          <p className="text-sm text-muted mt-2">O pega el enlace de una foto en internet</p>
          <input
            type="text"
            placeholder="https://…"
            defaultValue={typeof data.foto_url === 'string' ? data.foto_url : ''}
            onBlur={(e) => onChange({ __fotoUrl: e.target.value || null })}
            className="w-full rounded-lg border border-line px-3 py-2 mt-1"
          />
        </div>
      </div>
    </div>
  );
}

export default function FieldRenderer({
  field,
  value,
  onChange,
  error,
  data
}: {
  field: Field;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  data: Record<string, any>;
}) {
  if (field.type === 'note') {
    return (
      <div className="bg-surface2 border border-line rounded-xl p-4">
        <h3 className="font-display font-bold text-xl">{field.title}</h3>
        {field.text && <p className="text-muted text-sm mt-1">{field.text}</p>}
      </div>
    );
  }

  const label = (
    <label className="block font-semibold mb-1">
      {field.label}
      {field.req && <span className="text-gold ml-1">*</span>}
    </label>
  );
  const hint = field.hint && <p className="text-sm text-muted mb-2">{field.hint}</p>;
  const err = error && (
    <p role="alert" className="text-sm text-red-700 mt-1">
      {error}
    </p>
  );
  const errCls = error ? 'border-red-400' : 'border-line';

  switch (field.type) {
    case 'select':
      return (
        <div>
          {label}
          {hint}
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={`w-full rounded-lg border ${errCls} px-3 py-2`}
          >
            <option value="">Elegir…</option>
            {(field.options || []).map((o) => {
              const opt = optOf(o);
              return (
                <option key={opt.v} value={opt.v}>
                  {opt.l}
                </option>
              );
            })}
          </select>
          {err}
        </div>
      );

    case 'combo': {
      const listId = `dl-${field.id}`;
      return (
        <div>
          {label}
          {hint}
          <input
            list={listId}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={`w-full rounded-lg border ${errCls} px-3 py-2`}
            placeholder="Escribe para buscar…"
          />
          <datalist id={listId}>
            {(field.options || []).map((o) => {
              const opt = optOf(o);
              return <option key={opt.v} value={opt.v} />;
            })}
          </datalist>
          {err}
        </div>
      );
    }

    case 'text':
      return (
        <div>
          {label}
          {hint}
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(field.tx ? field.tx(e.target.value) : e.target.value)}
            className={`w-full rounded-lg border ${errCls} px-3 py-2`}
          />
          {err}
        </div>
      );

    case 'date':
      return (
        <div>
          {label}
          {hint}
          <input
            type="date"
            value={value ?? ''}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange(e.target.value || null)}
            className={`w-full rounded-lg border ${errCls} px-3 py-2`}
          />
          {err}
        </div>
      );

    case 'area':
      return (
        <div>
          {label}
          {hint}
          <textarea
            rows={3}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={`w-full rounded-lg border ${errCls} px-3 py-2`}
          />
          {err}
        </div>
      );

    case 'chips':
    case 'cards':
      return (
        <div>
          {label}
          {hint}
          <div className={field.type === 'cards' ? 'grid gap-2' : 'flex flex-wrap gap-2'}>
            {(field.options || []).map((raw) => {
              const o = field.type === 'cards' ? raw : optOf(raw);
              const v = field.type === 'cards' ? o.v : o.v;
              const on = value === v;
              return field.type === 'cards' ? (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(v)}
                  className={`text-left rounded-lg border px-3 py-2 ${on ? 'border-turf bg-tint' : 'border-line'}`}
                >
                  <div className="font-semibold">{o.t}</div>
                  {o.d && <div className="text-sm text-muted">{o.d}</div>}
                </button>
              ) : (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(v)}
                  className={`rounded-full px-4 py-2 border font-medium ${
                    on ? 'bg-green border-green text-white' : 'border-line bg-white'
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
          {err}
        </div>
      );

    case 'rate': {
      const vals = field.values || [1, 2, 3, 4, 5];
      return (
        <div>
          {label}
          {hint}
          <div className="flex gap-1.5">
            {vals.map((v, i) => {
              const on = value === v;
              return (
                <button
                  key={v}
                  type="button"
                  title={field.legend?.[i]}
                  onClick={() => onChange(on ? null : v)}
                  className={`flex-1 rounded-lg border py-2 font-semibold ${
                    on ? 'bg-green border-green text-white' : 'border-line bg-white'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
          {value != null && field.legend && (
            <p className="text-sm text-muted mt-1">{field.legend[vals.indexOf(value)]}</p>
          )}
          {err}
        </div>
      );
    }

    case 'pitch':
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-2 mt-1">
            {POS.map((p) => {
              const on = value === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange(p)}
                  className={`rounded-full px-4 py-2 border font-medium ${
                    on ? 'bg-green border-green text-white' : 'border-line bg-white'
                  }`}
                >
                  {cap(p)}
                </button>
              );
            })}
          </div>
          {err}
        </div>
      );

    case 'photo':
      return <PhotoField field={field} data={data} onChange={onChange} />;

    default:
      return null;
  }
}
