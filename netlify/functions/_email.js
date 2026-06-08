/* Envío de correos transaccionales vía Gmail SMTP (Nodemailer).
   Dos correos por cita:
     1) Aviso al equipo (ADMIN_EMAIL, por defecto admin@parallelo.com.co).
     2) Confirmación al lead (su propio correo) — contenido distinto.
   Si faltan GMAIL_USER / GMAIL_APP_PASSWORD, isConfigured() es false y no se
   envía nada (el agendamiento no falla por esto). */

var GMAIL_USER = process.env.GMAIL_USER || '';
var GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
var ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@parallelo.com.co';
var FROM_NAME = process.env.EMAIL_FROM_NAME || 'Agentix by Parallelo AI';

var ORANGE = '#FF6D29';
var DARK = '#1F1815';

function isConfigured() {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function transport() {
  var nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shell(title, inner) {
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F6EFE7;padding:28px 0">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #eadfd3">' +
      '<div style="background:' + DARK + ';padding:20px 28px;color:#fff;font-size:18px;font-weight:700">Agentix</div>' +
      '<div style="padding:28px">' +
        '<h1 style="margin:0 0 14px;font-size:21px;color:' + DARK + '">' + title + '</h1>' +
        inner +
      '</div>' +
      '<div style="padding:16px 28px;border-top:1px solid #eee;color:#9C9189;font-size:12px">Agentix · Hecho por Parallelo.ai</div>' +
    '</div></div>';
}

function rows(pairs) {
  return '<table style="width:100%;border-collapse:collapse;margin:8px 0 18px">' +
    pairs.map(function (p) {
      return '<tr>' +
        '<td style="padding:7px 0;color:#9C9189;font-size:13px;width:130px;vertical-align:top">' + esc(p[0]) + '</td>' +
        '<td style="padding:7px 0;color:' + DARK + ';font-size:14px;font-weight:500">' + p[1] + '</td>' +
      '</tr>';
    }).join('') + '</table>';
}

function meetBtn(link) {
  if (!link) return '';
  return '<a href="' + esc(link) + '" style="display:inline-block;background:' + ORANGE + ';color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;font-size:14px">Unirme a la videollamada →</a>';
}

/* b = { name, email, agency, clients, dateLabel, timeLabel, timezoneLabel, durationMinutes, meetLink } */

function renderAdminHtml(b) {
  var inner =
    '<p style="margin:0 0 4px;color:#6B5E55;font-size:14px">Alguien acaba de agendar una demo desde el sitio.</p>' +
    rows([
      ['Nombre', esc(b.name)],
      ['Correo', '<a href="mailto:' + esc(b.email) + '" style="color:' + ORANGE + '">' + esc(b.email) + '</a>'],
      ['Agencia', esc(b.agency) || '—'],
      ['Clientes', esc(b.clients) || '—'],
      ['Cuándo', esc(b.dateLabel) + ' · ' + esc(b.timeLabel) + (b.timezoneLabel ? ' (' + esc(b.timezoneLabel) + ')' : '')],
      ['Duración', (b.durationMinutes || 30) + ' min']
    ]) +
    meetBtn(b.meetLink);
  return shell('Nueva demo agendada 🎉', inner);
}

function renderLeadHtml(b) {
  var inner =
    '<p style="margin:0 0 4px;color:#6B5E55;font-size:14px">Hola ' + esc(b.name) + ', tu demo de Agentix quedó confirmada. Te esperamos:</p>' +
    rows([
      ['Cuándo', esc(b.dateLabel)],
      ['Hora', esc(b.timeLabel) + (b.timezoneLabel ? ' · ' + esc(b.timezoneLabel) : '')],
      ['Duración', (b.durationMinutes || 30) + ' min']
    ]) +
    meetBtn(b.meetLink) +
    '<p style="margin:20px 0 0;color:#6B5E55;font-size:13px">Te mostraremos, con tus propios números, cómo se vería tu agencia dentro de Agentix. ¿Necesitas reagendar? Responde este correo y lo coordinamos.</p>';
  return shell('¡Tu demo está confirmada!', inner);
}

async function sendAdminNotification(b) {
  if (!isConfigured()) return;
  await transport().sendMail({
    from: '"' + FROM_NAME + '" <' + GMAIL_USER + '>',
    to: ADMIN_EMAIL,
    replyTo: b.email,
    subject: 'Nueva demo agendada — ' + b.name + (b.agency ? ' (' + b.agency + ')' : ''),
    html: renderAdminHtml(b)
  });
}

async function sendLeadConfirmation(b) {
  if (!isConfigured()) return;
  await transport().sendMail({
    from: '"' + FROM_NAME + '" <' + GMAIL_USER + '>',
    to: b.email,
    replyTo: ADMIN_EMAIL,
    subject: 'Tu demo de Agentix está confirmada 🗓️',
    html: renderLeadHtml(b)
  });
}

module.exports = {
  isConfigured: isConfigured,
  ADMIN_EMAIL: ADMIN_EMAIL,
  sendAdminNotification: sendAdminNotification,
  sendLeadConfirmation: sendLeadConfirmation,
  renderAdminHtml: renderAdminHtml,
  renderLeadHtml: renderLeadHtml
};
