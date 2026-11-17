# Preparación para la defensa — Código Ω

La defensa **no es sólo mostrar**: tenés que poder explicar las decisiones. Acá está todo lo que te pueden preguntar.

---

## 1. Arquitectura en una frase
> "Es un juego hecho en React Native con Expo que habla con Supabase. Supabase me da PostgreSQL con API REST automática, autenticación con JWT, almacenamiento y tiempo real. El cliente nunca manda el puntaje: manda lo que hizo en la partida y el servidor valida que sea posible y calcula el puntaje oficial. Los permisos están en la base con Row Level Security."

```
 ┌──────────────┐  HTTPS + JWT   ┌──────────────────────── Supabase ─────────────────────────┐
 │  App Código Ω│ ─────────────▶ │ Auth (JWT)  PostgREST/RPC  Storage  Realtime              │
 │ React Native │ ◀───────────── │       │                                                    │
 │ (motor local)│  datos / push  │  PostgreSQL + RLS + triggers + start_run / finish_run     │
 └──────────────┘                │       │ pg_net                     │ pg_cron               │
        ▲                        └───────┼────────────────────────────┼───────────────────────┘
        │ push                           ▼                            ▼
        └───────── Firebase (FCM) ◀── Expo Push API        diario · premios · limpieza
```

**¿Por qué Supabase y no un backend propio?** Trabajo individual → la consigna (4.2) lo permite. Y no es caja negra: toda la lógica del servidor (tablas, políticas, triggers, validación de partidas, rankings, tareas programadas) la escribí en `schema.sql`.

**¿Por qué Expo?** Un solo código para Android, iOS y web. EAS compila el APK en la nube.

---

## 2. El juego (`app/lib/game.ts`)
- **Motor puro**: un *reducer* `(estado, acción) → nuevo estado` sin React. Acciones: `input` (flecha), `tick` (pasa el tiempo), `next` (siguiente ronda). Por eso se puede testear solo: `npm test` corre 5 tests (`app/tests/game.test.mjs`).
- **Reglas**: la ronda *r* trae `min(2 + r, 10)` protocolos. Barra de tiempo llena al empezar cada ronda. Código completo: +0,6 s. Error: reinicia el código y resta 0,3 s.
- **Semilla**: la secuencia sale de un generador pseudoaleatorio (*mulberry32*) con una semilla que manda el servidor. En el **diario** y en los **desafíos** la semilla es fija → todos juegan exactamente lo mismo, el ranking es justo.
- **Puntaje** = flechas × 10 + Σ(50 + 25·ronda) + rondas perfectas × 100 + tiempo sobrante / 100 ms. La misma fórmula está en la app (para mostrar) y en `compute_score()` del servidor (la oficial).
- **Pantalla** (`app/game.tsx`): reloj con `setInterval` de 50 ms; si la app se va a segundo plano, el salto de tiempo se limita a 100 ms (pausa natural). Entrada por pad, deslizando el dedo (`PanResponder`) o teclado en web. Vibración con `expo-haptics`.

---

## 3. Base de datos
| Tabla | Para qué |
|---|---|
| `profiles` | Datos públicos, **rol**, preferencias de notificación |
| `protocols` | Catálogo: nombre, código (`^[UDLR]{3,8}$`), categoría, activo — ABM del admin |
| `challenges` | Desafíos de usuarios: protocolos elegidos (array), rondas, tiempo, semilla, contadores — ABM de usuarios |
| `runs` | Cada partida: modo, semilla, inicio/fin, lo que reportó el cliente, puntaje, estado (`started` / `finished` / `rejected`) |
| `best_scores` | Mejor puntaje por usuario y por tabla (`classic`, `classic:week:2026-47`, `daily:2026-11-17`, `challenge:<id>`) |
| `daily_challenges` | Semilla de cada día (la crea una tarea programada) |
| `comments`, `ratings`, `favorites`, `follows` | Interacción entre usuarios |
| `notifications`, `push_tokens` | Avisos y dispositivos |

- `challenges.protocol_ids` es un array: como un array no tiene clave foránea, un **trigger** valida que existan y quita duplicados. Si el admin borra un protocolo, otro trigger lo saca de los desafíos (o lo impide si alguno quedaría con menos de 2).
- `CHECK` en la base: largos, rangos (1–20 rondas, 5–20 s), formato de código y de usuario.
- Contadores (valoración promedio, comentarios, favoritos) mantenidos por triggers.

---

## 4. Anti-trampa: partidas validadas en el servidor (lo más fuerte del proyecto)
1. `start_run(modo)` → el servidor crea la partida, guarda **la hora de inicio** y devuelve semilla, reglas y protocolos.
2. Se juega en el celular.
3. `finish_run(id, flechas, rondas, perfectas, tiempo_sobrante, errores)` → el servidor:
   - verifica que la partida sea tuya y no esté ya registrada,
   - rechaza lo imposible: más rondas que las del desafío, más perfectas que rondas, tiempo sobrante mayor al máximo, **más de 15 flechas por segundo** según el tiempo real transcurrido, menos flechas de las mínimas para esas rondas,
   - calcula el puntaje **él mismo**,
   - actualiza `best_scores` y te devuelve tu puesto.
4. Las tablas `runs` y `best_scores` **no tienen permiso de escritura** para los usuarios: sólo se escriben desde esas funciones.
5. Límite: 20 partidas por minuto por usuario.

Lo probé: mandar 5000 flechas en 1 segundo → `rejected: demasiadas flechas para el tiempo jugado`; insertar un puntaje directo → `permission denied`; registrar dos veces → error.

*Límite honesto*: alguien que programe un bot que juegue "humanamente" podría pasar. Para eso haría falta guardar cada flecha con su tiempo y re-simular la partida en el servidor (mejora posible).

