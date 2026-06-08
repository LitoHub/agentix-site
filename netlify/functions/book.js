/* POST /api/book
   Crea la cita de verdad. Revalida (server-side) que el slot pedido fue ofrecido
   y sigue libre antes de insertar el evento → evita doble-booking y horarios
   inventados. En modo demo simula el agendamiento. */

var cfg = require('./_config');
var slots = require('./_slots');
var google = require('./_google');
var supabase = require('./_supabase');
var mailer = require('./_email');

var JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function reply(statusCode, obj) {
  return { statusCode: statusCode, headers: JSON_HEADERS, body: JSON.stringify(obj) };
}

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return reply(405, { ok: false, message: 'Método no permitido' });
  }

  var data;
  try { data = JSON.parse(event.body || '{}'); } catch (e) {
    return reply(400, { ok: false, code: 'bad_json', message: 'Solicitud inválida.' });
  }

  // Honeypot: si viene lleno, es un bot. Fingimos éxito sin agendar nada.
  if (data.website) {
    return reply(200, { ok: true, booked: { dateLabel: '', timeLabel: '', durationMinutes: cfg.SLOT_MINUTES, meetLink: null } });
  }

  var name = (data.name || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var agency = (data.agency || '').toString().trim();
  var clients = (data.clients || '').toString().trim();
  var iso = (data.slot || '').toString().trim();

  if (!name) return reply(400, { ok: false, code: 'no_name', message: 'Falta tu nombre.' });
  if (!EMAIL_RE.test(email)) return reply(400, { ok: false, code: 'bad_email', message: 'El correo no es válido.' });
  if (!iso || isNaN(Date.parse(iso))) return reply(400, { ok: false, code: 'bad_slot', message: 'El horario no es válido.' });

  var now = Date.now();

  try {
    // Revalidación: ¿el slot fue ofrecido y sigue libre AHORA?
    var busy = [];
    if (google.isConfigured()) {
      var horizonMs = now + (cfg.HORIZON_DAYS + 1) * 86400000;
      busy = await google.getBusy(new Date(now).toISOString(), new Date(horizonMs).toISOString());
    }
    var day = slots.isSlotBookable(iso, busy, now);
    if (!day) {
      return reply(409, { ok: false, code: 'slot_taken', message: 'Ese horario ya no está disponible.' });
    }

    var d = slots.describeSlot(iso);
    var endIso = new Date(d.endMs).toISOString();
    var demoMode = !google.isConfigured();

    // 1) Calendario: crear el evento real (si Google está configurado).
    var meetLink = null;
    var calendarEventId = null;
    if (!demoMode) {
      var desc = cfg.EVENT_DESCRIPTION +
        '\n\nNombre: ' + name +
        (agency ? '\nAgencia: ' + agency : '') +
        (clients ? '\nClientes que maneja: ' + clients : '') +
        '\nCorreo: ' + email;

      var result = await google.insertEvent({
        startIso: iso,
        endIso: endIso,
        summary: cfg.EVENT_SUMMARY + ' — ' + name,
        description: desc,
        attendeeEmail: email,
        attendeeName: name
      });
      meetLink = result.meetLink;
      calendarEventId = result.eventId || null;
    } else {
      meetLink = google.MEETING_URL || null;
    }

    var booked = {
      iso: iso,
      name: name,
      email: email,
      agency: agency,
      clients: clients,
      dateLabel: d.dateLabel,
      timeLabel: d.timeLabel,
      timezoneLabel: cfg.TIMEZONE_LABEL,
      durationMinutes: cfg.SLOT_MINUTES,
      meetLink: meetLink
    };

    // 2) Persistir en Supabase (best-effort: no tumba el agendamiento).
    try {
      await supabase.saveBooking({
        name: name, email: email, agency: agency || null, clients: clients || null,
        slot_at: iso,
        slot_label: d.dateLabel + ' · ' + d.timeLabel,
        timezone: cfg.TIMEZONE,
        status: 'booked',
        meet_link: meetLink,
        calendar_event_id: calendarEventId,
        source: demoMode ? 'agentix-landing(demo)' : 'agentix-landing'
      });
    } catch (e) { console.error('supabase saveBooking error:', e && (e.message || e)); }

    // 3) Correos: aviso al equipo + confirmación al lead (best-effort, en paralelo).
    try {
      await Promise.all([
        mailer.sendAdminNotification(booked),
        mailer.sendLeadConfirmation(booked)
      ]);
    } catch (e) { console.error('email send error:', e && (e.message || e)); }

    return reply(200, {
      ok: true,
      demoMode: demoMode,
      booked: {
        iso: iso,
        dateLabel: d.dateLabel,
        timeLabel: d.timeLabel,
        durationMinutes: cfg.SLOT_MINUTES,
        meetLink: meetLink
      }
    });
  } catch (err) {
    console.error('book error:', err && (err.message || err));
    return reply(502, { ok: false, code: 'server', message: 'No pudimos agendar. Inténtalo de nuevo en un momento.' });
  }
};
