// =============================================================
// recepcion.js — Lógica de la vista del recepcionista
// Permite generar turnos normales o de alta prioridad,
// validar el documento del paciente y ver el estado de la cola.
// =============================================================

// Verificar que el usuario autenticado tiene rol 'recepcion'
const session = requireRole('recepcion');

// -----------------------------------------------------------------
// Referencias a elementos del DOM
// -----------------------------------------------------------------
const docInput = document.getElementById('doc-id');
const btnNormal = document.getElementById('btn-normal');
const btnPriority = document.getElementById('btn-priority');
const formError = document.getElementById('form-error');
const nextTicketEl = document.getElementById('next-ticket-preview');
const qHighEl = document.getElementById('q-high');
const qNormalEl = document.getElementById('q-normal');
const queuePreviewList = document.getElementById('queue-preview-list');
const modulesStatusList = document.getElementById('modules-status-list');
const confirmationBox = document.getElementById('ticket-confirmation');
const confirmTicketEl = document.getElementById('confirmation-ticket');
const confirmDetailEl = document.getElementById('confirmation-detail');

// Temporizador para ocultar la confirmación automáticamente
let confirmationTimer = null;

// -----------------------------------------------------------------
// validateDoc: Valida que el campo de documento no esté vacío y
// tenga un formato razonable.
// Retorna true si es válido, false si no.
// -----------------------------------------------------------------
function validateDoc() {
    const val = docInput.value.trim();

    if (!val) {
        showFormError('Por favor ingresa el documento de identidad del paciente.');
        return false;
    }
    if (val.length < 4) {
        showFormError('El documento debe tener al menos 4 caracteres.');
        return false;
    }

    clearFormError();
    return true;
}

// -----------------------------------------------------------------
// showFormError / clearFormError: Muestra u oculta el mensaje de error
// -----------------------------------------------------------------
function showFormError(msg) {
    formError.textContent = msg;
    formError.style.display = 'block';
}
function clearFormError() {
    formError.style.display = 'none';
}

// -----------------------------------------------------------------
// enableButtons / disableButtons: Habilita o deshabilita los botones
// de generar turno según si hay texto en el campo de documento.
// -----------------------------------------------------------------
function updateButtonState() {
    const hasDoc = docInput.value.trim().length >= 4;
    btnNormal.disabled = !hasDoc;
    btnPriority.disabled = !hasDoc;
}

// -----------------------------------------------------------------
// showConfirmation: Muestra el mensaje de confirmación del turno
// generado y lo oculta después de 4 segundos.
// -----------------------------------------------------------------
function showConfirmation(ticket, priority) {
    const label = priority === 'high' ? '🔴 Alta Prioridad' : '🔵 Normal';

    confirmTicketEl.textContent = `Turno ${ticket}`;
    confirmDetailEl.textContent = `Generado correctamente — ${label}`;

    confirmationBox.classList.add('visible');

    // Ocultar después de 4 segundos
    clearTimeout(confirmationTimer);
    confirmationTimer = setTimeout(() => {
        confirmationBox.classList.remove('visible');
    }, 4000);
}

// -----------------------------------------------------------------
// generateTicket: Genera un nuevo turno y lo agrega a la cola.
// priority: 'normal' | 'high'
// -----------------------------------------------------------------
function generateTicket(priority) {
    if (!validateDoc()) return;

    const docId = docInput.value.trim();
    const state = getState();

    // Agregar el ticket a la cola correspondiente
    const ticket = addTicket(state, docId, priority);

    // Intentar asignación automática si hay módulos libres
    autoAssignToFreeModules(state);

    // Guardar el nuevo estado
    setState(state);

    // Feedback visual y limpieza del formulario
    showConfirmation(ticket.ticket, priority);
    docInput.value = '';
    docInput.focus();
    updateButtonState();

    // Refrescar la UI
    refreshUI();
}

