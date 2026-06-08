/* Reglas de disponibilidad para las demos de Agentix.
   Ajusta aquí la ventana, duración y el mecanismo de escasez sin tocar la lógica.
   La zona horaria es Colombia (UTC-5 fijo, sin horario de verano). */

module.exports = {
  // Zona horaria de cálculo (Colombia no usa DST → offset fijo -05:00).
  TIMEZONE: 'America/Bogota',
  TIMEZONE_LABEL: 'Hora de Colombia',
  UTC_OFFSET: '-05:00', // offset fijo de Bogotá

  // Ventana laboral real (hora local de Bogotá).
  WORK_START_HOUR: 9,   // primer slot puede empezar a las 9:00
  WORK_END_HOUR: 17,    // último slot debe TERMINAR a más tardar a las 17:00
  WORK_DAYS: [1, 2, 3, 4, 5], // 0=Dom … 6=Sáb → Lun a Vie

  // Tamaño de la demo.
  SLOT_MINUTES: 30,

  // Mecanismo de escasez: de todos los slots posibles del día, solo se MUESTRAN
  // estos, elegidos de forma pseudo-aleatoria pero ESTABLE por día (semilla = la fecha).
  // Así el resto "parece ya reservado" y refrescar no baraja los horarios.
  SLOTS_SHOWN_PER_DAY: 4,

  // Horizonte y anticipación.
  HORIZON_DAYS: 14,        // se puede agendar hasta N días hacia adelante
  MIN_NOTICE_MINUTES: 120, // mínimo de anticipación para reservar

  // Evento que se crea en el calendario.
  EVENT_SUMMARY: 'Demo Agentix',
  EVENT_DESCRIPTION: 'Demo de Agentix agendada desde el sitio. Te mostramos tu agencia dentro de Agentix con tus propios números.',
  ADD_GOOGLE_MEET: true
};
