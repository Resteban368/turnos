// =============================================================
// tickets.js — Lógica de generación y gestión de turnos
// Maneja la cola de prioridad, generación de tickets
// y asignación automática a módulos disponibles.
// =============================================================

// -----------------------------------------------------------------
// generateNextTicketCode: Genera el código del próximo ticket
// basado en el contador actual (ej: A01, A99 → B01, ..., Z99).
// Modifica el estado y devuelve el código generado.
// -----------------------------------------------------------------
function generateNextTicketCode(state) {
    const { letter, number } = state.ticketCounter;

    // Formatear: letra + número con dos dígitos (ej: A01, B12)
    const code = `${letter}${String(number).padStart(2, '0')}`;

    // Avanzar el contador al siguiente número
    if (number >= 99) {
        // Pasar a la siguiente letra
        state.ticketCounter.number = 1;
        const nextCharCode = letter.charCodeAt(0) + 1;

        // Si supera la 'Z', volver a 'A' (ciclo)
        state.ticketCounter.letter = nextCharCode > 90
            ? 'A'
            : String.fromCharCode(nextCharCode);
    } else {
        state.ticketCounter.number++;
    }

    return code;
}

// -----------------------------------------------------------------
// getNextTicketPreview: Devuelve el código del próximo ticket
// sin modificar el estado (solo lectura, para mostrar preview).
// -----------------------------------------------------------------
function getNextTicketPreview(state) {
    const { letter, number } = state.ticketCounter;
    return `${letter}${String(number).padStart(2, '0')}`;
}

// -----------------------------------------------------------------
// addTicket: Crea y agrega un nuevo turno a la cola correspondiente.
// priority: 'high' | 'normal'
// Retorna el objeto ticket creado.
// -----------------------------------------------------------------
function addTicket(state, docId, priority = 'normal') {
    const code = generateNextTicketCode(state);

    const ticket = {
        ticket: code,           // Código del turno (ej: A05)
        docId: docId.trim(),    // Documento de identidad del paciente
        priority: priority,     // 'high' | 'normal'
        timestamp: Date.now()   // Hora de creación para ordenamiento
    };

    if (priority === 'high') {
        // Los turnos de alta prioridad van al inicio de su cola
        state.highQueue.push(ticket);
    } else {
        // Los turnos normales se agregan al final (FIFO)
        state.queue.push(ticket);
    }

    return ticket;
}

// -----------------------------------------------------------------
// peekNextTicket: Mira el próximo turno a atender sin retirarlo.
// Los de alta prioridad tienen precedencia sobre los normales.
// -----------------------------------------------------------------
function peekNextTicket(state) {
    if (state.highQueue.length > 0) return state.highQueue[0];
    if (state.queue.length > 0) return state.queue[0];
    return null;
}

// -----------------------------------------------------------------
// dequeueNextTicket: Retira y retorna el próximo turno.
// Alta prioridad primero, luego normal.
// -----------------------------------------------------------------
function dequeueNextTicket(state) {
    if (state.highQueue.length > 0) {
        return state.highQueue.shift(); // Saca el primero de alta prioridad
    }
    if (state.queue.length > 0) {
        return state.queue.shift(); // Saca el primero normal
    }
    return null; // No hay turnos en cola
}

// -----------------------------------------------------------------
// getTotalInQueue: Retorna la cantidad total de turnos en espera.
// -----------------------------------------------------------------
function getTotalInQueue(state) {
    return state.highQueue.length + state.queue.length;
}

// -----------------------------------------------------------------
// assignTicketToModule: Intenta asignar el próximo turno de la cola
// a un módulo específico. Solo si el módulo está activo, no pausado
// y no tiene turno en curso.
// Retorna true si se asignó, false si no.
// -----------------------------------------------------------------
function assignTicketToModule(state, moduleId) {
    const mod = state.modules[moduleId];

    // Verificar que el módulo puede recibir un turno
    if (!mod.active || mod.paused || mod.currentTicket !== null) {
        return false;
    }

    const next = dequeueNextTicket(state);
    if (!next) return false; // No hay turnos disponibles

    // Asignar el turno al módulo
    mod.currentTicket = next.ticket;
    mod.currentDocId = next.docId;
    mod.calledAt = null; // Aún no ha sido llamado
    mod.isAttending = true; // El usuario quiere que inicie en "atendiendo"
    mod.assignedAt = Date.now();
    
    // NO limpiamos callLogs aquí para que sea persistente hasta el reinicio de admin
    if (!mod.callLogs) mod.callLogs = []; 

    return true;
}

// -----------------------------------------------------------------
// autoAssignToFreeModules: Recorre todos los módulos y asigna
// turnos automáticamente a los que estén disponibles.
// Se llama cada vez que se agrega un turno nuevo o un módulo queda libre.
// -----------------------------------------------------------------
function autoAssignToFreeModules(state) {
    for (let i = 1; i <= 4; i++) {
        const mod = state.modules[i];
        // Solo intentar si hay turnos en cola
        if (getTotalInQueue(state) === 0) break;

        if (mod.active && !mod.paused && mod.currentTicket === null) {
            assignTicketToModule(state, i);
        }
    }
}

// -----------------------------------------------------------------
// completeCurrentTicket: Marca el turno del módulo como completado
// y lo elimina. Después intenta asignar el siguiente de la cola.
// -----------------------------------------------------------------
function completeCurrentTicket(state, moduleId) {
    const mod = state.modules[moduleId];
    if (!mod.currentTicket) return; // No hay turno activo

    // Registrar el turno como finalizado en la historia del módulo
    if (!mod.finishedTickets) mod.finishedTickets = [];
    mod.finishedTickets.push({
        ticket: mod.currentTicket,
        docId: mod.currentDocId,
        finishedAt: Date.now()
    });

    // Limpiar el turno actual
    mod.currentTicket = null;
    mod.currentDocId = null;
    mod.calledAt = null;
    mod.isAttending = false;
    mod.assignedAt = 0;
    // NO limpiamos callLogs aquí por petición del usuario: "solo se puede borrar cuando el administrador reinicie todo"

    // Intentar asignar el siguiente turno automáticamente
    autoAssignToFreeModules(state);
}

// -----------------------------------------------------------------
// callCurrentTicket: Registra la llamada de un turno en el historial
// del display. Se invoca cuando el operador presiona "Llamar".
// -----------------------------------------------------------------
function callCurrentTicket(state, moduleId) {
    const mod = state.modules[moduleId];
    if (!mod.currentTicket) return;

    mod.calledAt = Date.now();

    // Registrar en los logs locales del módulo para el historial agrupado
    if (!mod.callLogs) mod.callLogs = [];
    mod.callLogs.push({
        ticket: mod.currentTicket,
        docId: mod.currentDocId,
        calledAt: mod.calledAt
    });

    // Agregar al historial de llamados (máximo 10 registros) - Seguimos guardando esto para compatibilidad o historial global
    const record = {
        ticket: mod.currentTicket,
        moduleId: moduleId,
        calledAt: mod.calledAt
    };

    state.callHistory.unshift(record); // Agregar al inicio

    // Mantener solo los últimos 10
    if (state.callHistory.length > 10) {
        state.callHistory = state.callHistory.slice(0, 10);
    }
}

// -----------------------------------------------------------------
// attendCurrentTicket: Cambia el estado del módulo a "atendiendo".
// -----------------------------------------------------------------
function attendCurrentTicket(state, moduleId) {
    const mod = state.modules[moduleId];
    if (!mod.currentTicket) return;

    mod.isAttending = true;
    mod.calledAt = null; // Limpiar para detener el flash visual en display
}
