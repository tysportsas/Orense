export const USER_ROLES = ['admin', 'scout', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function normalizeRole(value: unknown): UserRole {
  const role = String(value ?? '').trim().toLowerCase();
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : 'viewer';
}

export function hasRouteAccess(pathname: string, role: UserRole): boolean {
  const path = pathname.split('?')[0];

  if (!path || path === '/login') return true;
  if (role === 'admin') return true;

  const publicAllowed = ['/', '/dashboard', '/campograma'];
  if (publicAllowed.includes(path)) return true;

  if (path.startsWith('/players/')) return true;

  if (role === 'scout') {
    return path === '/reports/new' || path === '/reports/import' || path.startsWith('/reports/');
  }

  return false;
}

export function canAccessRoute(pathname: string, role: UserRole): boolean {
  return hasRouteAccess(pathname, normalizeRole(role));
}
