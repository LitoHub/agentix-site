/* Guarda cada cita en Supabase (tabla public.demo_bookings) vía REST.
   Usa la llave service_role (omite RLS). Si faltan las variables, isConfigured()
   es false y no se guarda nada (el agendamiento no falla por esto). */

var SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isConfigured() {
  return !!(SUPABASE_URL && SERVICE_KEY);
}

/* Inserta una fila. Devuelve la fila creada (o null si no está configurado). */
async function saveBooking(record) {
  if (!isConfigured()) return null;
  var res = await fetch(SUPABASE_URL + '/rest/v1/demo_bookings', {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(record)
  });
  if (!res.ok) {
    var txt = await res.text();
    throw new Error('Supabase HTTP ' + res.status + ': ' + txt);
  }
  var rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = { isConfigured: isConfigured, saveBooking: saveBooking };
