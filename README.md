# 🍳 Sazón — Recetas de la comunidad

Aplicación multiplataforma y multiusuario para **crear, guardar y compartir recetas**.
Proyecto Final · Construcción de Software · 6.º año.

- 🌐 **Web pública:** https://goobleco.github.io/RecetasParaCompartir/
- 📱 **APK Android:** https://github.com/GoobleCo/RecetasParaCompartir/releases/latest/download/sazon.apk
- 🔑 **Usuarios de prueba:** entregados en privado al docente (no se publican).

---

## ¿Qué problema resuelve?
Las recetas quedan dispersas en cuadernos, capturas y mensajes. Sazón las centraliza con ingredientes, pasos y fotos, y suma una comunidad: buscar, valorar, comentar, guardar favoritas, seguir a otros cocineros y recibir avisos.

**Público:** cualquier persona que cocine en casa (estudiantes, familias, aficionados).

## Tecnologías
| Capa | Tecnología |
|---|---|
| App (frontend) | React Native + **Expo SDK 56**, Expo Router, TypeScript |
| Backend | **Supabase**: PostgreSQL, Auth (JWT), Storage, Realtime, PostgREST |
| Seguridad | Row Level Security, permisos por columna, funciones `SECURITY DEFINER` |
| Notificaciones | Expo Push Notifications (FCM en Android) enviadas desde la BD con `pg_net` |
| Segundo plano | `pg_cron` (receta del día, limpieza semanal) |
| Distribución | EAS Build → APK · Web estática en GitHub Pages |

## Estructura
```
sazon/
├── app/                  App Expo (React Native)
│   ├── app/              Pantallas (Expo Router: cada archivo es una ruta)
│   │   ├── (auth)/       login, registro, recuperar contraseña
│   │   ├── (tabs)/       inicio, explorar, avisos, perfil
│   │   ├── recipe/       detalle, nueva, editar
│   │   ├── user/         perfil público
│   │   ├── settings/     configuración, editar perfil, contraseña
│   │   └── admin/        panel de administración / moderación
│   ├── components/       UI reutilizable
│   └── lib/              supabase, auth, api, tema, push, validaciones, errores
├── supabase/
│   ├── schema.sql        Base de datos completa + seguridad + triggers + cron
│   └── seed.sql          Roles y datos de prueba
├── docs/                 Sitio web público (GitHub Pages)
├── GUIA_PASO_A_PASO.md   Cómo poner todo en funcionamiento
└── DEFENSA.md            Explicación técnica para la defensa
```

## Cumplimiento de la consigna
| Requisito | Dónde está |
|---|---|
| Registro, login, logout | `app/(auth)/register.tsx`, `login.tsx`, `lib/auth.tsx` |
| Recuperar / restablecer contraseña | `app/(auth)/forgot-password.tsx` (código por email) |
| Sesión persistente y segura (JWT) | `lib/supabase.ts` (SecureStore cifrado + refresh automático) |
| Social login | GitHub (y Google opcional) con OAuth PKCE — `lib/oauth.ts` |
| Home con resumen y accesos | `app/(tabs)/index.tsx` + RPC `home_stats` |
| ABM | Recetas (`recipe/new`, `recipe/edit/[id]`, `recipe/[id]`) y Categorías (admin) |
| Multiusuario y roles | `user` / `moderator` / `admin`, controlados con RLS y `set_user_role` |
| Interacción entre usuarios | Comentarios, valoraciones, favoritos, seguidores, compartir |
| Configuración de cuenta | `app/settings/*` (datos, foto, contraseña, notificaciones, tema, logout, borrar cuenta) |
| Tema claro / oscuro / sistema | `lib/theme.tsx` |
| Notificaciones push | Triggers → tabla `notifications` → `pg_net` → Expo Push |
| Segundo plano | `pg_cron`: receta del día (diaria) y limpieza (semanal); envío push asíncrono |
| Almacenamiento | PostgreSQL + Storage (`recipe-images`, `avatars`) con permisos por carpeta |
| Validaciones y errores | `lib/validation.ts`, `lib/errors.ts`, estados de carga/error/vacío en cada pantalla, banner sin conexión |
| Seguridad | RLS en todas las tablas, `GRANT` por columna, sin secretos en el código |
| Distribución | APK (EAS Build) + web con botón, QR e instrucciones |

## Instalación y uso (para probar)
1. Abrí la web pública desde un Android, tocá **Descargar APK** (o escaneá el QR).
2. Permití "instalar apps desconocidas" y tocá **Instalar**.
3. Abrí Sazón → **Registrate** (o **Continuar con GitHub**).
4. Desde **Inicio** creá una receta, explorá las demás, valorá y comentá.

Requisitos: Android 8+, internet.

## Correr el proyecto en desarrollo
```bash
cd app
cp .env.example .env      # completar URL y anon key de Supabase
npm install --legacy-peer-deps
npm run setup
npx expo start --web      # o escanear con un development build
```
Compilar APK: `npx eas-cli build -p android --profile preview`.

## Backend
El backend completo se crea ejecutando `supabase/schema.sql` en el SQL Editor de un proyecto Supabase (ver `GUIA_PASO_A_PASO.md`). El acceso de evaluación al panel se otorga por invitación al docente.

**Seguridad de credenciales:** la app sólo contiene la *anon/publishable key*, que es pública por diseño; la protección real está en las políticas RLS del servidor. La *service_role key*, la contraseña de la base, el `.env` y la clave de Firebase **no** están en el repositorio.
