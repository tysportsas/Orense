export const ADMIN_SESSION_COOKIE = 'orense_admin_session';
export const ACCESS_CODES_KEY = 'orense_access_codes';
export const ACTIVE_ACCESS_SESSION_KEY = 'orense_active_access';

export type AccessPermissions = {
  players: boolean;
  dashboard: boolean;
  campograma: boolean;
  reports: boolean;
  import: boolean;
  edit: boolean;
  download: boolean;
  print: boolean;
};

export type AccessCode = {
  id: string;
  name: string;
  password: string;
  enabled: boolean;
  createdAt: string;
  permissions: AccessPermissions;
};

export const DEFAULT_ACCESS_PERMISSIONS: AccessPermissions = {
  players: false,
  dashboard: false,
  campograma: false,
  reports: false,
  import: false,
  edit: false,
  download: false,
  print: false
};

export function normalizePermissions(
  permissions?: Partial<AccessPermissions>
): AccessPermissions {
  return {
    players: Boolean(permissions?.players ?? false),
    dashboard: Boolean(permissions?.dashboard ?? false),
    campograma: Boolean(permissions?.campograma ?? false),
    reports: Boolean(permissions?.reports ?? false),
    import: Boolean(permissions?.import ?? false),
    edit: Boolean(permissions?.edit ?? false),
    download: Boolean(permissions?.download ?? false),
    print: Boolean(permissions?.print ?? false)
  };
}

export function getAdminMasterPassword(): string {
  return process.env.NEXT_PUBLIC_ADMIN_MASTER_PASSWORD || 'OrenseAdmin2026';
}

export function readAccessCodes(): AccessCode[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACCESS_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((code) => ({
          ...code,
          permissions: normalizePermissions(code.permissions)
        }))
      : [];
  } catch {
    return [];
  }
}

export function writeAccessCodes(codes: AccessCode[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_CODES_KEY, JSON.stringify(codes));
}

export function getCurrentAccessSession(): AccessCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ACCESS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;
    return {
      ...parsed,
      permissions: normalizePermissions(parsed.permissions)
    };
  } catch {
    return null;
  }
}

export function setActiveAccessSession(access: AccessCode | null) {
  if (typeof window === 'undefined') return;
  if (!access) {
    window.localStorage.removeItem(ACTIVE_ACCESS_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_ACCESS_SESSION_KEY, JSON.stringify(access));
}

export function clearAccessSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_ACCESS_SESSION_KEY);
}

export function normalizeAccessName(value: string): string {
  return value.trim().toLowerCase();
}

export function findAccessCodeByCredentials(username: string, password: string): AccessCode | null {
  const userValue = normalizeAccessName(username);
  const passValue = password.trim();

  if (!userValue || !passValue) return null;

  return (
    readAccessCodes().find(
      (code) =>
        code.enabled &&
        normalizeAccessName(code.name) === userValue &&
        code.password.trim() === passValue
    ) ?? null
  );
}

export function hasPermission(code: AccessCode | null, key: keyof AccessPermissions): boolean {
  if (!code) return true;
  return Boolean(code.permissions?.[key]);
}

export function isAdminUnlocked() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((row) => row.startsWith(`${ADMIN_SESSION_COOKIE}=`));
}

export function unlockAdminSession() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_SESSION_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
}

export function clearAdminSession() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function createAccessCode(
  name: string,
  password: string,
  permissions: Partial<AccessPermissions> = {}
): AccessCode {
  const randomId =
    globalThis.crypto && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: randomId,
    name: name.trim(),
    password: password.trim(),
    enabled: true,
    createdAt: new Date().toISOString(),
    permissions: normalizePermissions(permissions)
  };
}
