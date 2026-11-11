# Preparación para la defensa — Sazón

La consigna dice que la defensa **no es sólo mostrar**: tenés que poder explicar las decisiones. Acá está todo lo que te pueden preguntar, en criollo.

---

## 1. Arquitectura en una frase
> "Es una app React Native hecha con Expo que habla directamente con Supabase. Supabase me da una base PostgreSQL con una API REST automática, autenticación con JWT, almacenamiento de archivos y tiempo real. Toda la lógica de permisos está en la base de datos con Row Level Security, así que aunque alguien modifique la app, el servidor no le deja hacer nada que no le corresponda."

```
 ┌──────────────┐   HTTPS + JWT    ┌────────────────────── Supabase ───────────────────────┐
 │  App Sazón   │ ───────────────▶ │ Auth (JWT)   PostgREST (API)   Storage   Realtime      │
 │ React Native │ ◀─────────────── │                 │                                     │
 │   (Expo)     │   datos / push   │          PostgreSQL + RLS + triggers                  │
 └──────────────┘                  │            │ pg_net             │ pg_cron            │
        ▲                          └────────────┼────────────────────┼────────────────────┘
        │  push                                 ▼                    ▼
        └──────────── Firebase (FCM) ◀── Expo Push API      tareas programadas
```

**¿Por qué Supabase y no un backend propio?** Trabajo individual → la consigna (4.2) lo permite. Me deja concentrarme en el diseño de datos y la seguridad, que es lo importante. Y no es "caja negra": el backend es el archivo `schema.sql` que escribí (tablas, políticas, triggers, funciones).

**¿Por qué Expo?** Con un solo código genero Android, iOS y web. EAS compila el APK en la nube.

---

## 2. Base de datos (`supabase/schema.sql`)
| Tabla | Para qué | Relación |
|---|---|---|
| `profiles` | Datos públicos del usuario + **rol** + preferencias de notificación | 1–1 con `auth.users` |
| `categories` | Categorías (ABM del admin) | 1–N con recetas |
| `recipes` | Recetas: ingredientes y pasos como arrays, foto, pública/privada, contadores | N–1 autor, N–1 categoría |
| `comments` | Comentarios | N–1 receta, N–1 usuario |
| `ratings` | Estrellas 1–5. PK (receta, usuario) → **una por persona** | N–N usuarios↔recetas |
| `favorites` | Favoritas. PK compuesta | N–N |
| `follows` | Quién sigue a quién. CHECK: no seguirse a uno mismo | N–N usuarios↔usuarios |
| `notifications` | Historial de avisos de cada usuario | N–1 usuario |
| `push_tokens` | Token de cada celular para mandarle push | N–1 usuario |

- **Validaciones también en la base**: `CHECK` de longitudes, rangos (1–5 estrellas, 1–1440 min), formato de usuario `^[a-z0-9_]{3,20}$`.
- **Contadores** (`avg_rating`, `comment_count`, etc.) los mantiene un **trigger**; así el inicio no tiene que calcular promedios en cada consulta.
- `ON DELETE CASCADE`: si se borra una receta, se borran sus comentarios, valoraciones y favoritos.

---

## 3. Autenticación
- **Registro / login**: `supabase.auth.signUp` / `signInWithPassword`. Supabase guarda la contraseña con **bcrypt**; yo nunca la veo.
- **JWT**: al iniciar sesión se recibe un *access token* (JWT, dura 1 h) y un *refresh token*. Cada pedido a la API manda el JWT; la base lee el `id` del usuario con `auth.uid()`.
- **Sesión persistente**: la sesión se guarda en `expo-secure-store` (llavero cifrado del sistema: Keystore en Android). Como admite valores chicos, lo divido en pedazos (`lib/supabase.ts`). Al abrir la app se recupera y se renueva sola (`autoRefreshToken`).
- **Perfil automático**: un trigger en `auth.users` crea la fila en `profiles` (también para los que entran con GitHub).
- **Recuperar contraseña**: pido un **código de 6 dígitos** por email (`resetPasswordForEmail`), lo verifico con `verifyOtp({type:'recovery'})` y actualizo con `updateUser`. Elegí código en vez de link porque los links profundos fallan según dónde abras el mail; el código funciona siempre. Por seguridad la app no dice si el email existe.
- **Cambiar contraseña**: pido la actual y re-autentico antes de cambiarla.
- **Social login (GitHub)**: OAuth 2.0 con **PKCE**. La app abre el navegador, GitHub vuelve a `sazon://auth-callback?code=...` y cambio ese código por una sesión. PKCE evita que otra app que intercepte el código pueda usarlo.

