// =============================================================
// sound.js — Generación de sonido de campanilla
// Usa la Web Audio API para generar el sonido sin necesidad
// de archivos de audio externos. A futuro se puede integrar
// síntesis de voz con la SpeechSynthesis API.
// =============================================================

// -----------------------------------------------------------------
// playBell: Reproduce un sonido de campanilla usando osciladores.
// Crea un sonido que imita una campana con fundido (fade-out).
// -----------------------------------------------------------------
function playBell() {
    try {
        // Crear contexto de audio (o reutilizar si ya existe)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn('Web Audio API no disponible en este navegador.');
            return;
        }

        const ctx = new AudioContext();

        // --- Primer tono de campanilla ---
        createBellTone(ctx, 880, 0, 0.6);    // La5 — tono principal
        createBellTone(ctx, 1108, 0, 0.3);   // Armónico superior
        createBellTone(ctx, 659, 0, 0.2);    // Armónico inferior

        // --- Segundo "ding" con pequeño retraso ---
        createBellTone(ctx, 1046, 0.35, 0.5); // Do6 — segundo tono
        createBellTone(ctx, 1318, 0.35, 0.2); // Armónico

    } catch (e) {
        console.error('Error al reproducir campanilla:', e);
    }
}

// -----------------------------------------------------------------
// createBellTone: Crea un tono individual de la campanilla.
// ctx: AudioContext
// frequency: frecuencia del tono en Hz
// startDelay: retardo en segundos antes de iniciar
// gainValue: volumen inicial (0–1)
// -----------------------------------------------------------------
function createBellTone(ctx, frequency, startDelay, gainValue) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Tipo de onda sinusoidal para sonido suave
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay);

    // Pequeña caída de frecuencia para simular campana real
    oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 0.5,
        ctx.currentTime + startDelay + 1.5
    );

    // Volumen inicial y fundido natural (fade-out)
    gainNode.gain.setValueAtTime(gainValue, ctx.currentTime + startDelay);
    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startDelay + 1.5
    );

    // Conectar: oscilador → ganancia → salida
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Iniciar y detener el tono
    oscillator.start(ctx.currentTime + startDelay);
    oscillator.stop(ctx.currentTime + startDelay + 1.5);
}

// -----------------------------------------------------------------
// announceTicket: Anuncia el turno por voz (SpeechSynthesis API).
// Preparado para integración futura. Actualmente desactivado.
// ticket: código del turno (ej: "A05")
// moduleId: número del módulo
// -----------------------------------------------------------------
function announceTicket(ticket, moduleId) {
    // Verificar disponibilidad de la API de síntesis de voz
    if (!window.speechSynthesis) {
        console.warn('SpeechSynthesis API no disponible.');
        return;
    }

    // Formatear el mensaje de voz
    // Ejemplo: "Turno A cero cinco, pase al módulo dos"
    const letters = ticket.slice(0, 1);      // Letra (ej: A)
    const numbers = parseInt(ticket.slice(1)); // Número (ej: 5)

    const message = `Turno ${letters} ${numbers}, pase al módulo ${moduleId}`;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'es-ES';  // Español
    utterance.rate = 0.9;      // Velocidad ligeramente reducida
    utterance.pitch = 1;       // Tono normal

    window.speechSynthesis.speak(utterance);
}
