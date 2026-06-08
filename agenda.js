/* Agentix — Página de agenda (calendario nativo de MES)
   Vanilla JS, sin dependencias.
   Habla con /api/availability y /api/book (Netlify Functions). */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* ------------------------------------------------------------- refs --- */
  var el = {
    name: null, email: null, website: null, // se resuelven tras render (están en el HTML fijo)
    loading: document.getElementById('calLoading'),
    error: document.getElementById('calError'),
    errorMsg: document.getElementById('calErrorMsg'),
    retry: document.getElementById('retryBtn'),
    picker: document.getElementById('calPicker'),
    tz: document.getElementById('calTz'),
    monthLabel: document.getElementById('monthLabel'),
    monthGrid: document.getElementById('monthGrid'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    sideEmpty: document.getElementById('sideEmpty'),
    sideSlots: document.getElementById('sideSlots'),
    slotDayLabel: document.getElementById('slotDayLabel'),
    slotScarcity: document.getElementById('slotScarcity'),
    slotGrid: document.getElementById('slotGrid'),
    slotEmpty: document.getElementById('slotEmpty'),
    confirmArea: document.getElementById('confirmArea'),
    confirmSummary: document.getElementById('confirmSummary'),
    confirmText: document.getElementById('confirmText'),
    confirmBtn: document.getElementById('confirmBtn'),
    confirmNote: document.getElementById('confirmNote'),
    success: document.getElementById('calSuccess'),
    successDetails: document.getElementById('successDetails'),
    successEmail: document.getElementById('successEmail')
  };
  el.name = document.getElementById('a-name');
  el.email = document.getElementById('a-email');
  el.website = document.getElementById('a-website');

  var state = {
    data: null,
    byDate: {},        // 'YYYY-MM-DD' -> day object
    months: [],        // ['2026-06', ...] con disponibilidad
    monthIdx: 0,
    selectedDate: null,
    slot: null,
    booking: false,
    todayStr: null
  };

  /* ------------------------------------------------------- prefill lead --- */
  (function prefill() {
    var lead = {};
    try { lead = JSON.parse(sessionStorage.getItem('agentix_lead') || '{}') || {}; } catch (e) {}
    var qs = new URLSearchParams(window.location.search);
    if (lead.name || qs.get('name')) el.name.value = lead.name || qs.get('name');
    if (lead.email || qs.get('email')) el.email.value = lead.email || qs.get('email');
  })();

  /* ------------------------------------------------------------ helpers --- */
  function show(n) { n.hidden = false; }
  function hide(n) { n.hidden = true; }

  function setView(view) {
    hide(el.loading); hide(el.error); hide(el.picker); hide(el.success);
    if (view === 'loading') show(el.loading);
    else if (view === 'error') show(el.error);
    else if (view === 'picker') show(el.picker);
    else if (view === 'success') show(el.success);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    void t.offsetWidth;
    t.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { t.classList.remove('show'); }, 3800);
  }

  function ymd(y, m, d) { return y + '-' + (m < 9 ? '0' : '') + (m + 1) + '-' + (d < 10 ? '0' : '') + d; }

  /* ---------------------------------------------------- cargar horarios --- */
  function loadAvailability() {
    setView('loading');
    fetch('/api/availability', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (!data || !data.days || !data.days.length) {
          el.errorMsg.textContent = 'Por ahora no hay horarios disponibles. Escríbenos y coordinamos directo.';
          setView('error');
          return;
        }
        ingest(data);
        renderMonth();
        resetSide();
        setView('picker');
      })
      .catch(function () {
        el.errorMsg.textContent = 'No pudimos cargar los horarios. Revisa tu conexión e inténtalo de nuevo.';
        setView('error');
      });
  }

  function ingest(data) {
    state.data = data;
    state.byDate = {};
    state.months = [];
    state.selectedDate = null;
    state.slot = null;
    if (data.timezoneLabel) el.tz.innerHTML = '<span class="ic-dot"></span>' + data.timezoneLabel;
    data.days.forEach(function (day) {
      state.byDate[day.date] = day;
      var mk = day.date.slice(0, 7);
      if (state.months.indexOf(mk) === -1) state.months.push(mk);
    });
    state.months.sort();
    state.monthIdx = 0;
    state.todayStr = data.days[0].date; // el primer día disponible es "hoy o después"
  }

  /* ----------------------------------------------------------- mes --- */
  function renderMonth() {
    var mk = state.months[state.monthIdx];
    var y = parseInt(mk.slice(0, 4), 10);
    var m = parseInt(mk.slice(5, 7), 10) - 1;

    el.monthLabel.textContent = MONTHS[m] + ' ' + y;
    el.prevMonth.disabled = state.monthIdx <= 0;
    el.nextMonth.disabled = state.monthIdx >= state.months.length - 1;

    el.monthGrid.innerHTML = '';
    // offset de la primera celda: semana empieza en LUNES
    var firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0=Dom
    var lead = (firstDow + 6) % 7; // lunes=0
    var daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    for (var i = 0; i < lead; i++) {
      var blank = document.createElement('div');
      blank.className = 'day-cell empty';
      el.monthGrid.appendChild(blank);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = ymd(y, m, d);
      var cell = document.createElement('div');
      cell.className = 'day-cell';
      cell.textContent = d;
      cell.setAttribute('role', 'gridcell');
      if (dateStr === state.todayStr) cell.classList.add('today');

      if (state.byDate[dateStr]) {
        cell.classList.add('available');
        if (dateStr === state.selectedDate) cell.classList.add('selected');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', d + ' — disponible');
        (function (ds) {
          cell.addEventListener('click', function () { selectDate(ds); });
          cell.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectDate(ds); } });
        })(dateStr);
      } else {
        cell.classList.add('disabled');
        cell.setAttribute('aria-disabled', 'true');
      }
      el.monthGrid.appendChild(cell);
    }
  }

  function gotoMonth(delta) {
    var ni = state.monthIdx + delta;
    if (ni < 0 || ni >= state.months.length) return;
    state.monthIdx = ni;
    renderMonth();
  }

  /* ----------------------------------------------------------- día / slots --- */
  function resetSide() {
    state.selectedDate = null;
    state.slot = null;
    show(el.sideEmpty);
    hide(el.sideSlots);
    hide(el.confirmArea);
  }

  function selectDate(dateStr) {
    state.selectedDate = dateStr;
    state.slot = null;
    renderMonth(); // re-marca la celda seleccionada
    var day = state.byDate[dateStr];

    hide(el.sideEmpty);
    show(el.sideSlots);
    hide(el.confirmArea);

    el.slotDayLabel.textContent = day.full;
    el.slotGrid.innerHTML = '';

    if (!day.slots.length) {
      hide(el.slotScarcity); show(el.slotEmpty); return;
    }
    hide(el.slotEmpty);
    el.slotScarcity.textContent = day.slots.length <= 4
      ? 'Solo ' + day.slots.length + (day.slots.length === 1 ? ' cupo' : ' cupos')
      : day.slots.length + ' cupos';
    show(el.slotScarcity);

    day.slots.forEach(function (slot) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot-btn';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.textContent = slot.label;
      b.addEventListener('click', function () { selectSlot(slot, b, day); });
      el.slotGrid.appendChild(b);
    });
  }

  function selectSlot(slot, btn, day) {
    state.slot = slot;
    Array.prototype.forEach.call(el.slotGrid.children, function (c) { if (c.setAttribute) c.setAttribute('aria-selected', 'false'); });
    btn.setAttribute('aria-selected', 'true');
    el.confirmText.innerHTML = '<b>' + day.full + '</b> · ' + slot.label;
    show(el.confirmArea);
    el.confirmNote.classList.remove('err');
    el.confirmNote.textContent = 'Te llega la invitación al confirmar.';
    if (reduce !== true && el.confirmArea.scrollIntoView) {
      el.confirmArea.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ------------------------------------------------------------- agendar --- */
  function validLead() {
    var name = el.name.value.trim();
    var email = el.email.value.trim();
    if (!name) { el.name.focus(); return false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { el.email.focus(); return false; }
    return true;
  }

  function book() {
    if (!state.slot || state.booking) return;
    if (!validLead()) {
      el.confirmNote.classList.add('err');
      el.confirmNote.textContent = 'Revisa tu nombre y correo antes de confirmar.';
      return;
    }
    state.booking = true;
    el.confirmBtn.disabled = true;
    el.confirmBtn.classList.add('loading');
    el.confirmNote.classList.remove('err');
    el.confirmNote.textContent = 'Agendando tu demo…';

    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('agentix_lead') || '{}') || {}; } catch (e) {}

    fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        slot: state.slot.iso,
        name: el.name.value.trim(),
        email: el.email.value.trim(),
        agency: stored.agency || '',
        clients: stored.clients || '',
        website: el.website.value // honeypot
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        state.booking = false;
        el.confirmBtn.classList.remove('loading');

        if (res.status === 200 && res.body && res.body.ok) { renderSuccess(res.body.booked); return; }
        if (res.status === 409) {
          toast('Ese horario se acaba de ocupar. Elige otro, por favor.');
          loadAvailability();
          return;
        }
        el.confirmBtn.disabled = false;
        el.confirmNote.classList.add('err');
        el.confirmNote.textContent = (res.body && res.body.message) || 'No pudimos agendar. Inténtalo de nuevo.';
      })
      .catch(function () {
        state.booking = false;
        el.confirmBtn.classList.remove('loading');
        el.confirmBtn.disabled = false;
        el.confirmNote.classList.add('err');
        el.confirmNote.textContent = 'Hubo un problema de conexión. Inténtalo de nuevo.';
      });
  }

  function renderSuccess(booked) {
    var tzLabel = state.data && state.data.timezoneLabel ? ' · ' + state.data.timezoneLabel : '';
    var rows = [
      ['Cuándo', booked.dateLabel],
      ['Hora', booked.timeLabel + tzLabel],
      ['Duración', (booked.durationMinutes || 30) + ' min']
    ];
    if (booked.meetLink) rows.push(['Enlace', '<a href="' + booked.meetLink + '" target="_blank" rel="noopener" style="color:var(--brand-orange);font-weight:600">Unirme a la videollamada</a>']);
    el.successDetails.innerHTML = rows.map(function (r) {
      return '<div class="success-row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>';
    }).join('');
    el.successEmail.textContent = el.email.value.trim();
    setView('success');
    try { sessionStorage.removeItem('agentix_lead'); } catch (e) {}
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------ eventos --- */
  el.confirmBtn.addEventListener('click', book);
  el.retry.addEventListener('click', loadAvailability);
  el.prevMonth.addEventListener('click', function () { gotoMonth(-1); });
  el.nextMonth.addEventListener('click', function () { gotoMonth(1); });

  loadAvailability();
})();
