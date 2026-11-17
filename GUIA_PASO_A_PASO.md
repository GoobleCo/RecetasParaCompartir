# Guía paso a paso — lo que tenés que hacer vos

El código, la base de datos, la seguridad, las notificaciones, la web y la documentación **ya están hechos**.
Falta lo que necesita **tus cuentas** (Supabase, GitHub, Expo, Firebase) y **una compu** para compilar el APK.

| Parte | Dónde | Tiempo aprox. |
|---|---|---|
| A. Cuentas y backend | 📱 o 💻 | 40–60 min |
| B. Compilar el APK y publicar | 💻 Compu | 1–1,5 h (la mitad es esperar) |
| C. Usuarios de prueba y verificación | 📱 Celular | 20 min |

> ⚠️ La consigna pide que el proyecto final evolucione el de la primera mitad del año. Si cambiaste de idea, acordalo con el profe (punto 5).

> 🔁 **¿Ya habías hecho la Parte A con la versión de recetas ("Sazón")?** No empieces de cero:
> - **Supabase:** el mismo proyecto sirve. Volvé a ejecutar `supabase/schema.sql`: borra solo lo de recetas y crea lo del juego.
> - **Redirect URL:** agregá `codigoomega://auth-callback` (A3.2).
> - **Expo:** creá un proyecto nuevo con slug **`codigo-omega`** (A6) y cargale las mismas 3 variables.
> - **Firebase:** en el mismo proyecto agregá una app Android nueva con paquete **`com.codigoomega.app`** y descargá el `google-services.json` nuevo (A7).
> - GitHub OAuth y el SMTP de Gmail quedan igual.

---

## PARTE A — Cuentas y backend

### A1. Cuenta de GitHub
Ya la tenés (el código está en `GoobleCo/RecetasParaCompartir`).

### A2. Proyecto en Supabase (backend + base de datos)
1. <https://supabase.com> → **Start your project** → ingresá con GitHub.
2. **New project**: nombre `codigo-omega`, región **South America (São Paulo)**, generá una contraseña de base de datos y **guardala**.
3. Esperá ~2 minutos.
4. **SQL Editor → New query** → pegá **todo** `supabase/schema.sql` → **Run**. Tiene que decir *Success*.
   - Si da error con `pg_cron` o `pg_net`: **Database → Extensions**, activá `pg_cron` y `pg_net` y ejecutalo de nuevo (se puede correr las veces que quieras).
5. **Project Settings → API** (o **API Keys**) y anotá:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public key** (o **publishable key**)
   - ❌ **Nunca** uses la `service_role` / `secret` key en la app.

### A3. Configurar el login
1. **Authentication → Sign In / Providers → Email**: desactivá **Confirm email** y guardá.
2. **Authentication → URL Configuration → Redirect URLs** → agregá:
   ```
   codigoomega://auth-callback
   exp://**
   http://localhost:8081/**
   ```
3. **Authentication → Emails → Templates → Reset Password**. Asunto: `Tu código de Código Ω`. Cuerpo:
   ```html
   <h2>Recuperar contraseña de Código Ω</h2>
   <p>Tu código para crear una contraseña nueva es:</p>
   <h1 style="letter-spacing:6px">{{ .Token }}</h1>
   <p>Ingresalo en la app. Si no lo pediste, ignorá este mensaje.</p>
   ```

### A4. Envío de emails con Gmail (para "recuperar contraseña")
1. Google → **Gestionar cuenta → Seguridad** → activá **Verificación en 2 pasos**.
2. <https://myaccount.google.com/apppasswords> → creá una llamada `Omega` → copiá la clave de 16 letras.
3. Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Sender email: tu Gmail · Sender name: `Código Ω`
   - Host `smtp.gmail.com` · Port `465` · Username: tu Gmail · Password: la clave de 16 letras

### A5. Login con GitHub
1. <https://github.com/settings/developers> → **OAuth Apps → New OAuth App**:
   - Name: `Código Ω`
   - Homepage URL: `https://goobleco.github.io/RecetasParaCompartir/`
   - Authorization callback URL: `https://xxxx.supabase.co/auth/v1/callback` (tu Project URL + `/auth/v1/callback`)
2. Copiá el **Client ID**, tocá **Generate a new client secret** y copialo.
3. Supabase → **Authentication → Sign In / Providers → GitHub** → activalo, pegá ambos → Save.

### A6. Proyecto en Expo (compila el APK en la nube)
1. <https://expo.dev> → registrate (podés usar GitHub).
2. **Create a project** → slug **`codigo-omega`** (exactamente ese).
3. Copiá el **Project ID**.
4. En el proyecto → **Environment variables** → agregá estas 3 para **preview** y **production**:
   | Nombre | Valor |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | tu Project URL |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | tu anon/publishable key |
   | `EXPO_PUBLIC_OAUTH_PROVIDERS` | `github` |

