# Agentix — Sitio de ventas

Landing page estática (una sola página) para vender **Agentix** a dueños de agencias de marketing.
Marca Parallelo. Español (LatAm). Sin build step.

## Ver en local
```bash
cd agentix-site
python3 -m http.server 8770
# abrir http://localhost:8770
```
O simplemente abrir `index.html` en el navegador.

## Estructura
```
index.html     # toda la página
styles.css     # tokens de marca Parallelo + componentes
script.js      # nav sticky, reveal-on-scroll, secuencia de chat, formulario
assets/
  logo.svg     # marca Agentix
  shots/       # 4 screenshots reales del producto (marca "Agentix")
```

## Secciones
Nav · Hero · El problema · Todo en un solo lugar · **Tu agencia cobra vida** (la IA) ·
8 funciones (dolor → solución → línea de IA) · Para tu equipo · Antes vs. con Agentix ·
Testimonios · CTA + formulario · Footer.

## Agenda de demos (calendario nativo + Google Calendar)
El formulario de demo (`#demoForm`) ahora **guarda los datos y lleva a `agenda.html`**, un
calendario nativo de marca propia que **agenda de verdad** vía Google Calendar (crea el evento
+ invita al lead con enlace de videollamada). Funciona en **modo demo** hasta que pongas las
variables de Google en Netlify.
- Frontend: `agenda.html`, `agenda.css`, `agenda.js`.
- Backend: `netlify/functions/` (`availability.js`, `book.js`, helpers `_config/_slots/_google`).
- **Cómo dejarlo en producción:** ver [`SETUP-AGENDA.md`](SETUP-AGENDA.md).

## Pendientes de cablear (placeholders)
- **Testimonios**: copy de ejemplo por rol (marcado con comentario HTML). Reemplazar con
  citas reales cuando estén.
- **Tipografía**: usa Inter (el fallback web que define el manual de marca). Si se licencia
  Neue Montreal para web, sustituir en `styles.css`.

## Desplegar
**Netlify** (la agenda usa Netlify Functions para hablar con Google Calendar). El `netlify.toml`
ya define `publish` y la carpeta de funciones. Pasos completos + variables de entorno en
[`SETUP-AGENDA.md`](SETUP-AGENDA.md). La landing en sí es estática; solo la agenda necesita las
funciones serverless.

Diseño de referencia: `docs/superpowers/specs/2026-06-03-agentix-landing-design.md`.
