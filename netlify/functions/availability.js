/* GET /api/availability
   Devuelve los días (Lun–Vie) con sus horarios disponibles, ya aplicado el
   muestreo de escasez. Lee free/busy de Google Calendar; en modo demo usa
   disponibilidad sintética (sin ocupados). */

var cfg = require('./_config');
var slots = require('./_slots');
var google = require('./_google');

var JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, message: 'Método no permitido' }) };
  }

  var now = Date.now();
  var horizonMs = now + (cfg.HORIZON_DAYS + 1) * 86400000;

  try {
    var busy = [];
    if (google.isConfigured()) {
      busy = await google.getBusy(new Date(now).toISOString(), new Date(horizonMs).toISOString());
    }
    var days = slots.buildDays(busy, now);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        timezone: cfg.TIMEZONE,
        timezoneLabel: cfg.TIMEZONE_LABEL,
        durationMinutes: cfg.SLOT_MINUTES,
        demoMode: !google.isConfigured(),
        days: days
      })
    };
  } catch (err) {
    console.error('availability error:', err && err.message);
    return {
      statusCode: 502,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, message: 'No pudimos leer la disponibilidad.' })
    };
  }
};
