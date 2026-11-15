'use strict';

/* ============================================================
   КАМЕРА — просмотр снимков с камеры
   ============================================================ */

var CAM_URL = 'http://192.168.8.139:8001/snapshot';
var REFRESH_MS = 1000;  /* обновление каждую секунду */
var RETRY_MS = 3000;    /* повтор при ошибке */

var camEl = document.getElementById('cam');
var statusEl = document.getElementById('cam-status');
var errEl = document.getElementById('err');
var errDetail = document.getElementById('err-detail');
var hudClock = document.getElementById('hud-clock');

var refreshTimer = null;
var hudTimer = null;
var failCount = 0;
var running = true;

/* === Часы === */
function tickClock() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  hudClock.textContent = hh + ':' + mm;
}

/* === HUD показ/скрытие === */
function showHud() {
  document.body.classList.add('show-hud');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(function () {
    document.body.classList.remove('show-hud');
  }, 5000);
}

/* === Загрузка снимка === */
function loadSnapshot() {
  if (!running) return;

  var img = new Image();
  var url = CAM_URL + '?t=' + Date.now();

  img.onload = function () {
    failCount = 0;
    camEl.src = url;
    camEl.classList.add('live');
    statusEl.style.display = 'none';
    errEl.classList.add('hidden');

    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadSnapshot, REFRESH_MS);
  };

  img.onerror = function () {
    failCount++;
    if (failCount >= 3) {
      statusEl.style.display = 'none';
      errEl.classList.remove('hidden');
      errDetail.textContent = 'Не удалось подключиться к ' + CAM_URL;
    } else {
      statusEl.textContent = 'Переподключение...';
      statusEl.style.display = 'block';
    }
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadSnapshot, RETRY_MS);
  };

  img.src = url;
}

/* === Управление === */
function bindKeys() {
  document.addEventListener('keydown', function (e) {
    showHud();
    var k = e.keyCode || e.which;

    /* Back / Escape → возврат */
    if (k === 10009 || k === 27 || k === 461) {
      e.preventDefault();
      if (e.key === 'GoBack' || k === 10009 || k === 461) {
        try { window.history.back(); } catch (err) {}
        try { window.parent.postMessage('back', '*'); } catch (err) {}
      }
      return;
    }

    /* OK / Enter → показать HUD */
    if (k === 13) {
      e.preventDefault();
      showHud();
      return;
    }

    /* Красная → обновить */
    if (k === 403 || k === 82) {
      e.preventDefault();
      failCount = 0;
      errEl.classList.add('hidden');
      statusEl.textContent = 'Подключение...';
      statusEl.style.display = 'block';
      camEl.classList.remove('live');
      loadSnapshot();
      return;
    }

    /* Синяя → переключить камеру (заглушка) */
    if (k === 406 || k === 66) {
      e.preventDefault();
      return;
    }
  }, true);

  /* Показ HUD при движении мыши / касании */
  document.addEventListener('mousemove', showHud);
  document.addEventListener('click', showHud);

  /* Регистрация кнопок Samsung */
  try {
    if (window.tizen && tizen.tvinputdevice) {
      var keys = ['ColorF0Red', 'ColorF3Blue', 'Return', 'Exit', 'Enter'];
      keys.forEach(function (key) {
        try { tizen.tvinputdevice.registerKey(key); } catch (e) {}
      });
    }
  } catch (e) {}
}

/* === Кнопки на экране === */
document.getElementById('btn-back').addEventListener('click', function () {
  try { window.history.back(); } catch (e) {}
  try { window.parent.postMessage('back', '*'); } catch (e) {}
});

document.getElementById('btn-refresh').addEventListener('click', function () {
  failCount = 0;
  errEl.classList.add('hidden');
  camEl.classList.remove('live');
  statusEl.textContent = 'Подключение...';
  statusEl.style.display = 'block';
  loadSnapshot();
});

document.getElementById('btn-retry').addEventListener('click', function () {
  failCount = 0;
  errEl.classList.add('hidden');
  statusEl.textContent = 'Подключение...';
  statusEl.style.display = 'block';
  camEl.classList.remove('live');
  loadSnapshot();
});

/* === Старт === */
tickClock();
setInterval(tickClock, 1000);
showHud();
loadSnapshot();
bindKeys();
