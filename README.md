# Ω Código Omega — juego de reflejos multijugador

Aplicación multiplataforma y multiusuario: un juego de **velocidad y memoria** en el que hay que ingresar secuencias de flechas antes de que se termine el tiempo, con **rankings validados por el servidor**, **desafío diario** y **desafíos creados por la comunidad**.
Proyecto Final · Construcción de Software · 6.º año.

- 🌐 **Web pública:** https://goobleco.github.io/RecetasParaCompartir/
- 📱 **APK Android:** https://github.com/GoobleCo/RecetasParaCompartir/releases/latest/download/codigo-omega.apk
- 🔑 **Usuarios de prueba:** se entregan en privado al docente.

---

## ¿Qué propone?
Partidas de un minuto para entrenar memoria y reflejos, pensadas para que un grupo (un curso, amigos) compita y cree su propio contenido. Cada operador/a recibe una cola de **protocolos** (Pulso EMP, Dron médico, Lluvia de meteoros…), cada uno con un **código de flechas**; hay que ingresarlos antes de que la barra de tiempo llegue a cero.

**Público:** estudiantes y grupos de amigos que buscan un juego corto y competitivo.

## Tecnologías
| Capa | Tecnología |
|---|---|
| App | React Native + **Expo SDK 56**, Expo Router, TypeScript, expo-haptics |
| Backend | **Supabase**: PostgreSQL, Auth (JWT), Storage, Realtime, PostgREST, funciones RPC en PL/pgSQL |
| Seguridad | Row Level Security, permisos por columna, puntajes calculados y validados en el servidor |
| Notificaciones | Expo Push (FCM en Android) disparadas por triggers con `pg_net` |
| Segundo plano | `pg_cron`: desafío diario, aviso diario, premios semanales, limpieza |
| Distribución | EAS Build → APK · Web estática con demo jugable en GitHub Pages |

## Estructura
```
├── app/                    App Expo
│   ├── app/                Pantallas (Expo Router)
│   │   ├── (auth)/         login, registro, recuperar contraseña
│   │   ├── (tabs)/         inicio, desafíos, ranking, avisos, perfil
│   │   ├── game.tsx        pantalla de juego
│   │   ├── codex.tsx       códice de protocolos + práctica
│   │   ├── challenge/      detalle, nuevo, editar
│   │   ├── user/ settings/ admin/
│   ├── components/         UI, pad de flechas, tarjetas, formularios
│   ├── lib/game.ts         motor del juego (lógica pura, testeada)
│   ├── lib/                supabase, auth, api, tema, push, validaciones, errores
│   └── tests/              tests del motor (npm test)
├── supabase/schema.sql     Base de datos + seguridad + triggers + RPC + cron
├── supabase/seed.sql       Roles y datos de ejemplo
├── docs/                   Sitio web público
├── GUIA_PASO_A_PASO.md     Puesta en funcionamiento
└── DEFENSA.md              Explicación técnica
```

## Cumplimiento de la consigna
| Requisito | Dónde |
|---|---|
| Registro, login, logout, sesión persistente | `app/(auth)/*`, `lib/auth.tsx`, `lib/supabase.ts` (SecureStore + refresh JWT) |
| Recuperar / restablecer contraseña | `app/(auth)/forgot-password.tsx` (código por email) |
| Social login | GitHub (y Google opcional) con OAuth PKCE — `lib/oauth.ts` |
| Home | `app/(tabs)/index.tsx`: récord, puesto, partidas, accesos rápidos, desafíos |
| ABM | **Desafíos** (usuarios) y **Protocolos** (admin) |
| Roles | `user` / `moderator` / `admin`, controlados en el backend (RLS + `set_user_role`) |
| Interacción | Rankings, "te superaron", comentarios, valoraciones, favoritos, seguidores, compartir |
| Configuración de cuenta | `app/settings/*` |
| Tema claro / oscuro / sistema | `lib/theme.tsx` |
| Notificaciones push | Triggers → `notifications` → `pg_net` → Expo Push |
| Segundo plano | `pg_cron` (4 tareas) + envío asíncrono de push |
| Almacenamiento | PostgreSQL + Storage (avatares por carpeta de usuario) |
| Validaciones y errores | `lib/validation.ts`, `lib/errors.ts`, CHECK/trigger en la BD, estados de carga/error/vacío |
| Seguridad | RLS en todas las tablas, puntajes imposibles de falsear desde la app |
| Distribución | APK + web con botón, QR, instrucciones y demo |

## Instalación y uso
1. Abrí la web desde un Android → **Descargar APK** (o escaneá el QR).
2. Permití "instalar apps desconocidas" → **Instalar**.
3. Abrí Código Ω → **Registrate** (o GitHub) → **Jugar modo clásico**.

## Desarrollo
```bash
cd app
cp .env.example .env          # URL y anon key de Supabase
npm install --legacy-peer-deps
npm run setup
npm test
npx expo start --web
```
APK: `npx eas-cli build -p android --profile preview`. Backend: ejecutar `supabase/schema.sql` (ver la guía).

**Credenciales:** la app sólo contiene la *anon/publishable key* (pública por diseño). La *service_role key*, la contraseña de la base, el `.env` y la clave de Firebase **no** están en el repositorio.

*Juego original inspirado en la mecánica de minijuegos de "ingresar combinaciones"; nombres, protocolos, códigos y diseño son propios.*
