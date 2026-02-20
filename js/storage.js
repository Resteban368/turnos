// =============================================================
// storage.js — Gestión del estado global en localStorage
// Todos los módulos comparten este estado. Los cambios se
// sincronizan entre pestañas usando el evento 'storage'.
// =============================================================

const STORAGE_KEY = "hospital_turnos_state";

// Estado por defecto del sistema
const DEFAULT_STATE = {
  // Cola de turnos normales (FIFO)
  queue: [],

  // Cola de turnos de alta prioridad (se atienden primero)
  highQueue: [],

  // Estado de cada módulo (1–4)
  modules: {
    1: { active: true, paused: false, currentTicket: null, currentDocId: null, calledAt: null, isAttending: false, assignedAt: 0, callLogs: [], finishedTickets: [] },
    2: { active: true, paused: false, currentTicket: null, currentDocId: null, calledAt: null, isAttending: false, assignedAt: 0, callLogs: [], finishedTickets: [] },
    3: { active: true, paused: false, currentTicket: null, currentDocId: null, calledAt: null, isAttending: false, assignedAt: 0, callLogs: [], finishedTickets: [] },
    4: { active: true, paused: false, currentTicket: null, currentDocId: null, calledAt: null, isAttending: false, assignedAt: 0, callLogs: [], finishedTickets: [] }
  },

  // Contador global de tickets: letra + número
  ticketCounter: { letter: "A", number: 1 },

  // Historial de los últimos 10 turnos llamados (para el display)
  callHistory: [],

  // Timestamp del último cambio (usado para detectar actualizaciones cruzadas)
  lastUpdated: 0,
};

// -----------------------------------------------------------------
// getState: Lee y devuelve el estado actual desde localStorage.
// Si no existe, retorna el estado por defecto.
// -----------------------------------------------------------------
function getState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE)); // copia profunda

    const parsed = JSON.parse(raw);

    // Asegurar que los módulos tengan todas las propiedades (por compatibilidad)
    for (let i = 1; i <= 4; i++) {
      if (!parsed.modules[i]) {
        parsed.modules[i] = { ...DEFAULT_STATE.modules[1] };
      }
    }

    return parsed;
  } catch (e) {
    console.error("Error leyendo estado:", e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

// -----------------------------------------------------------------
// setState: Guarda el estado en localStorage y marca timestamp.
// -----------------------------------------------------------------
function setState(newState) {
  try {
    newState.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.error("Error guardando estado:", e);
  }
}

// -----------------------------------------------------------------
// resetState: Reinicia todo el sistema de turnos al estado inicial.
// Conserva la configuración de módulos (active/paused).
// -----------------------------------------------------------------
function resetState() {
  const current = getState();
  const fresh = JSON.parse(JSON.stringify(DEFAULT_STATE));

  // Conservar configuración de activación de módulos
  for (let i = 1; i <= 4; i++) {
    fresh.modules[i].active = current.modules[i].active;
    // Limpiar turno en curso y pausa
    fresh.modules[i].paused = false;
    fresh.modules[i].currentTicket = null;
    fresh.modules[i].currentDocId = null;
    fresh.modules[i].calledAt = null;
    fresh.modules[i].isAttending = false;
    fresh.modules[i].assignedAt = 0;
    fresh.modules[i].callLogs = [];
    fresh.modules[i].finishedTickets = [];
  }

  setState(fresh);
}

// -----------------------------------------------------------------
// onStateChange: Registra un callback que se ejecuta cuando otro
// contexto (otra pestaña) cambia el estado en localStorage.
// -----------------------------------------------------------------
function onStateChange(callback) {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      // Parsear el nuevo estado y pasarlo al callback
      try {
        const newState = JSON.parse(event.newValue);
        callback(newState);
      } catch (e) {
        console.error("Error parseando cambio de estado:", e);
      }
    }
  });
}
