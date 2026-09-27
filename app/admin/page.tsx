'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  clearAdminSession,
  createAccessCode,
  DEFAULT_ACCESS_PERMISSIONS,
  getAdminMasterPassword,
  isAdminUnlocked,
  readAccessCodes,
  unlockAdminSession,
  writeAccessCodes,
  type AccessCode,
  type AccessPermissions
} from '@/lib/access';

const permissionGroups: Array<{ key: keyof AccessPermissions; label: string }> = [
  { key: 'players', label: 'Ver jugadores' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'campograma', label: 'Campograma' },
  { key: 'reports', label: 'Crear informes' },
  { key: 'import', label: 'Importar' },
  { key: 'edit', label: 'Editar' },
  { key: 'download', label: 'Descargar' },
  { key: 'print', label: 'Imprimir' }
];

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [form, setForm] = useState({
    name: '',
    password: '',
    permissions: DEFAULT_ACCESS_PERMISSIONS
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextUnlocked = isAdminUnlocked();
    setUnlocked(nextUnlocked);
    setCodes(readAccessCodes());
  }, []);

  const activeCodes = useMemo(
    () => codes.filter((item) => item.enabled).length,
    [codes]
  );

  const unlock = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const value = masterPassword.trim();

    if (value === getAdminMasterPassword()) {
      unlockAdminSession();
      setUnlocked(true);
      setError(null);
      setNotice('Acceso administrativo concedido.');
      setCodes(readAccessCodes());
      return;
    }

    setError('La contraseña maestra no es correcta.');
  };

  const togglePermission = (key: keyof AccessPermissions) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const saveCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const password = form.password.trim();

    if (!name || !password) {
      setError('Completa nombre y contraseña del acceso.');
      return;
    }

    const next = [...readAccessCodes(), createAccessCode(name, password, form.permissions)];
    writeAccessCodes(next);
    setCodes(next);
    setForm({
      name: '',
      password: '',
      permissions: DEFAULT_ACCESS_PERMISSIONS
    });
    setError(null);
    setNotice('Credencial creada y registrada para acceso.');
  };

  const toggleCode = (id: string) => {
    const next = readAccessCodes().map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    writeAccessCodes(next);
    setCodes(next);
    setNotice('Estado del acceso actualizado.');
  };

  const deleteCode = (id: string) => {
    const next = readAccessCodes().filter((item) => item.id !== id);
    writeAccessCodes(next);
    setCodes(next);
    setNotice('Credencial eliminada.');
  };

  const logoutAdmin = () => {
    clearAdminSession();
    setUnlocked(false);
    setMasterPassword('');
    setNotice('Sesión administrativa cerrada.');
  };

  if (!unlocked) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="font-display text-3xl font-bold text-[#0f3a22]">Panel administrativo</h1>
          <p className="mt-2 text-sm text-muted">
            Este apartado solo es visible para el administrador del sistema.
          </p>

          <form className="mt-6 space-y-4" onSubmit={unlock}>
            <label className="block text-sm font-semibold text-emerald-900">
              Contraseña maestra
              <input
                type="password"
                value={masterPassword}
                onChange={(event) => setMasterPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2"
                placeholder="Ingresá la contraseña de administrador"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f3a22] px-4 py-2.5 font-semibold text-white"
            >
              Entrar al panel
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 text-sm text-muted">
            <Link href="/" className="font-semibold text-[#0f3a22] underline">
              Volver a la app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0f3a22]">
            Administración
          </p>
          <h1 className="font-display text-4xl font-bold text-[#0f3a22]">Autorización y accesos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-[#0f3a22]">
            Ver app
          </Link>
          <button
            type="button"
            onClick={logoutAdmin}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-[#0f3a22]">Credenciales autorizadas</h2>
            <span className="rounded-full bg-[#edf8f0] px-2.5 py-1 text-xs font-bold text-[#0f3a22]">
              {activeCodes} activos
            </span>
          </div>

          {codes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white px-4 py-6 text-sm text-muted">
              Todavía no hay accesos creados.
            </p>
          ) : (
            <div className="space-y-3">
              {codes.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
                    item.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-white'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-[#0f3a22]">{item.name}</p>
                    <p className="text-xs text-muted">Contraseña: {item.password}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-[#0f3a22]">
                      {permissionGroups
                        .filter(({ key }) => item.permissions[key])
                        .map(({ label }) => (
                          <span key={`${item.id}-${label}`} className="rounded-full bg-white px-2 py-1 border border-line">
                            {label}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCode(item.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        item.enabled ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {item.enabled ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCode(item.id)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-[#0f3a22]">Crear acceso</h2>

          <form className="mt-4 space-y-4" onSubmit={saveCode}>
            <label className="block text-sm font-semibold text-emerald-900">
              Nombre
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2"
                placeholder="Ej.: Juan Pérez"
              />
            </label>

            <label className="block text-sm font-semibold text-emerald-900">
              Contraseña de acceso
              <input
                type="text"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2"
                placeholder="Ej.: juan2026"
              />
            </label>

            <div className="space-y-3 pt-2">
              <p className="text-sm font-semibold text-emerald-900">Permisos</p>
              <div className="grid grid-cols-2 gap-2">
                {permissionGroups.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-line bg-white px-2 py-2 text-sm text-[#0f3a22]">
                    <input
                      type="checkbox"
                      checked={Boolean(form.permissions[key])}
                      onChange={() => togglePermission(key)}
                      className="h-4 w-4 rounded border-line text-[#0f3a22]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#0f3a22] px-4 py-2.5 font-semibold text-white"
            >
              Autorizar acceso
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
