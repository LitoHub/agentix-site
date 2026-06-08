/* Agentix landing — interactions
   Vanilla JS, sin dependencias. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Nav: encoge / fondo glassy al hacer scroll ---- */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > 24) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Menú móvil: el botón lleva al formulario ---- */
  var burger = document.getElementById('burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var demo = document.getElementById('demo');
      if (demo) demo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---- Reveal on scroll ---- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- Secuencia de chat (corre una vez al verse) ---- */
  var chatlog = document.getElementById('chatlog');
  if (chatlog) {
    if (reduce || !('IntersectionObserver' in window)) {
      chatlog.classList.add('run');
    } else {
      var ioChat = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            chatlog.classList.add('run');
            ioChat.unobserve(e.target);
          }
        });
      }, { threshold: 0.4 });
      ioChat.observe(chatlog);
    }
  }

  /* ---- Formulario de demo: guarda los datos y lleva al calendario ---- */
  var form = document.getElementById('demoForm');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      // Persistimos lo que llenó el lead para prellenar la página de agenda.
      var lead = {
        name: (form.elements.name && form.elements.name.value || '').trim(),
        agency: (form.elements.agency && form.elements.agency.value || '').trim(),
        email: (form.elements.email && form.elements.email.value || '').trim(),
        clients: (form.elements.clients && form.elements.clients.value || '').trim()
      };
      try { sessionStorage.setItem('agentix_lead', JSON.stringify(lead)); } catch (e) {}

      // Confirmación breve antes de redirigir (mejora la percepción de respuesta).
      form.classList.add('sent');

      var query = '?name=' + encodeURIComponent(lead.name) +
                  '&email=' + encodeURIComponent(lead.email);
      window.setTimeout(function () {
        window.location.href = 'agenda.html' + query;
      }, reduce ? 0 : 450);
    });
  }
})();
