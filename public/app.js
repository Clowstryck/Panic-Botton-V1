/* ─── Elementos del DOM ────────────────────────────────── */
const wsDot        = document.getElementById('wsDot');
const wsLabel      = document.getElementById('wsLabel');
const totalAlertas = document.getElementById('totalAlertas');
const activeAlert  = document.getElementById('activeAlert');
const activeMsg    = document.getElementById('activeMessage');
const activeDev    = document.getElementById('activeDevice');
const activeTime   = document.getElementById('activeTime');
const activeMap    = document.getElementById('activeMapLink');
const alertList    = document.getElementById('alertList');
const emptyState   = document.getElementById('emptyState');
const btnTest      = document.getElementById('btnTest');
const btnClear     = document.getElementById('btnClear');

let total = 0;

/* ─── Server-Sent Events ───────────────────────────────── */
function conectarSSE() {
  const es = new EventSource('/api/events');

  es.onopen = () => {
    wsDot.className     = 'dot connected';
    wsLabel.textContent = 'Conectado';
  };

  es.onerror = () => {
    wsDot.className     = 'dot disconnected';
    wsLabel.textContent = 'Reconectando...';
    // EventSource reconecta automáticamente
  };

  es.onmessage = (e) => {
    if (!e.data) return;
    const msg = JSON.parse(e.data);

    if (msg.type === 'historial') {
      msg.data.forEach(a => agregarTarjeta(a, false));
      actualizarContador();
    } else if (msg.type === 'nueva_alerta') {
      agregarTarjeta(msg.data, true);
      mostrarAlertaActiva(msg.data);
      reproducirSonido();
      actualizarContador();
    } else if (msg.type === 'limpiar') {
      limpiarLista();
    }
  };
}

/* ─── Alerta activa (banner) ───────────────────────────── */
function mostrarAlertaActiva(a) {
  activeMsg.textContent = a.message;
  activeDev.textContent = `Dispositivo: ${a.device_id}`;
  activeTime.textContent = `Hora: ${formatFecha(a.timestamp)}`;

  if (a.lat && a.lng) {
    activeMap.href = `https://maps.google.com/?q=${a.lat},${a.lng}`;
    activeMap.classList.remove('hidden');
  } else {
    activeMap.classList.add('hidden');
  }

  activeAlert.classList.remove('hidden');

  // Ocultar banner después de 15 s
  clearTimeout(activeAlert._timer);
  activeAlert._timer = setTimeout(() => activeAlert.classList.add('hidden'), 15000);
}

/* ─── Tarjeta de historial ─────────────────────────────── */
function agregarTarjeta(a, prepend = true) {
  emptyState.style.display = 'none';

  const esTest = a.device_id === 'TEST-DEVICE';
  const card = document.createElement('div');
  card.className = `alert-card${esTest ? ' test' : ''}`;
  card.dataset.id = a.id;

  const gpsHTML = (a.lat && a.lng)
    ? `<span class="card-gps">📍 <a href="https://maps.google.com/?q=${a.lat},${a.lng}" target="_blank" rel="noopener">${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}</a></span>`
    : '';

  card.innerHTML = `
    <div class="card-icon">${esTest ? '🔔' : '🆘'}</div>
    <div class="card-body">
      <div class="card-message">${escHtml(a.message)}</div>
      <div class="card-meta">
        <span>📟 ${escHtml(a.device_id)}</span>
        <span>🕐 ${formatFecha(a.timestamp)}</span>
        ${gpsHTML}
      </div>
      <div class="card-time">Recibido: ${formatFecha(a.received_at)}</div>
    </div>
  `;

  if (prepend) {
    alertList.insertBefore(card, alertList.firstChild);
    total++;
  } else {
    alertList.appendChild(card);
    total++;
  }
}

/* ─── Limpiar lista ────────────────────────────────────── */
function limpiarLista() {
  const cards = alertList.querySelectorAll('.alert-card');
  cards.forEach(c => c.remove());
  total = 0;
  actualizarContador();
  emptyState.style.display = '';
  activeAlert.classList.add('hidden');
}

/* ─── Contador ─────────────────────────────────────────── */
function actualizarContador() {
  totalAlertas.textContent = total;
}

/* ─── Sonido de alerta (beep sintético) ────────────────── */
function reproducirSonido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) { /* silenciar si el navegador bloquea audio */ }
}

/* ─── Botones ──────────────────────────────────────────── */
btnTest.addEventListener('click', async () => {
  btnTest.disabled = true;
  await fetch('/api/test', { method: 'POST' });
  setTimeout(() => { btnTest.disabled = false; }, 2000);
});

btnClear.addEventListener('click', async () => {
  if (!confirm('¿Eliminar todo el historial de alertas?')) return;
  await fetch('/api/alertas', { method: 'DELETE' });
});

/* ─── Helpers ──────────────────────────────────────────── */
function formatFecha(iso) {
  if (!iso || iso === 'sin-hora') return 'sin hora';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'short', timeStyle: 'medium'
    });
  } catch (_) { return iso; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Iniciar ──────────────────────────────────────────── */
conectarSSE();
