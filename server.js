const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;


// Historial en memoria (últimas 100 alertas)
const alertas = [];
const MAX_ALERTAS = 100;

// ─── Middlewares ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// ─── Dashboard ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Panic Button</title></head>
<body>
<h1>Panic Button Monitor</h1>
<p>Estado: <strong id="e">Conectando...</strong></p>
<p>Alertas: <strong id="t">0</strong></p>
<button onclick="limpiar()">Limpiar</button>
<hr><div id="lista"></div>
<script>
var u=0,tot=0;
function cargar(){
  fetch('/api/alertas').then(function(r){return r.json();}).then(function(d){
    for(var i=d.length-1;i>=0;i--)ag(d[i],false);
    if(d.length>0)u=d[0].id;
    tot=d.length;
    document.getElementById('t').textContent=tot;
    document.getElementById('e').textContent='Conectado';
  }).catch(function(e){document.getElementById('e').textContent='Error:'+e.message;});
}
function poll(){
  fetch('/api/alertas?since='+u+'&_='+Date.now()).then(function(r){return r.json();}).then(function(d){
    if(d.length>0){
      for(var i=d.length-1;i>=0;i--)ag(d[i],true);
      u=d[0].id; tot+=d.length;
      document.getElementById('t').textContent=tot;
    }
    document.getElementById('e').textContent='Conectado - '+new Date().toLocaleTimeString();
  }).catch(function(e){document.getElementById('e').textContent='Error:'+e.message;});
}
function ag(a,nueva){
  var div=document.createElement('div');
  div.innerHTML='<hr><p><b>'+a.message+'</b></p><p>Dispositivo: '+a.device_id+'</p><p>Hora: '+a.timestamp+'</p>'+(a.lat?'<p>GPS: <a href="https://maps.google.com/?q='+a.lat+','+a.lng+'" target="_blank">'+a.lat+', '+a.lng+'</a></p>':'');
  var l=document.getElementById('lista');
  if(nueva)l.insertBefore(div,l.firstChild);else l.appendChild(div);
}
function prueba(){fetch('/api/test',{method:'POST'});}
function limpiar(){
  fetch('/api/alertas',{method:'DELETE'}).then(function(){
    document.getElementById('lista').innerHTML='';
    document.getElementById('t').textContent='0';
    tot=0;u=0;
  });
}
cargar();
setInterval(poll,2000);
</script>
</body></html>`);
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

  console.log(`[ALERTA] ${alerta.timestamp} | ${alerta.device_id} | ${alerta.message}`);
  res.json({ ok: true, id: alerta.id });
});

// Historial — acepta ?since=<id> para devolver solo alertas nuevas
app.get('/api/alertas', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const since = parseInt(req.query.since) || 0;
  const resultado = since ? alertas.filter(a => a.id > since) : alertas;
  res.json(resultado);
});

// Eliminar historial
app.delete('/api/alertas', (req, res) => {
  alertas.length = 0;
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

  console.log('[TEST] Alerta de prueba generada.');
  res.json({ ok: true });
});

// ─── Iniciar servidor ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚨 Servidor Panic Button corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api/panic\n`);
});
