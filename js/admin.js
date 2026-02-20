// =============================================================
// admin.js — Lógica del panel del administrador
// Gestiona módulos (activar/desactivar) y reinicio de turnos.
// =============================================================

// Verificar que el usuario autenticado tiene rol 'admin'
const session = requireRole('admin');

// -----------------------------------------------------------------
// Referencias a elementos del DOM
// -----------------------------------------------------------------
const modulesGrid = document.getElementById('modules-grid');
const statTotalQueue = document.getElementById('stat-total-queue');
const statHighQueue = document.getElementById('stat-high-queue');
const statActiveModules = document.getElementById('stat-active-modules');
const statNextTicket = document.getElementById('stat-next-ticket');
const btnReset = document.getElementById('btn-reset');
const btnActivateAll = document.getElementById('btn-activate-all');
const btnDeactivateAll = document.getElementById('btn-deactivate-all');
const modalReset = document.getElementById('modal-reset');
const btnCancelReset = document.getElementById('btn-cancel-reset');
const btnConfirmReset = document.getElementById('btn-confirm-reset');

// -----------------------------------------------------------------
// renderModulesGrid: Genera dinámicamente las 4 tarjetas de módulo
// con su estado actual (activo, inactivo, pausado) y toggle.
// -----------------------------------------------------------------
function renderModulesGrid(state) {
    modulesGrid.innerHTML = '';

    for (let i = 1; i <= 4; i++) {
        const mod = state.modules[i];

        // Determinar clase de estado de la tarjeta
        let cardClass = 'is-inactive';
        let badgeHtml = '<span class="badge badge-inactive"><span class="dot dot-inactive"></span> Desactivado</span>';

        if (mod.active && mod.paused) {
            cardClass = 'is-paused';
            badgeHtml = '<span class="badge badge-paused"><span class="dot dot-paused"></span> Pausado</span>';
        } else if (mod.active) {
            cardClass = 'is-active';
            badgeHtml = '<span class="badge badge-active"><span class="dot dot-active"></span> Activo</span>';
        }

        // Turno actual o placeholder
        const ticketHtml = mod.currentTicket
            ? `<div class="module-ticket-display">${mod.currentTicket}</div>
         <div class="module-doc-id">Doc: ${mod.currentDocId || '—'}</div>`
            : `<div class="module-ticket-empty">Sin turno</div>
         <div class="module-doc-id" style="min-height:20px;"></div>`;

        // HTML de la tarjeta
        const card = document.createElement('div');
        card.className = `module-card ${cardClass}`;
        card.style.animationDelay = `${(i - 1) * 0.08}s`;
        card.innerHTML = `
      <div class="module-card-header">
        <span class="module-number">Módulo ${i}</span>
        ${badgeHtml}
      </div>
      <div class="module-card-body">
        ${ticketHtml}
        <div class="toggle-wrapper">
          <span class="toggle-label">${mod.active ? 'Módulo activo' : 'Módulo desactivado'}</span>
          <label class="toggle-switch" title="${mod.active ? 'Desactivar módulo' : 'Activar módulo'}">
            <input
              type="checkbox"
              id="toggle-mod-${i}"
              ${mod.active ? 'checked' : ''}
              onchange="toggleModule(${i}, this.checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;

        modulesGrid.appendChild(card);
    }
}

// -----------------------------------------------------------------
// updateStats: Actualiza los contadores de estadísticas rápidas.
// -----------------------------------------------------------------
function updateStats(state) {
    statTotalQueue.textContent = getTotalInQueue(state);
    statHighQueue.textContent = state.highQueue.length;
    statNextTicket.textContent = getNextTicketPreview(state);

    // Contar módulos activos (sin importar si están pausados)
    let activeCount = 0;
    for (let i = 1; i <= 4; i++) {
        if (state.modules[i].active) activeCount++;
    }
    statActiveModules.textContent = activeCount;
}

// -----------------------------------------------------------------
// refreshUI: Re-renderiza toda la interfaz del admin con el estado
// actual leído de localStorage.
// -----------------------------------------------------------------
function refreshUI() {
    const state = getState();
    renderModulesGrid(state);
    updateStats(state);
}

// -----------------------------------------------------------------
// toggleModule: Activa o desactiva un módulo específico.
// Si se desactiva, el turno actual del módulo se devuelve a la cola.
// -----------------------------------------------------------------
function toggleModule(moduleId, activate) {
    const state = getState();
    const mod = state.modules[moduleId];

    if (!activate) {
        // Al desactivar: marcar inactivo primero, luego devolver el turno a cola
        mod.active = false;
        mod.paused = false; // Quitar pausa al desactivar

        // Si tenía turno en curso, devolverlo al frente de la cola normal
        if (mod.currentTicket) {
            state.queue.unshift({
                ticket: mod.currentTicket,
                docId: mod.currentDocId,
                priority: 'normal',
                timestamp: Date.now()
            });
            mod.currentTicket = null;
            mod.currentDocId  = null;
            mod.calledAt      = null;
        }
    } else {
        // Al activar: marcar activo ANTES de buscar en la cola,
        // así autoAssignToFreeModules puede verlo como disponible.
        mod.active = true;
        autoAssignToFreeModules(state);
    }

    setState(state);
    refreshUI();
}

// -----------------------------------------------------------------
// Botón: Activar todos los módulos a la vez
// -----------------------------------------------------------------
btnActivateAll.addEventListener('click', () => {
    const state = getState();
    for (let i = 1; i <= 4; i++) {
        state.modules[i].active = true;
    }
    autoAssignToFreeModules(state);
    setState(state);
    refreshUI();
});

// -----------------------------------------------------------------
// Botón: Desactivar todos los módulos a la vez
// -----------------------------------------------------------------
btnDeactivateAll.addEventListener('click', () => {
    const state = getState();
    for (let i = 1; i <= 4; i++) {
        const mod = state.modules[i];
        // Devolver turno en curso a la cola si había uno
        if (mod.currentTicket) {
            state.queue.unshift({
                ticket: mod.currentTicket,
                docId: mod.currentDocId,
                priority: 'normal',
                timestamp: Date.now()
            });
        }
        mod.active = false;
        mod.paused = false;
        mod.currentTicket = null;
        mod.currentDocId = null;
        mod.calledAt = null;
    }
    setState(state);
    refreshUI();
});

// -----------------------------------------------------------------
// Modal de reinicio: abrir / cerrar / confirmar
// -----------------------------------------------------------------
btnReset.addEventListener('click', () => {
    modalReset.classList.add('visible');
});

btnCancelReset.addEventListener('click', () => {
    modalReset.classList.remove('visible');
});

// Cerrar modal si se hace clic en el overlay oscuro
modalReset.addEventListener('click', (e) => {
    if (e.target === modalReset) modalReset.classList.remove('visible');
});

// Confirmar el reinicio del sistema
btnConfirmReset.addEventListener('click', () => {
    resetState();        // Reinicia localStorage al estado por defecto
    modalReset.classList.remove('visible');
    refreshUI();
});

// -----------------------------------------------------------------
// Sincronización en tiempo real: escuchar cambios desde otras pestañas
// -----------------------------------------------------------------
onStateChange(() => {
    refreshUI();
});

// -----------------------------------------------------------------
// Inicialización: renderizar al cargar la página
// -----------------------------------------------------------------
refreshUI();
