# Agenda de demos — Calendario nativo + Google Calendar

La página `agenda.html` es un **calendario nativo de mes** (diseño propio, marca Parallelo) que
**agenda de verdad**. En cada cita:
1. **Crea el evento** en tu Google Calendar e **invita al lead** (con enlace de videollamada).
2. **Guarda los datos del lead** en Supabase (tabla `public.demo_bookings`).
3. **Envía 2 correos**: un aviso al equipo (`admin@parallelo.com.co`) y una confirmación al lead.

Cada integración es **independiente**: la que tenga sus variables de entorno puestas, funciona;
la que no, se omite sin romper el agendamiento. Sin variables, todo corre en **modo demo**
(el calendario funciona y "agenda", pero no toca Google/Supabase/correo). Apenas pongas las
variables en Netlify, pasa a operar de verdad — **sin tocar código**.

---

## Cómo funciona

```
index.html (form #demoForm)
  → guarda nombre/agencia/correo en sessionStorage
  → redirige a agenda.html
agenda.html  (calendario nativo de mes)
  → GET /api/availability  → Lun–Vie, 4 horarios por día (escasez), hora Colombia
  → lead elige día en el calendario + horario + confirma
  → POST /api/book →
       1. crea el evento en Google Calendar + invita al lead (con Meet)
       2. guarda la fila en Supabase (demo_bookings)
       3. manda correo al equipo + correo de confirmación al lead
```

**Mecanismo de escasez:** de todos los horarios posibles del día (9:00–17:00, demos de 30 min),
solo se muestran **4 por día**, elegidos de forma estable por fecha. El resto "parece reservado".
Refrescar NO baraja los horarios. Si un horario ya está ocupado en tu calendario, nunca aparece.

Reglas en [`netlify/functions/_config.js`](netlify/functions/_config.js) (ventana, duración,
nº de slots mostrados, horizonte de 14 días, anticipación mínima de 2 h).

---

## Paso 1 — Autenticación con Google (OAuth, recomendado)

Usamos **OAuth** (no service account): el evento se crea COMO el usuario autorizado, con **link
de Meet nativo**, sin compartir calendario y sin llaves descargables (que muchas orgs Workspace
bloquean por seguridad). Es un setup de una sola vez.

**1.1 — Pantalla de consentimiento (Internal)**
- Google Cloud Console → **APIs y servicios → Pantalla de consentimiento de OAuth** (consolas
  nuevas: *Google Auth Platform → Comenzar*).
- **Tipo de usuario: Interno** (no requiere verificación de Google).
- App: nombre `Agentix`, correo de soporte y contacto = la cuenta del calendario. Guardar.

**1.2 — Habilitar la API**
- **APIs y servicios → Biblioteca →** busca **Google Calendar API → Habilitar**.

**1.3 — Crear el cliente OAuth (Desktop)**
- **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth.**
- Tipo: **Aplicación de escritorio** → Crear → copia el **Client ID** y el **Client secret**.

**1.4 — Obtener el refresh token (una vez)**
- Pon el Client ID y Secret en `apps/web/.env`:
  ```
  GOOGLE_OAUTH_CLIENT_ID=...
  GOOGLE_OAUTH_CLIENT_SECRET=...
  ```
- Corre: `cd apps/web && node scripts/google-oauth-setup.js`
- Abre la URL que imprime, autoriza con la cuenta del calendario, y el script guarda solo
  `GOOGLE_OAUTH_REFRESH_TOKEN` y `GOOGLE_CALENDAR_ID=primary` en `.env`.

> El Meet nativo se crea solo en **Workspace**. En Gmail personal puede no generarse vía API;
> en ese caso define `MEETING_URL` (tu sala fija) como respaldo.

## Paso 2 — Variables de Google en Netlify

| Variable | Valor |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | el Client ID del cliente OAuth |
| `GOOGLE_OAUTH_CLIENT_SECRET` | el Client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | el que generó el script |
| `GOOGLE_CALENDAR_ID` | `primary` (o el ID/correo del calendario) |
| `MEETING_URL` | *(opcional)* sala fija de respaldo |

Tras guardar, **redeploy**. Listo: agenda de verdad.

---

## Paso 4 — Guardar los leads en Supabase

**Ya está listo.** La tabla `public.demo_bookings` se creó en el Supabase de Agentix
(migración [`supabase/migrations/0003_demo_bookings.sql`](../../supabase/migrations/0003_demo_bookings.sql)).
Cada cita guarda: nombre, correo, agencia, # de clientes, fecha/hora, estado, link de Meet y el ID
del evento de calendario.

