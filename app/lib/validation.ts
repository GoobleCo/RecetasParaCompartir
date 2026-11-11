export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateEmail(v: string): string | null {
  if (!v.trim()) return 'El email es obligatorio.';
  if (!EMAIL_RE.test(v.trim())) return 'El formato del email no es válido.';
  return null;
}

export function validatePassword(v: string): string | null {
  if (!v) return 'La contraseña es obligatoria.';
  if (v.length < 8) return 'Mínimo 8 caracteres.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Tiene que tener letras y números.';
  return null;
}

export function validateUsername(v: string): string | null {
  if (!v.trim()) return 'El nombre de usuario es obligatorio.';
  if (!USERNAME_RE.test(v)) return 'De 3 a 20 caracteres: minúsculas, números o "_".';
  return null;
}

export function required(v: string, label: string, max?: number, min = 1): string | null {
  const t = v.trim();
  if (!t) return `${label} es obligatorio.`;
  if (t.length < min) return `${label} debe tener al menos ${min} caracteres.`;
  if (max && t.length > max) return `${label} no puede superar ${max} caracteres.`;
  return null;
}

export function intInRange(v: string, label: string, min: number, max: number, optional = true): string | null {
  if (!v.trim()) return optional ? null : `${label} es obligatorio.`;
  if (!/^\d+$/.test(v.trim())) return `${label} debe ser un número entero.`;
  const n = Number(v);
  if (n < min || n > max) return `${label} debe estar entre ${min} y ${max}.`;
  return null;
}

/** Quita caracteres que rompen los filtros de búsqueda de PostgREST */
export function sanitizeSearch(q: string): string {
  return q.replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);
}
