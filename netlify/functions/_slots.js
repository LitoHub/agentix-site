/* Lógica de slots: construye los días con sus horarios disponibles aplicando
   la ventana laboral, la anticipación mínima y el muestreo de escasez (estable
   por día). Compartido por availability.js y book.js para que lo que se muestra
   y lo que se reserva use EXACTAMENTE las mismas reglas.

   Zona horaria: Bogotá, offset fijo -05:00 (Colombia no usa horario de verano). */

var cfg = require('./_config');

var OFFSET_MS = 5 * 3600 * 1000; // Bogotá = UTC-5

var DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
var DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MON_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var MON_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* PRNG determinista (mulberry32) para el muestreo estable por día. */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Toma `count` elementos de forma pseudo-aleatoria pero estable (semilla = fecha). */
function seededPick(arr, count, seed) {
  var rng = mulberry32(seed);
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a.slice(0, count);
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function timeLabel(h, m) {
  var ampm = h < 12 ? 'a.m.' : 'p.m.';
  var hr = h % 12; if (hr === 0) hr = 12;
  return hr + ':' + pad(m) + ' ' + ampm;
}

/* ISO con offset fijo de Bogotá, p.ej. 2026-06-09T09:30:00-05:00 */
function bogotaIso(y, mo, d, h, mi) {
  return y + '-' + pad(mo + 1) + '-' + pad(d) + 'T' + pad(h) + ':' + pad(mi) + ':00' + cfg.UTC_OFFSET;
}

/* "Ahora" como partes de reloj de Bogotá (truco de offset fijo). */
function bogotaParts(nowMs) {
  var b = new Date(nowMs - OFFSET_MS);
  return {
    y: b.getUTCFullYear(), mo: b.getUTCMonth(), d: b.getUTCDate(),
    // ms de la medianoche de hoy en Bogotá, expresado en el eje pseudo-UTC
    midnightPseudo: Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
  };
}

/* Genera los slots candidatos (todos los posibles del día), sin filtrar. */
function candidateSlots(y, mo, d) {
  var out = [];
  var stepMin = cfg.SLOT_MINUTES;
  var startMin = cfg.WORK_START_HOUR * 60;
  var endMin = cfg.WORK_END_HOUR * 60; // el slot debe TERMINAR <= endMin
  for (var t = startMin; t + stepMin <= endMin; t += stepMin) {
    var h = Math.floor(t / 60), mi = t % 60;
    var iso = bogotaIso(y, mo, d, h, mi);
    out.push({ iso: iso, label: timeLabel(h, mi), startMs: Date.parse(iso), endMs: Date.parse(iso) + stepMin * 60000 });
  }
  return out;
}

function overlapsBusy(slot, busy) {
  for (var i = 0; i < busy.length; i++) {
    if (slot.startMs < busy[i].end && slot.endMs > busy[i].start) return true;
  }
  return false;
}

/* Construye la lista de días con sus slots disponibles.
   busy = [{start: ms, end: ms}], nowMs = Date.now(). */
function buildDays(busy, nowMs) {
  busy = busy || [];
  var minBookable = nowMs + cfg.MIN_NOTICE_MINUTES * 60000;
  var p = bogotaParts(nowMs);
  var days = [];

  for (var offset = 0; offset <= cfg.HORIZON_DAYS; offset++) {
    var dayPseudo = p.midnightPseudo + offset * 86400000;
    var dt = new Date(dayPseudo); // leer con getUTC* = reloj de Bogotá
    var y = dt.getUTCFullYear(), mo = dt.getUTCMonth(), d = dt.getUTCDate(), dow = dt.getUTCDay();

    if (cfg.WORK_DAYS.indexOf(dow) === -1) continue;

    // 1) todos los candidatos del día
    var cands = candidateSlots(y, mo, d);
    // 2) muestreo de escasez estable (semilla = YYYYMMDD)
    var seed = y * 10000 + (mo + 1) * 100 + d;
    var shown = seededPick(cands, cfg.SLOTS_SHOWN_PER_DAY, seed);
    // 3) filtrar: anticipación mínima + no chocar con ocupados
    var free = shown.filter(function (s) {
      return s.startMs >= minBookable && !overlapsBusy(s, busy);
    });
    // 4) ordenar por hora
    free.sort(function (a, b) { return a.startMs - b.startMs; });

    if (!free.length) continue;

    days.push({
      date: y + '-' + pad(mo + 1) + '-' + pad(d),
      dow: DOW_SHORT[dow],
      day: String(d),
      month: MON_SHORT[mo],
      full: DOW_LONG[dow] + ' ' + d + ' de ' + MON_LONG[mo],
      slots: free.map(function (s) { return { iso: s.iso, label: s.label }; })
    });
  }
  return days;
}

/* ¿El ISO pedido está realmente entre los slots ofrecidos y libres? */
function isSlotBookable(iso, busy, nowMs) {
  var days = buildDays(busy, nowMs);
  for (var i = 0; i < days.length; i++) {
    for (var j = 0; j < days[i].slots.length; j++) {
      if (days[i].slots[j].iso === iso) return days[i];
    }
  }
  return null;
}

/* Etiquetas legibles para la pantalla de éxito a partir de un ISO. */
function describeSlot(iso) {
  var startMs = Date.parse(iso);
  var b = new Date(startMs - OFFSET_MS);
  return {
    dateLabel: DOW_LONG[b.getUTCDay()] + ' ' + b.getUTCDate() + ' de ' + MON_LONG[b.getUTCMonth()],
    timeLabel: timeLabel(b.getUTCHours(), b.getUTCMinutes()),
    startMs: startMs,
    endMs: startMs + cfg.SLOT_MINUTES * 60000
  };
}

module.exports = { buildDays: buildDays, isSlotBookable: isSlotBookable, describeSlot: describeSlot };