Solo necesitas darle a la función acceso a Supabase con **dos variables** en Netlify (las mismas
del `.env` del repo):

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` (igual que en `.env`) |
| `SUPABASE_SERVICE_ROLE_KEY` | la llave **service_role** (`sb_secret_...`) — secreta |

> La tabla tiene RLS deny-by-default: nadie la lee con llaves públicas; solo la función (service_role)
> escribe. **Nunca** pongas la `service_role` en el cliente.

Para ver los leads: Supabase → **Table editor → demo_bookings** (o un query
`select * from demo_bookings order by created_at desc`).

---

## Paso 5 — Correos automáticos (aviso al equipo + confirmación al lead)

En cada cita se mandan **dos correos** vía Gmail SMTP:
- **Al equipo** → `admin@parallelo.com.co`: los datos completos del lead (responder va al lead).
- **Al lead** → su correo: confirmación con fecha/hora y enlace de la videollamada.

Necesitas una **contraseña de aplicación** de la cuenta de Gmail que enviará los correos:

1. La cuenta de envío necesita **verificación en 2 pasos** activada
   ([myaccount.google.com/security](https://myaccount.google.com/security)).
2. Ve a **[App passwords](https://myaccount.google.com/apppasswords)** → crea una para "Correo".
   Te da 16 caracteres (sin espacios).
3. Pon estas variables en Netlify:

| Variable | Valor |
|---|---|
| `GMAIL_USER` | el correo que envía (p.ej. `admin@parallelo.com.co`) |
| `GMAIL_APP_PASSWORD` | los 16 caracteres del paso 2 (secreto) |
| `ADMIN_EMAIL` | *(opcional)* a dónde llega el aviso del equipo. Por defecto `admin@parallelo.com.co` |
| `EMAIL_FROM_NAME` | *(opcional)* nombre del remitente. Por defecto `Agentix` |

> Si quieres que el aviso del equipo y el envío salgan de cuentas distintas, usa `GMAIL_USER`
> para la que envía y `ADMIN_EMAIL` para la que recibe el aviso.

Sin estas variables, los correos simplemente **no se envían** (la cita igual se agenda y se guarda).
Nota: Google Calendar ya manda su propia invitación al lead; estos correos son **adicionales** y con
tu copy de marca.

---

## Resumen de variables de entorno (Netlify)

| Grupo | Variables | ¿Obligatorias? |
|---|---|---|
| **Google Calendar (OAuth)** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID` | para crear el evento real + Meet |
| Meet (fallback) | `MEETING_URL` | opcional |
| **Supabase** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | para guardar leads |
| **Correos** | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | para enviar los 2 correos |
| Correos (ajustes) | `ADMIN_EMAIL`, `EMAIL_FROM_NAME` | opcional |

Cada grupo es independiente: pon los que quieras activar. Tras guardar, **redeploy**.

---

## Paso 6 — Desplegar en Netlify

**Opción A — desde Git (recomendada):**
1. Sube esta carpeta (`apps/web`) a un repo.
2. En Netlify: **Add new site → Import an existing project →** elige el repo.
3. Build settings: **Base directory** = la ruta a `apps/web` (si el repo es solo el sitio, déjalo
   vacío). El `netlify.toml` ya define `publish` y la carpeta de `functions`.
4. Deploy. Pon las variables del Paso 3 y vuelve a desplegar.

**Opción B — Netlify CLI:**
```bash
cd apps/web
npm install
npx netlify deploy --prod
```

---

## Probar en local

```bash
cd apps/web
npm install            # instala googleapis (solo necesario para modo real)
node dev-server.js     # → http://localhost:8770  (modo demo, sin Google)
```
Para probar el **modo real en local**, usa `npx netlify dev` con las variables en un `.env`
local (NO lo subas a git; ya está en `.gitignore`).

---

## Ajustes comunes

Todo en [`netlify/functions/_config.js`](netlify/functions/_config.js):

- **Cambiar la ventana horaria:** `WORK_START_HOUR`, `WORK_END_HOUR`.
- **Más/menos horarios visibles por día:** `SLOTS_SHOWN_PER_DAY` (hoy 4).
- **Duración de la demo:** `SLOT_MINUTES` (hoy 30).
- **Incluir sábados:** agrega `6` a `WORK_DAYS`.
- **Horizonte / anticipación:** `HORIZON_DAYS`, `MIN_NOTICE_MINUTES`.
- **Zona horaria:** preparado para Colombia (UTC-5 fijo). Otra zona con horario de verano
  requeriría manejar el offset variable.

---

## Seguridad

- Las credenciales de Google **viven solo en variables de entorno de Netlify**, nunca en el cliente.
- `book.js` **revalida server-side** que el horario fue ofrecido y sigue libre antes de crear el
  evento → evita doble-booking y horarios inventados.
- El formulario tiene un **honeypot** anti-bots.
