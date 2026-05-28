const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Clientes SSE conectados
const clients = new Set();

// Historial en memoria (últimas 100 alertas)
const alertas = [];
const MAX_ALERTAS = 100;

// ─── Middlewares ──────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SSE — conexión del dashboard ─────────────────────────────────
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Enviar historial al conectarse
  res.write(`data: ${JSON.stringify({ type: 'historial', data: alertas })}\n\n`);

  // Heartbeat cada 25 s para mantener la conexión viva en Railway
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 25000);

  clients.add(res);
  console.log(`[SSE] Cliente conectado. Total: ${clients.size}`);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    console.log(`[SSE] Cliente desconectado. Total: ${clients.size}`);
  });
});

// ─── API REST ─────────────────────────────────────────────────────

// Recibe alerta del ESP32
app.post('/api/panic', (req, res) => {
  const { device_id, timestamp, message, lat, lng, gps_real } = req.body;

  if (!device_id || !message) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  const alerta = {
    id:          Date.now(),
    device_id:   device_id,
    timestamp:   timestamp || new Date().toISOString(),
    message:     message,
    lat:         lat   || null,
    lng:         lng   || null,
    gps_real:    gps_real || false,
    received_at: new Date().toISOString(),
  };

  alertas.unshift(alerta);
  if (alertas.length > MAX_ALERTAS) alertas.pop();

  broadcast({ type: 'nueva_alerta', data: alerta });

  console.log(`[ALERTA] ${alerta.timestamp} | ${alerta.device_id} | ${alerta.message}`);
  res.json({ ok: true, id: alerta.id });
});

// Historial
app.get('/api/alertas', (req, res) => res.json(alertas));

// Eliminar historial
app.delete('/api/alertas', (req, res) => {
  alertas.length = 0;
  broadcast({ type: 'limpiar' });
  res.json({ ok: true });
});

// Alerta de prueba
app.post('/api/test', (req, res) => {
  const alerta = {
    id:          Date.now(),
    device_id:   'TEST-DEVICE',
    timestamp:   new Date().toISOString(),
    message:     '¡ALERTA DE PRUEBA!',
    lat:         19.432608,
    lng:         -99.133209,
    gps_real:    false,
    received_at: new Date().toISOString(),
  };

  alertas.unshift(alerta);
  if (alertas.length > MAX_ALERTAS) alertas.pop();

  broadcast({ type: 'nueva_alerta', data: alerta });
  console.log('[TEST] Alerta de prueba generada.');
  res.json({ ok: true });
});

// ─── Helpers ──────────────────────────────────────────────────────
function broadcast(obj) {
  const payload = `data: ${JSON.stringify(obj)}\n\n`;
  clients.forEach(client => client.write(payload));
}

// ─── Iniciar servidor ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚨 Servidor Panic Button corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api/panic\n`);
});