// -----------------------------------------------------------------
// renderQueuePreview: Muestra los próximos 5 turnos en cola.
// -----------------------------------------------------------------
function renderQueuePreview(state) {
    const combined = [
        ...state.highQueue.map(t => ({ ...t, isHigh: true })),
        ...state.queue.map(t => ({ ...t, isHigh: false }))
    ].slice(0, 5); // Solo los primeros 5

    if (combined.length === 0) {
        queuePreviewList.innerHTML = '<div class="queue-empty">No hay turnos en espera</div>';
        return;
    }

    queuePreviewList.innerHTML = combined.map(t => `
    <div class="queue-item ${t.isHigh ? 'high-priority' : ''}">
      <span class="queue-item-ticket">${t.ticket}</span>
      <span class="queue-item-doc">Doc: ${t.docId}</span>
      ${t.isHigh ? '<span class="badge badge-high" style="font-size:0.6rem">🔴 Prioritario</span>' : ''}
    </div>
  `).join('');
}

// -----------------------------------------------------------------
// renderModulesStatus: Muestra un resumen del estado de cada módulo.
// -----------------------------------------------------------------
function renderModulesStatus(state) {
    modulesStatusList.innerHTML = '';

    for (let i = 1; i <= 4; i++) {
        const mod = state.modules[i];
        let statusText, statusClass;

        if (!mod.active) {
            statusText = 'Desactivado';
            statusClass = 'badge-inactive';
        } else if (mod.paused) {
            statusText = 'Pausado';
            statusClass = 'badge-paused';
        } else if (mod.currentTicket) {
            if (mod.calledAt) {
                statusText = `Llamando: ${mod.currentTicket}`;
                statusClass = 'badge-active animate-pulse'; // Assuming animate-pulse or similar exists or just badge-active
            } else if (mod.isAttending) {
                statusText = `Atendiendo: ${mod.currentTicket}`;
                statusClass = 'badge-success';
            } else {
                statusText = `Turno: ${mod.currentTicket}`;
                statusClass = 'badge-active';
            }
        } else {
            statusText = 'Libre';
            statusClass = 'badge-normal';
        }

        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0;';
        item.innerHTML = `
      <span style="font-size:0.875rem; font-weight:600; color:var(--gray-700)">Módulo ${i}</span>
      <span class="badge ${statusClass}" style="font-size:0.65rem;">${statusText}</span>
    `;
        modulesStatusList.appendChild(item);
    }
}

// -----------------------------------------------------------------
// refreshUI: Actualiza todos los elementos de la pantalla con el
// estado actual leído de localStorage.
// -----------------------------------------------------------------
function refreshUI() {
    const state = getState();

    // Actualizar preview del próximo ticket
    nextTicketEl.textContent = getNextTicketPreview(state);

    // Actualizar contadores de la cola
    qHighEl.textContent = state.highQueue.length;
    qNormalEl.textContent = state.queue.length;

    // Actualizar lista de próximos en cola
    renderQueuePreview(state);

    // Actualizar estado de módulos
    renderModulesStatus(state);
}

// -----------------------------------------------------------------
// Listeners de los botones de generación
// -----------------------------------------------------------------
btnNormal.addEventListener('click', () => generateTicket('normal'));
btnPriority.addEventListener('click', () => generateTicket('high'));

// Habilitar botones cuando se escribe en el campo de documento
docInput.addEventListener('input', () => {
    clearFormError();
    updateButtonState();
});

// Generar turno normal con tecla Enter en el campo de documento
docInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!btnNormal.disabled) generateTicket('normal');
    }
});

// -----------------------------------------------------------------
// Sincronización en tiempo real: escuchar cambios desde otros contextos
// -----------------------------------------------------------------
onStateChange(() => {
    refreshUI();
});

// -----------------------------------------------------------------
// Inicialización
// -----------------------------------------------------------------
refreshUI();
docInput.focus();