---

## 4. Roles y seguridad (lo más importante)
**Roles:** `user`, `moderator`, `admin` (columna `role` en `profiles`).

| Acción | Usuario | Moderador | Admin |
|---|---|---|---|
| Crear / editar / borrar **sus** recetas | ✅ | ✅ | ✅ |
| Ver recetas privadas ajenas | ❌ | ✅ | ✅ |
| Borrar recetas y comentarios ajenos | ❌ | ✅ | ✅ |
| ABM de categorías | ❌ | ❌ | ✅ |
| Cambiar roles | ❌ | ❌ | ✅ (no el propio) |

**Cómo se controla en el backend (no sólo ocultando botones):**
1. **Row Level Security (RLS)** activado en todas las tablas. Ej.: `editar receta propia o staff` → `using (author_id = auth.uid() or is_staff())`. Si un usuario intenta editar otra receta, la base devuelve 0 filas y la app muestra "No tenés permiso".
2. **Permisos por columna (`GRANT UPDATE (...)`)**: un usuario puede editar su perfil, **pero no la columna `role`**. Tampoco puede escribir los contadores (`avg_rating`). Intentarlo da `permission denied`.
3. **Cambio de rol** sólo por la función `set_user_role`, que verifica `is_admin()` adentro.
4. **No se puede valorar la receta propia** (política con `not exists`).
5. **Storage**: cada usuario sólo puede subir/borrar dentro de la carpeta con su id (`<uid>/foto.jpg`).
6. **`push_tokens`** no tiene ninguna política → nadie puede leer tokens ajenos; sólo se escriben con una función.

**Demostración en vivo:** entrar como usuario común y mostrar que no aparece "Editar" en recetas ajenas; y explicar que aunque se llamara a la API a mano, RLS lo rechaza. (Lo probé con tests: actualizar el rol propio → `permission denied`; editar receta ajena → 0 filas; valorar la propia → error de RLS.)

**¿La key en la app no es un secreto expuesto?** No: la *anon/publishable key* es pública por diseño (identifica el proyecto, no da permisos). Lo que da permisos es el JWT del usuario + RLS. La *service_role key* (que saltea RLS) **no** está en la app ni en el repo. El `.env` está en `.gitignore` y en el build se inyecta desde las variables de entorno de EAS.

---

## 5. Notificaciones push
Flujo cuando alguien comenta tu receta:
1. La app inserta en `comments`.
2. Un **trigger** (`notify_on_comment`) inserta una fila en `notifications` para el autor (si tiene activado ese tipo de aviso).
3. Otro **trigger** sobre `notifications` busca los `push_tokens` del destinatario y hace un **POST asíncrono** con `pg_net` a la API de Expo Push.
4. Expo lo entrega vía **Firebase Cloud Messaging** al celular.
5. Al tocar la notificación, la app abre la receta.
6. En paralelo, **Supabase Realtime** actualiza el contador de la pestaña "Avisos" sin recargar.

Eventos que notifican: comentario, valoración, nuevo seguidor, receta nueva de alguien que seguís, cambio de rol, receta del día.
Registro del dispositivo: al iniciar sesión se pide permiso y se guarda el *Expo Push Token* (`register_push_token`). Al cerrar sesión se borra, para que no le lleguen avisos de otra cuenta.