---

## 5. Autenticación
- Registro/login con `supabase.auth`; contraseñas con **bcrypt** en Supabase.
- **JWT** de acceso (1 h) + refresh token. La base identifica al usuario con `auth.uid()`.
- **Sesión persistente** cifrada en `expo-secure-store` (Keystore de Android), partida en pedazos porque admite valores chicos. Se renueva sola.
- Perfil creado por **trigger** al registrarse (también con GitHub).
- **Recuperar contraseña** con código de 6 dígitos por email (`verifyOtp` tipo `recovery` + `updateUser`). Código en vez de link: funciona igual en APK, web o donde abras el mail. No revela si el email existe.
- **Cambiar contraseña** pide la actual.
- **GitHub OAuth con PKCE**: el navegador vuelve a `codigoomega://auth-callback?code=…` y ese código se cambia por la sesión.

---

## 6. Roles y seguridad
| Acción | Usuario | Moderador | Admin |
|---|---|---|---|
| Jugar, crear/editar/borrar **sus** desafíos | ✅ | ✅ | ✅ |
| Ver desafíos privados ajenos | ❌ | ✅ | ✅ |
| Borrar desafíos y comentarios ajenos | ❌ | ✅ | ✅ |
| ABM de protocolos | ❌ | ❌ | ✅ |
| Cambiar roles | ❌ | ❌ | ✅ (no el propio) |

Controlado en el backend, no ocultando botones:
- **RLS** en todas las tablas (ej.: `editar desafio propio o staff`).
- **GRANT por columna**: el usuario edita su perfil pero **no** la columna `role`, ni contadores, ni la semilla del desafío.
- Rol sólo por `set_user_role()` que verifica `is_admin()`.
- No podés valorar tu propio desafío.
- Storage: cada uno escribe sólo en su carpeta `avatars/<su-id>/`.
- `push_tokens` sin políticas: nadie lee tokens ajenos.
- Funciones `SECURITY DEFINER` con `search_path = ''`.

**¿La key en la app no es un secreto?** No: la *anon key* es pública por diseño; los permisos los dan el JWT + RLS. La *service_role* no está en la app ni en el repo.

---

## 7. Notificaciones push
Eventos reales: **te sacaron el primer puesto**, comentario y valoración en tu desafío, nuevo seguidor, desafío nuevo de alguien que seguís, desafío diario disponible, podio semanal, cambio de rol.

Flujo: el evento → trigger inserta en `notifications` → otro trigger busca los `push_tokens` del destinatario → `pg_net` hace un POST **asíncrono** a Expo Push → Firebase lo entrega → al tocarla se abre el desafío o el ranking. **Realtime** actualiza el contador de "Avisos" en vivo. Cada tipo se puede desactivar en Configuración.

---

## 8. Procesos en segundo plano (`pg_cron`)
| Tarea | Cuándo | Qué hace |
|---|---|---|
| `omega-diario-crear` | 00:00 ARG | Crea la semilla del desafío del día |
| `omega-diario-aviso` | 11:00 ARG | Notifica a quienes todavía no jugaron el diario |
| `omega-premios-semana` | lunes 00:10 | Avisa al podio de la semana anterior |
| `omega-limpieza` | domingos | Borra partidas abandonadas, avisos viejos, tokens viejos y rankings diarios antiguos |

En la app: renovación del JWT en segundo plano; el sistema operativo recibe los push con la app cerrada. No hay tareas de fondo en el celular porque Android las mata para ahorrar batería y todo lo importante vive en el servidor.

---

## 9. Validaciones y errores
- App: obligatorios, email, contraseña (8+ con letras y números), usuario, 2–30 protocolos por desafío, código de 3–8 flechas.
- Base: `CHECK`, `UNIQUE`, triggers de validación.
- `lib/errors.ts` traduce todo a mensajes claros (credenciales, email repetido, sin conexión, sin permiso, código vencido, imagen grande, etc.).
- Cada pantalla: cargando, error con **Reintentar**, vacío, pull-to-refresh, banner "Sin conexión". Si falla el envío del resultado, botón **Reintentar envío**.

---

## 10. Distribución
- **APK** con **EAS Build** (perfil `preview` → `apk`), firmado con keystore de Expo. Variables `EXPO_PUBLIC_*` inyectadas desde EAS.
- APK en **GitHub Releases**; web en **GitHub Pages** con botón, QR, instrucciones y una **demo jugable**.
- ¿Por qué no Expo Go? No recibe push remotos en Android desde SDK 53.

---

## 11. Preguntas probables
- **¿De dónde sale la idea?** De los minijuegos de "ingresar combinaciones" de algunos videojuegos. La mecánica no se puede registrar; el nombre, el tema, los protocolos y los códigos son propios.
- **¿Cómo garantizás que el diario sea igual para todos?** Misma semilla (tabla `daily_challenges`) + mismo orden de protocolos (por id) + generador determinístico. Hay un test que lo verifica.
- **¿Qué pasa si se corta internet al terminar?** La partida queda `started` en el servidor; la app muestra "Reintentar envío". Si nunca se envía, la limpieza semanal la borra.
- **¿Qué pasa si se borra un usuario?** `ON DELETE CASCADE` borra perfil, partidas, puntajes, desafíos y comentarios.
- **¿Por qué el ranking guarda sólo el mejor puntaje?** Una fila por usuario y tabla (`best_scores`) → consultas rápidas con índice `(board, score desc)`; el historial completo queda en `runs`.
- **¿Qué mejorarías?** Re-simular la partida completa en el servidor, sonidos, modo multijugador en vivo con Realtime, publicar en Play Store.
