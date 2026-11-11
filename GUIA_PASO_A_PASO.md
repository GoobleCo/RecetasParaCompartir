# Guía paso a paso — lo que tenés que hacer vos

El código, la base de datos, la seguridad, las notificaciones, la web y la documentación **ya están hechos**.
Lo que falta son cosas que requieren **tus cuentas** (Supabase, GitHub, Expo, Firebase) y **una compu** para compilar el APK.

Orden recomendado:

| Parte | Dónde | Tiempo aprox. |
|---|---|---|
| A. Cuentas y backend | 📱 Celular (podés hacerla ya) | 40–60 min |
| B. Compilar el APK y subir todo | 💻 Compu | 1–1,5 h (la mitad es esperar) |
| C. Usuarios de prueba y verificación | 📱 Celular | 20 min |

> ⚠️ **Antes de empezar:** la consigna dice que el proyecto final debe evolucionar el de la primera mitad del año. Si tu proyecto anterior **no** era de recetas, avisale al profe y acordalo con él (punto 5 de la consigna).

---

## PARTE A — Desde el celular

### A1. Cuenta de GitHub
Si no tenés: <https://github.com/signup>. La vas a usar para todo lo demás (Supabase y Expo permiten entrar con GitHub).

### A2. Proyecto en Supabase (backend + base de datos)
1. Entrá a <https://supabase.com> → **Start your project** → ingresá con GitHub.
2. **New project**: nombre `sazon`, región **South America (São Paulo)**, generá una contraseña de base de datos y **guardala**.
3. Esperá ~2 minutos a que se cree.
4. Andá a **SQL Editor → New query**, pegá **todo** el contenido de `supabase/schema.sql` y tocá **Run**.
   - Tiene que decir *Success*. Crea tablas, seguridad, triggers, notificaciones, tareas programadas y storage.
   - Si da un error con `pg_cron` o `pg_net`: andá a **Database → Extensions**, activá `pg_cron` y `pg_net`, y volvé a ejecutar el script (se puede correr las veces que quieras).
5. Andá a **Project Settings → API** (o **API Keys**) y anotá:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public key** (o **publishable key**) → empieza con `eyJ...` o `sb_publishable_...`
   - ❌ **No** uses nunca la `service_role` / `secret` key en la app.

### A3. Configurar el login (Authentication)
1. **Authentication → Sign In / Providers → Email**: desactivá **Confirm email** (así los usuarios entran apenas se registran; el profe no tiene que confirmar nada). Guardá.
2. **Authentication → URL Configuration → Redirect URLs** → agregá estas tres:
   ```
   sazon://auth-callback
   exp://**
   http://localhost:8081/**
   ```
3. **Plantilla del email de recuperación**: **Authentication → Emails → Templates → Reset Password**. Reemplazá el cuerpo por:
   ```html
   <h2>Recuperar contraseña de Sazón</h2>
   <p>Tu código para crear una contraseña nueva es:</p>
   <h1 style="letter-spacing:6px">{{ .Token }}</h1>
   <p>Ingresalo en la app. Si no lo pediste, ignorá este mensaje.</p>
   ```
   Asunto: `Tu código de Sazón`. Guardá.