**¿Por qué desde la base y no desde la app?** Porque el que comenta no debería poder mandar push a cualquiera; lo decide el servidor en base a datos reales.

---

## 6. Procesos en segundo plano
- **`pg_cron` — Receta del día**: todos los días a las 11:00 (ARG) elige la mejor receta reciente y notifica a quienes lo tengan activado.
- **`pg_cron` — Limpieza semanal**: borra notificaciones leídas viejas y tokens de push abandonados (90 días).
- **`pg_net`**: los envíos de push son asíncronos; no frenan la acción del usuario.
- **En la app**: el SDK renueva el JWT en segundo plano mientras la app está activa, y el sistema operativo recibe los push aunque la app esté cerrada.

**¿Por qué no hay tareas de segundo plano dentro de la app?** No hace falta sincronizar datos offline ni procesar archivos pesados: todo vive en el servidor y se consulta en el momento. Poner tareas en el servidor es más confiable (Android mata los procesos de fondo de las apps para ahorrar batería).

---

## 7. Validaciones y errores
- **En la app** (`lib/validation.ts`): obligatorios, formato de email, contraseña (8+ con letras y números), usuario, rangos numéricos; el error aparece debajo de cada campo.
- **En la base**: `CHECK`, `UNIQUE`, claves foráneas — por si alguien saltea la app.
- **Traducción de errores** (`lib/errors.ts`): credenciales inválidas, email ya registrado, sin conexión, permiso denegado, registro inexistente, código vencido, imagen muy grande, errores 500…
- **Estados**: cada pantalla tiene *cargando*, *error con botón Reintentar*, *vacío* y *pull to refresh*. Banner rojo global "Sin conexión a internet".

---

## 8. Distribución
- **APK** compilado con **EAS Build** (en la nube, perfil `preview` → `buildType: apk`). Firmado con un keystore que guarda Expo.
- Las variables `EXPO_PUBLIC_*` se inyectan en el build desde EAS (no están en el repo).
- El APK se publica en **GitHub Releases** y la web (GitHub Pages, carpeta `docs/`) tiene botón, QR e instrucciones.
- **¿Por qué APK y no Expo Go?** Desde SDK 53 Expo Go no recibe push remotos en Android, y desde SDK 56 Expo Go ya no está en las tiendas. El APK es una app real e independiente.
- Requisito fundamental cumplido: otra persona descarga el APK, crea una cuenta y usa todo **sin mi compu**, porque el backend está en la nube.

---

## 9. Preguntas probables (respuestas cortas)
- **¿Qué pasa si borro un usuario?** `delete_my_account` borra de `auth.users`; por `CASCADE` se borran perfil, recetas, comentarios, etc.
- **¿Cómo evitás que alguien se haga admin?** No tiene permiso de UPDATE sobre la columna `role` y la única forma es `set_user_role`, que exige ser admin.
- **¿Qué es `SECURITY DEFINER`?** La función corre con permisos del dueño. La uso para leer el rol sin recursión de RLS y para triggers que escriben notificaciones a otros usuarios. Todas tienen `search_path = ''` para evitar ataques de suplantación de funciones.
- **¿Cómo se guardan las imágenes?** En Supabase Storage; en la tabla sólo guardo la ruta. Se comprimen al elegirlas (calidad 60 %) y hay límite de 5 MB.
- **¿Qué es Expo Router?** Navegación basada en archivos: cada archivo en `app/` es una pantalla. Los grupos `(auth)` y `(tabs)` organizan sin cambiar la URL. Uso `Stack.Protected` para que sin sesión sólo se vea login/registro.
- **¿Cómo funciona el tema?** Un contexto de React con paleta clara/oscura; el modo (sistema/claro/oscuro) se guarda en AsyncStorage.
- **¿Qué mejorarías?** Búsqueda por ingredientes con full-text search, modo offline, lista de compras, publicar en Play Store.
