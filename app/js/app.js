'use strict';

/* ============================================================
   КАМЕРА — RTSP видео (Samsung AVPlay) + снимки (fallback)
   ============================================================ */

var CAM_RTSP = 'rtsp://admin:@192.168.8.139:554/0/video0';
var CAM_SNAPSHOT = 'http://192.168.8.139:8001/snapshot';
var REFRESH_MS = 500;   /* снимок: обновление 2 раза в секунду */
var RETRY_MS = 3000;

var camEl = document.getElementById('cam');
var statusEl = document.getElementById('cam-status');
var errEl = document.getElementById('err');
var errDetail = document.getElementById('err-detail');
var hudClock = document.getElementById('hud-clock');
var playerContainer = document.getElementById('player-container');

var refreshTimer = null;
var hudTimer = null;
var failCount = 0;
var avplayActive = false;

/* === Часы === */
function tickClock() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  hudClock.textContent = hh + ':' + mm;
}

/* === HUD === */
function showHud() {
  document.body.classList.add('show-hud');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(function () {
    document.body.classList.remove('show-hud');
  }, 6000);
}

/* ============================================================
   ВАРИАНТ 1: Samsung AVPlay — нативный RTSP-плеер
   ============================================================ */
function tryAvplay() {
  if (avplayActive) return;

  /* Проверяем доступность webapis.avplay */
  var player = null;
  try {
    if (window.webapis && webapis.avplay) {
      player = webapis.avplay;
    } else if (window.avplay) {
      player = window.avplay;
    }
  } catch (e) {
    player = null;
  }

  if (!player) {
    console.log('[tvcam] AVPlay недоступен, пробую снимки');
    startSnapshots();
    return;
  }

  try {
    statusEl.textContent = 'Подключение к видеопотоку...';
    statusEl.style.display = 'block';

    /* Инициализация плеера */
    player.open(CAM_RTSP);
    player.setDisplayRect(0, 0, window.innerWidth, window.innerHeight);
    player.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
    player.setListener({
      onstreamcompleted: function () {
        console.log('[tvcam] поток завершён, переподключаюсь');
        avplayActive = false;
        setTimeout(tryAvplay, 2000);
      },
      onerror: function (err) {
        console.log('[tvcam] AVPlay ошибка: ' + JSON.stringify(err));
        avplayActive = false;
        startSnapshots();
      }
    });

    player.prepareAsync(
      function () {
        player.play();
        avplayActive = true;
        statusEl.style.display = 'none';
        errEl.classList.add('hidden');
        playerContainer.style.display = 'block';
        console.log('[tvcam] AVPlay играет!');
      },
      function (err) {
        console.log('[tvcam] AVPlay prepare error: ' + JSON.stringify(err));
        avplayActive = false;
        startSnapshots();
      }
    );
  } catch (e) {
    console.log('[tvcam] AVPlay exception: ' + e.message);
    avplayActive = false;
    startSnapshots();
  }
}

function stopAvplay() {
  try {
    var player = (window.webapis && webapis.avplay) ? webapis.avplay : window.avplay;
    if (player && player.getState() !== 'NONE') {
      player.stop();
      player.close();
    }
  } catch (e) {}
  avplayActive = false;
  playerContainer.style.display = 'none';
}

/* ============================================================
   ВАРИАНТ 2: Снимки (fallback) — работает в любом браузере
   ============================================================ */
function startSnapshots() {
  if (avplayActive) return;
  loadSnapshot();
}

function loadSnapshot() {
  if (avplayActive) return;

  var img = new Image();
  var url = CAM_SNAPSHOT + '?t=' + Date.now();

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
    if (failCount >= 5) {
      statusEl.style.display = 'none';
      errEl.classList.remove('hidden');
      errDetail.textContent = 'Камера ' + CAM_SNAPSHOT + ' недоступна';
    } else {
      statusEl.textContent = 'Переподключение... (' + failCount + ')';
      statusEl.style.display = 'block';
    }
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadSnapshot, RETRY_MS);
  };

  img.src = url;
}

/* ============================================================
   УПРАВЛЕНИЕ
   ============================================================ */
function doRefresh() {
  failCount = 0;
  errEl.classList.add('hidden');
  if (avplayActive) {
    stopAvplay();
    tryAvplay();
  } else {
    camEl.classList.remove('live');
    statusEl.textContent = 'Подключение...';
    statusEl.style.display = 'block';
    loadSnapshot();
  }
}

function doBack() {
  stopAvplay();
  try { window.history.back(); } catch (e) {}
  try { window.parent.postMessage('back', '*'); } catch (e) {}
}

function bindKeys() {
  document.addEventListener('keydown', function (e) {
    showHud();
    var k = e.keyCode || e.which;

    if (k === 10009 || k === 27 || k === 461) {
      e.preventDefault(); e.stopPropagation();
      doBack();
      return;
    }
    if (k === 13) {
      e.preventDefault();
      showHud();
      return;
    }
    if (k === 403 || k === 82) {
      e.preventDefault();
      doRefresh();
      return;
    }
  }, true);

  document.addEventListener('mousemove', showHud);
  document.addEventListener('click', showHud);

  try {
    if (window.tizen && tizen.tvinputdevice) {
      var keys = ['ColorF0Red', 'ColorF3Blue', 'Return', 'Exit', 'Enter'];
      keys.forEach(function (key) {
        try { tizen.tvinputdevice.registerKey(key); } catch (e) {}
      });
    }
  } catch (e) {}
}

document.getElementById('btn-back').addEventListener('click', doBack);
document.getElementById('btn-refresh').addEventListener('click', doRefresh);
document.getElementById('btn-retry').addEventListener('click', doRefresh);

/* ============================================================
   СТАРТ — сначала пробуем RTSP, потом снимки
   ============================================================ */
tickClock();
setInterval(tickClock, 1000);
showHud();
bindKeys();

/* Пробуем AVPlay; если не выйдет — снимки */
tryAvplay();
