/* Acceso a Google Calendar.
   Soporta dos modos de autenticación:
     • OAuth (recomendado): el evento se crea COMO el usuario autorizado
       (admin@parallelo.com.co) → link de Meet nativo, sin compartir calendario,
       sin llaves de service account. Vars: GOOGLE_OAUTH_CLIENT_ID,
       GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN.
     • Service account (JWT): vars GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.
   Si no hay ninguno, isConfigured() es false → modo demo (no toca Google). */

var cfg = require('./_config');

var OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
var OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
var OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '';

var SA_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
var SA_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

var CAL_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
var MEETING_URL = process.env.MEETING_URL || '';

function authMode() {
  if (OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REFRESH_TOKEN) return 'oauth';
  if (SA_CLIENT_EMAIL && SA_PRIVATE_KEY) return 'jwt';
  return null;
}

function isConfigured() {
  return authMode() !== null;
}

function getCalendar() {
  var google = require('googleapis').google;
  var auth;
  if (authMode() === 'oauth') {
    auth = new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
  } else {
    auth = new google.auth.JWT({
      email: SA_CLIENT_EMAIL,
      key: SA_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
  }
  return google.calendar({ version: 'v3', auth: auth });
}

/* Intervalos ocupados [{start: ms, end: ms}] entre dos instantes ISO. */
async function getBusy(timeMinIso, timeMaxIso) {
  var calendar = getCalendar();
  var res = await calendar.freebusy.query({
    requestBody: { timeMin: timeMinIso, timeMax: timeMaxIso, timeZone: cfg.TIMEZONE, items: [{ id: CAL_ID }] }
  });
  var cal = res.data.calendars && res.data.calendars[CAL_ID];
  var busy = (cal && cal.busy) || [];
  return busy.map(function (b) { return { start: Date.parse(b.start), end: Date.parse(b.end) }; });
}

/* Crea el evento real y devuelve { meetLink, htmlLink, eventId }. */
async function insertEvent(opts) {
  var calendar = getCalendar();
  var requestBody = {
    summary: opts.summary,
    description: opts.description,
    start: { dateTime: opts.startIso, timeZone: cfg.TIMEZONE },
    end: { dateTime: opts.endIso, timeZone: cfg.TIMEZONE },
    attendees: [{ email: opts.attendeeEmail, displayName: opts.attendeeName || undefined }]
  };

  var params = { calendarId: CAL_ID, requestBody: requestBody, sendUpdates: 'all' };

  if (cfg.ADD_GOOGLE_MEET) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: 'agentix-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
    params.conferenceDataVersion = 1;
  }

  var res = await calendar.events.insert(params);
  var data = res.data || {};
  var meetLink = data.hangoutLink;
  if (!meetLink && data.conferenceData && data.conferenceData.entryPoints) {
    var video = data.conferenceData.entryPoints.filter(function (e) { return e.entryPointType === 'video'; })[0];
    if (video) meetLink = video.uri;
  }
  if (!meetLink && MEETING_URL) meetLink = MEETING_URL;

  return { meetLink: meetLink || null, htmlLink: data.htmlLink || null, eventId: data.id || null };
}

module.exports = {
  isConfigured: isConfigured,
  authMode: authMode,
  getBusy: getBusy,
  insertEvent: insertEvent,
  MEETING_URL: MEETING_URL
};
