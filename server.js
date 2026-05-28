const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Historial en memoria (últimas 100 alertas)
const alertas = [];
const MAX_ALERTAS = 100;

// ─── Middlewares ──────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API REST ─────────────────────────────────────────────────────

// Recibe alerta del ESP32
app.post('/api/panic', (req, res) => {
  const { device_id, timestamp, message, lat, lng, gps_real } = req.body;

  if (!device_id || !message) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  const alerta = {
    id:        Date.now(),
    device_id: device_id || 'desconocido',
    timestamp: timestamp || new Date().toISOString(),
    message:   message,
    lat:       lat   || null,
    lng:       lng   || null,
    gps_real:  gps_real || false,
    received_at: new Date().toISOString(),
  };

  // Guardar en historial
  alertas.unshift(alerta);
  if (alertas.length > MAX_ALERTAS) alertas.pop();

  // Broadcast a todos los clientes WebSocket conectados
  const payload = JSON.stringify({ type: 'nueva_alerta', data: alerta });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });

  console.log(`[ALERTA] ${alerta.timestamp} | ${alerta.device_id} | ${alerta.message}`);
  res.json({ ok: true, id: alerta.id });
});

// Devuelve historial de alertas
app.get('/api/alertas', (req, res) => {
  res.json(alertas);
});

// Eliminar todas las alertas
app.delete('/api/alertas', (req, res) => {
  alertas.length = 0;
  broadcast({ type: 'limpiar' });
  res.json({ ok: true });
});

// Enviar alerta de prueba desde el dashboard
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

// ─── WebSocket ────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('[WS] Cliente conectado. Total:', wss.clients.size);

  // Enviar historial al conectarse
  ws.send(JSON.stringify({ type: 'historial', data: alertas }));

  ws.on('close', () => {
    console.log('[WS] Cliente desconectado. Total:', wss.clients.size);
  });
});

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

// ─── Iniciar servidor ─────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚨 Servidor Panic Button corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api/panic\n`);
});