### A7. Firebase (para que lleguen los push en Android)
1. <https://console.firebase.google.com> → **Crear proyecto** (podés desactivar Analytics).
2. **Agregar app → Android** → paquete **`com.codigoomega.app`** → descargá **`google-services.json`**.
3. ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → se baja un `.json` **secreto** (no lo subas a GitHub).
4. expo.dev → tu proyecto → **Credentials → Android → com.codigoomega.app → FCM V1 service account key → Upload** → subí ese `.json`.
   Si el paquete todavía no aparece, hacelo después del primer build.

---

## PARTE B — En la compu

### B1. Herramientas
- **Node.js LTS** (24 o más nuevo): <https://nodejs.org>
- **Git**: <https://git-scm.com>

### B2. Bajar y preparar el proyecto
```bash
git clone https://github.com/GoobleCo/RecetasParaCompartir.git
cd RecetasParaCompartir/app
```
1. Copiá `google-services.json` (de A7) dentro de la carpeta `app`.
2. Creá el `.env` y completá URL y key de Supabase:
   ```bash
   cp .env.example .env      # en Windows: copy .env.example .env
   ```
3. Instalá y verificá:
   ```bash
   npm install --legacy-peer-deps
   npm run setup
   npm test                  # tests del motor del juego
   npx tsc --noEmit
   npx expo-doctor
   ```
   Si aparece algún error, copiámelo y lo arreglamos.

### B3. Probar en el navegador (opcional, 2 min)
```bash
npx expo start --web
```
Registrate y jugá una partida con las flechas del teclado. Después cortá con Ctrl+C.

### B4. Compilar el APK
```bash
npx eas-cli@latest login
npx eas-cli@latest init --id TU-PROJECT-ID
npx eas-cli@latest build -p android --profile preview
```
- Si pregunta por el **Android Keystore** → **Yes**.
- Tarda 10–20 min en la nube (seguilo desde expo.dev aunque cierres la compu).
- Descargá el APK y **renombralo a `codigo-omega.apk`**.

### B5. Subir `google-services.json`
```bash
cd ..
git add app/google-services.json
git commit -m "Agrego google-services.json"
git push
```
Verificá en GitHub que **no** se subieron `.env` ni el `.json` secreto de Firebase.

### B6. Publicar el APK y la web
1. GitHub → repo → **Releases → Create a new release** → tag `v1.0.0` → arrastrá `codigo-omega.apk` → **Publish**.
2. **Settings → Pages** → Source **Deploy from a branch** → Branch `main`, carpeta **`/docs`** → Save.
   La web queda en `https://goobleco.github.io/RecetasParaCompartir/`.
3. Editá `docs/index.html` (con el lápiz ✏️) y poné tu nombre en `author`.

> Opcional: podés renombrar el repo (Settings → General) a algo como `CodigoOmega`. Si lo hacés, actualizá los links de `docs/index.html` y el README, porque la dirección de la web cambia.

---

## PARTE C — Usuarios de prueba y verificación

### C1. Cuentas de prueba
1. Instalá el APK desde la web (así probás también la descarga).
2. Registrá 3 cuentas (los alias de Gmail llegan todos a tu casilla):
   `tugmail+admin@gmail.com`, `tugmail+moderador@gmail.com`, `tugmail+usuario@gmail.com`
3. Supabase → SQL Editor: abrí `supabase/seed.sql`, cambiá los 3 emails y ejecutalo (asigna roles y carga desafíos y puntajes de ejemplo).
4. Completá `CREDENCIALES_DOCENTE.md` y mandáselo **en privado** al profe.

### C2. Acceso del profe al backend
Supabase → **Organization settings → Team → Invite** → email del profe con rol **Read-only**.

### C3. Checklist para la defensa
- [ ] Crear usuario, cerrar la app y reabrir → sigue logueado
- [ ] Recuperar contraseña con el código por email · Login con GitHub
- [ ] Jugar clásico y diario → aparece el puesto en el ranking
- [ ] Crear, editar, jugar y eliminar un desafío
- [ ] Desde otra cuenta superar tu puntaje → te llega el push "¡Perdiste el primer puesto!"
- [ ] Comentar / valorar un desafío ajeno → notificación al autor
- [ ] Como **usuario**: no aparece "Editar" en desafíos ajenos (y el backend lo rechaza igual)
- [ ] Como **moderador**: borrar un comentario ajeno desde Administración
- [ ] Como **admin**: cambiar un rol, crear/editar/desactivar un protocolo
- [ ] Configuración → Probar notificación · Tema claro / oscuro / sistema
- [ ] Modo avión → aviso "Sin conexión" y errores claros
- [ ] Web pública: QR, descarga y demo jugable

> 💤 Los proyectos gratis de Supabase se **pausan tras 7 días sin uso**. El día anterior a la defensa entrá al panel y jugá una partida; si está pausado, tocá **Restore project**.

Leé `DEFENSA.md` para preparar las explicaciones técnicas.
