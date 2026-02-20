// =============================================================
// display.js — Lógica de la pantalla pública (Raspberry Pi / TV)
// No requiere autenticación. Lee el estado de localStorage
// y se sincroniza automáticamente en tiempo real.
// =============================================================

// -----------------------------------------------------------------
// Referencias al DOM
// -----------------------------------------------------------------
const modulesDisplayGrid = document.getElementById('modules-display-grid');
const callHistoryList    = document.getElementById('call-history-list');
const displayTimeEl      = document.getElementById('display-time');
const displayDateEl      = document.getElementById('display-date');

// Guardamos el historial previo para detectar nuevos llamados
let previousCallHistory = [];

// -----------------------------------------------------------------
// startClock: Actualiza el reloj de la pantalla cada segundo.
// Muestra hora en formato HH:MM:SS y fecha completa en español.
// -----------------------------------------------------------------
function startClock() {
  function tick() {
    const now = new Date();

    // Formato de hora: HH:MM:SS
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    displayTimeEl.textContent = `${hh}:${mm}:${ss}`;

    // Fecha en español (ej: Jueves, 20 de Febrero de 2025)
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    displayDateEl.textContent = now.toLocaleDateString('es-ES', opts)
      .replace(/^\w/, c => c.toUpperCase()); // Primera letra en mayúscula
  }

  tick(); // Ejecutar inmediatamente
  setInterval(tick, 1000); // Repetir cada segundo
}

// Guardamos el último timestamp de llamado por módulo para el sonido
let lastCalledAtMap = { 1: 0, 2: 0, 3: 0, 4: 0 };

// -----------------------------------------------------------------
// renderModules: Genera las tarjetas de los 4 módulos en el display.
// -----------------------------------------------------------------
function renderModules(state) {
  modulesDisplayGrid.innerHTML = '';

  for (let i = 1; i <= 4; i++) {
    const mod = state.modules[i];

    // Determinar clase de estado visual
    let cardClass = '';
    let statusLabel = '';
    let statusClass = '';

    if (!mod.active) {
      cardClass    = 'is-inactive';
      statusLabel  = 'DESACTIVADO';
      statusClass  = 'status-inactive';
    } else if (mod.paused) {
      cardClass    = 'is-paused';
      statusLabel  = 'EN PAUSA';
      statusClass  = 'status-paused';
    } else if (mod.currentTicket && mod.calledAt) {
      cardClass    = 'is-calling';
      statusLabel  = 'LLAMANDO';
      statusClass  = 'status-active';
    } else if (mod.isAttending) {
      cardClass    = '';
      statusLabel  = 'ATENDIENDO';
      statusClass  = 'status-attending';
    } else if (mod.currentTicket) {
      cardClass    = '';
      statusLabel  = 'EN ATENCIÓN';
      statusClass  = 'status-active';
    } else {
      cardClass    = '';
      statusLabel  = 'DISPONIBLE';
      statusClass  = 'status-waiting';
    }

    // Contenido del número de turno
    const ticketContent = mod.currentTicket
      ? `<div class="module-ticket-number">${mod.currentTicket}</div>`
      : `<div class="module-ticket-empty">—</div>`;

    // HTML de la tarjeta
    const card = document.createElement('div');
    card.className = `module-display-card ${cardClass}`;
    card.id = `display-mod-${i}`;
    card.innerHTML = `
      <div class="module-display-header">
        <div class="module-display-num">MÓDULO ${i}</div>
        <span class="module-display-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="module-display-ticket">
        ${ticketContent}
      </div>
    `;

    modulesDisplayGrid.appendChild(card);
  }
}

// -----------------------------------------------------------------
// checkForNewCalls: Compara el estado actual con el previo para
// disparar el sonido de campanilla si hay un nuevo llamado.
// -----------------------------------------------------------------
function checkForNewCalls(state) {
  let hasNewCall = false;

  for (let i = 1; i <= 4; i++) {
    const calledAt = state.modules[i].calledAt || 0;
    if (calledAt > lastCalledAtMap[i]) {
      hasNewCall = true;
      lastCalledAtMap[i] = calledAt;
    }
  }

  if (hasNewCall) {
    playBell();
  }
}

// -----------------------------------------------------------------
// renderWaitingQueue: Muestra todos los turnos en espera.
// Los de alta prioridad se muestran primero y en color rojo.
// -----------------------------------------------------------------
function renderWaitingQueue(state) {
  // Combinar colas para visualización (Prioridad alta primero)
  const waitingList = [
    ...state.highQueue.map(t => ({ ...t, isHigh: true })),
    ...state.queue.map(t => ({ ...t, isHigh: false }))
  ];

  if (waitingList.length === 0) {
    callHistoryList.innerHTML = '<span class="no-history">No hay turnos en espera...</span>';
    return;
  }

  callHistoryList.innerHTML = waitingList.map((item) => {
    const priorityClass = item.isHigh ? 'is-priority' : '';
    
    return `
      <div class="history-item ${priorityClass}">
        <div>
          <div class="history-ticket">${item.ticket}</div>
          <div class="history-module">${item.isHigh ? 'PRIORIDAD' : 'NORMAL'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------------
// refreshDisplay: Renderiza todo el display con el estado actual.
// -----------------------------------------------------------------
function refreshDisplay() {
  const state = getState();
  // Sincronizar el mapa de llamados inicial para no disparar sonido al cargar
  for (let i = 1; i <= 4; i++) {
    lastCalledAtMap[i] = state.modules[i].calledAt || 0;
  }
  renderModules(state);
  renderWaitingQueue(state);
}

// -----------------------------------------------------------------
// Sincronización en tiempo real: escuchar cambios de localStorage
// desde otras pestañas (recepcionista, módulos, admin).
// -----------------------------------------------------------------
onStateChange((newState) => {
  checkForNewCalls(newState);
  renderModules(newState);
  renderWaitingQueue(newState);
});

// -----------------------------------------------------------------
// Inicialización al cargar la página
// -----------------------------------------------------------------
startClock();   // Iniciar el reloj
refreshDisplay(); // Mostrar estado inicial
