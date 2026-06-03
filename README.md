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

## Pendientes de cablear (placeholders)
- **Formulario de demo** (`#demoForm` en `index.html`, handler en `script.js`): hoy muestra
  una confirmación local. Conectar a Calendly / correo / CRM real (ver `// TODO` en `script.js`).
- **Testimonios**: copy de ejemplo por rol (marcado con comentario HTML). Reemplazar con
  citas reales cuando estén.
- **Tipografía**: usa Inter (el fallback web que define el manual de marca). Si se licencia
  Neue Montreal para web, sustituir en `styles.css`.

## Desplegar
Cualquier hosting estático (Netlify, Vercel, Cloudflare Pages, GitHub Pages): subir la
carpeta `agentix-site/` tal cual.

Diseño de referencia: `docs/superpowers/specs/2026-06-03-agentix-landing-design.md`.
