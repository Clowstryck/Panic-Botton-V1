let ultimoId = 0;

async function cargarHistorial() {
  const res  = await fetch('/api/alertas');
  const data = await res.json();
  data.slice().reverse().forEach(a => mostrarAlerta(a));
  if (data.length > 0) ultimoId = data[0].id;
  document.getElementById('total').textContent = data.length;
}

async function poll() {
  try {
    const res  = await fetch('/api/alertas?since=' + ultimoId + '&_=' + Date.now());
    const data = await res.json();

    if (data.length > 0) {
      data.slice().reverse().forEach(a => mostrarAlerta(a, true));
      ultimoId = data[0].id;
      document.getElementById('total').textContent =
        document.querySelectorAll('.alerta').length;
    }

    document.getElementById('estado').textContent = 'Conectado';
  } catch (_) {
    document.getElementById('estado').textContent = 'Sin conexion';
  }
}

function mostrarAlerta(a, nueva) {
  const div = document.createElement('div');
  div.className = 'alerta';
  div.innerHTML =
    '<hr>' +
    '<p><b>ALERTA DE PANICO</b></p>' +
    '<p>Dispositivo: ' + a.device_id + '</p>' +
    '<p>Hora: ' + a.timestamp + '</p>' +
    '<p>Recibido: ' + a.received_at + '</p>' +
    (a.lat ? '<p>GPS: ' + a.lat + ', ' + a.lng + '</p>' : '') +
    '<p>ID: ' + a.id + '</p>';

  const contenedor = document.getElementById('alertas');
  if (nueva) {
    contenedor.insertBefore(div, contenedor.firstChild);
  } else {
    contenedor.appendChild(div);
  }
}

async function enviarPrueba() {
  await fetch('/api/test', { method: 'POST' });
}

async function limpiar() {
  await fetch('/api/alertas', { method: 'DELETE' });
  document.getElementById('alertas').innerHTML = '';
  document.getElementById('total').textContent = '0';
  ultimoId = 0;
}

cargarHistorial();
setInterval(poll, 2000);
