/**
 * Traduce cualquier error (red, Supabase Auth, PostgREST/Postgres, Storage)
 * a un mensaje claro en castellano para mostrarle al usuario.
 */
type AnyError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

const RULES: [RegExp, string][] = [
  [/network request failed|failed to fetch|fetch failed|networkerror|load failed|timeout/i,
    'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.'],
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/user already registered|already been registered/i, 'Ya existe una cuenta con ese email.'],
  [/email not confirmed/i, 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.'],
  [/password should be at least|weak password|password is too weak/i, 'La contraseña es muy débil: usá al menos 8 caracteres con letras y números.'],
  [/new password should be different/i, 'La nueva contraseña tiene que ser distinta a la anterior.'],
  [/token has expired|otp.*(expired|invalid)|invalid.*otp/i, 'El código es incorrecto o ya venció. Pedí uno nuevo.'],
  [/rate limit|too many requests|security purposes/i, 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'El formato del email no es válido.'],
  [/user not found|no user/i, 'No existe un usuario con esos datos.'],
  [/provider is not enabled|unsupported provider/i, 'Ese método de inicio de sesión no está habilitado.'],
  [/signups not allowed/i, 'El registro de cuentas está deshabilitado.'],
  [/row-level security|permission denied|not authorized|solo un administrador|42501/i,
    'No tenés permiso para realizar esta operación.'],
  [/jwt expired|invalid jwt|refresh token/i, 'Tu sesión expiró. Volvé a iniciar sesión.'],
  [/payload too large|exceeded the maximum allowed size|entity too large/i, 'La imagen es demasiado grande (máximo 5 MB).'],
  [/mime type .* is not supported|invalid mime/i, 'Formato de imagen no admitido (usá JPG, PNG o WEBP).'],
  [/duplicate key|23505|already exists/i, 'Ya existe un registro con esos datos.'],
  [/violates check constraint|23514/i, 'Algún dato no cumple el formato requerido.'],
  [/violates foreign key|23503/i, 'El registro relacionado ya no existe.'],
  [/pgrst116|0 rows|no rows/i, 'El registro no existe o fue eliminado.'],
];

export function friendlyError(err: unknown): string {
  if (err instanceof AppError) return err.message;
  const e = err as AnyError;
  const text = `${e?.message ?? ''} ${e?.code ?? ''}`;
  for (const [re, msg] of RULES) if (re.test(text)) return msg;
  if (e?.status && e.status >= 500) return 'El servidor tuvo un problema. Intentá de nuevo en un rato.';
  // Mensajes propios que lanzamos desde la base de datos ya vienen en castellano
  if (e?.message && /[áéíóúñ¿¡]|no podés|inexistente|inválido/i.test(e.message)) return e.message;
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

export function isNetworkError(err: unknown): boolean {
  const e = err as AnyError;
  return /network request failed|failed to fetch|fetch failed|networkerror/i.test(e?.message ?? '');
}