### A4. Envío de emails (SMTP con Gmail) — necesario para "recuperar contraseña"
El servidor de mails de prueba de Supabase sólo manda correos a los miembros del proyecto y tiene límite de envíos. Para que funcione con cualquier usuario, usá tu Gmail:
1. En tu cuenta de Google: **Gestionar cuenta → Seguridad** → activá **Verificación en 2 pasos**.
2. Buscá **Contraseñas de aplicaciones** (o entrá a <https://myaccount.google.com/apppasswords>) → creá una llamada `Sazon` → copiá la clave de 16 letras.
3. En Supabase: **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:
   - Sender email: tu Gmail · Sender name: `Sazón`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: tu Gmail · Password: la clave de 16 letras
4. Guardá.

### A5. Login con GitHub (Social Login)
1. En GitHub: <https://github.com/settings/developers> → **OAuth Apps → New OAuth App**:
   - Application name: `Sazón`
   - Homepage URL: `https://goobleco.github.io/RecetasParaCompartir` (después la web va a estar ahí)
   - Authorization callback URL: `https://xxxx.supabase.co/auth/v1/callback` (tu Project URL + `/auth/v1/callback`)
2. Creala, copiá el **Client ID** y tocá **Generate a new client secret** → copialo.
3. En Supabase: **Authentication → Sign In / Providers → GitHub** → activalo, pegá Client ID y Client Secret → Save.

### A6. Cuenta y proyecto en Expo (para compilar el APK en la nube)
1. Entrá a <https://expo.dev> → registrate (podés usar GitHub).
2. **Create a project** → nombre/slug: **`sazon-recetas`** (tiene que ser exactamente ese).
3. Copiá el **Project ID** (un código tipo `a1b2c3d4-...`).
4. En el proyecto → **Environment variables** → agregá estas 3, marcando los entornos **preview** y **production**:
   | Nombre | Valor |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | tu Project URL |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | tu anon/publishable key |
   | `EXPO_PUBLIC_OAUTH_PROVIDERS` | `github` |

### A7. Firebase (para que lleguen los push en Android)
Android entrega los push a través de Firebase Cloud Messaging. Es gratis.
1. <https://console.firebase.google.com> → **Crear proyecto** `sazon` (podés desactivar Analytics).
2. **Agregar app → Android** → nombre del paquete: **`com.sazon.recetas`** → Registrar → **descargá `google-services.json`** (guardalo, lo usás en la compu).
3. ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → se descarga un `.json`. **Es secreto: no lo subas a GitHub.**
4. En expo.dev → tu proyecto → **Credentials → Android → com.sazon.recetas → FCM V1 service account key → Upload** → subí ese `.json`.
   - Si el package todavía no aparece en Credentials, hacé este paso después del primer build (Parte B).

✅ Con esto la Parte A está lista.

---

## PARTE B — En la compu

### B1. Instalar herramientas (si la compu no las tiene)
- **Node.js LTS** (versión 22 o más nueva): <https://nodejs.org>
- **Git**: <https://git-scm.com>

### B2. Preparar el proyecto
1. Bajá el código (ya está en GitHub) y entrá a la carpeta de la app:
   ```bash
   git clone https://github.com/GoobleCo/RecetasParaCompartir.git
   cd RecetasParaCompartir/app
   ```
2. Copiá `google-services.json` (de A7) dentro de `RecetasParaCompartir/app/`.
3. Creá el archivo `.env` copiando `.env.example` y completá URL y key de Supabase:
   ```bash
   cp .env.example .env      # en Windows: copy .env.example .env
   ```
4. Instalá dependencias:
   ```bash
   npm install --legacy-peer-deps
   npm run setup
   ```
   `npm run setup` instala las versiones exactas compatibles con Expo SDK 56.
5. Verificá:
   ```bash
   npx tsc --noEmit
   npx expo-doctor
   ```
   Si aparece algún error, copiámelo y lo arreglamos.

### B3. Probar rápido en el navegador (opcional, 2 min)
```bash
npx expo start --web
```
Se abre en el navegador: registrate, creá una receta, probá el tema oscuro. (Push y fotos de galería se prueban en el APK.)

### B4. Vincular con Expo y compilar el APK
```bash
npx eas-cli@latest login
npx eas-cli@latest init --id TU-PROJECT-ID
npx eas-cli@latest build -p android --profile preview
```
- Si pregunta por generar un **Android Keystore** → **Yes**.
- `google-services.json` no es secreto y se sube junto con el código (sin él no llegan los push en Android).
- El build tarda 10–20 min **en la nube** (podés cerrar la compu y seguirlo desde expo.dev en el celular).
- Al terminar te da un link para descargar el **APK**. Descargalo.

> Si en A7 no pudiste subir la clave FCM, hacelo ahora (el package ya existe). No hace falta recompilar.

### B5. Subir tus cambios a GitHub
El código ya está subido. Sólo falta subir `google-services.json` (y cualquier cambio que hagas):
```bash
git add app/google-services.json
git commit -m "Agrego google-services.json"
git push
```
Verificá en GitHub que **NO** se subieron `.env` ni el `.json` de la cuenta de servicio de Firebase (están en `.gitignore`).

### B6. Publicar el APK y la web
1. **APK**: en GitHub → tu repo → **Releases → Create a new release** → tag `v1.0.0` → arrastrá el APK **renombrado a `sazon.apk`** → Publish.
   El link directo queda: `https://github.com/GoobleCo/RecetasParaCompartir/releases/latest/download/sazon.apk`
2. **Web**: los links ya apuntan a este repo. Sólo poné tu nombre en `docs/index.html` (bloque `CONFIG`, campo `author`); se puede desde GitHub con el lápiz ✏️, incluso desde el celular.
3. GitHub → repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, carpeta **`/docs`** → Save.
   En 1–2 minutos la web queda en `https://goobleco.github.io/RecetasParaCompartir/`.

✅ Listo con la compu.

---

## PARTE C — Usuarios de prueba y verificación (celular)

### C1. Crear las cuentas de prueba
1. Instalá el APK en tu celular (desde la web, así probás también la descarga).
2. Registrá 3 cuentas (podés usar alias de Gmail, todos llegan a tu casilla):
   - `tugmail+admin@gmail.com`
   - `tugmail+moderador@gmail.com`
   - `tugmail+usuario@gmail.com`
3. En Supabase → SQL Editor: abrí `supabase/seed.sql`, cambiá los 3 emails de arriba por esos y ejecutalo.
   Asigna los roles y carga recetas, comentarios y valoraciones de ejemplo.
4. Completá `CREDENCIALES_DOCENTE.md` (está en `.gitignore`) y mandáselo **en privado** al profe.

### C2. Para que el profe pueda ver el backend
Supabase → **Organization settings → Team → Invite** → el email del profe con rol **Read-only** (o Developer). Así puede ver tablas, políticas y funciones sin que le pases contraseñas.

### C3. Checklist antes de la defensa (todo lo que pueden pedirte)
- [ ] Crear usuario nuevo desde el APK
- [ ] Iniciar sesión, cerrar la app, volver a abrir → sigue logueado
- [ ] Recuperar contraseña con el código por email
- [ ] Login con GitHub
- [ ] Crear, editar, ver y eliminar una receta (con foto)
- [ ] Como **usuario**: intentar editar receta ajena → no aparece la opción (y el backend la rechaza igual)
- [ ] Como **moderador**: borrar un comentario ajeno desde Panel de administración
- [ ] Como **admin**: cambiar el rol de alguien, crear/editar/borrar una categoría
- [ ] Desde otra cuenta comentar una receta → llega el push al autor
- [ ] Configuración → **Probar notificación**
- [ ] Tema claro / oscuro / sistema
- [ ] Modo avión → aparece "Sin conexión" y los errores se explican bien
- [ ] Abrir la web pública, escanear el QR, descargar el APK

> 💤 **Importante:** los proyectos gratis de Supabase se **pausan tras 7 días sin uso**. El día anterior a la defensa entrá al panel de Supabase y usá la app un rato. Si está pausado, tocá **Restore project**.

Leé `DEFENSA.md` para preparar las explicaciones técnicas.
