'use strict';

/* ============================================================
   КАМЕРЫ — сетка 3 камер + увеличение
   ============================================================ */

var CAMERAS = [
  {
    name: 'Улица (ворота)',
    rtsp: 'rtsp://admin:@192.168.8.135:554/0/av',
    snap: 'http://192.168.8.135:8001/snapshot'
  },
  {
    name: 'Комната',
    rtsp: 'rtsp://admin:@192.168.8.136:554/0/av',
    snap: 'http://192.168.8.136:8001/snapshot'
  },
  {
    name: 'Парковка',
    rtsp: 'rtsp://admin:@192.168.8.139:554/0/av',
    snap: 'http://192.168.8.139:8001/snapshot'
  }
];

var selIdx = 0;
var zoomMode = false;
var volume = 80;
var REFRESH_MS = 500;
var RETRY_MS = 3000;

var timers = [null, null, null];
var failCounts = [0, 0, 0];

/* === Часы === */
function tickClock() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('hud-clock').textContent = hh + ':' + mm;
}

/* === HUD === */
var hudTimer = null;
function showHud() {
  document.body.classList.add('show-hud');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(function () {
    document.body.classList.remove('show-hud');
  }, 6000);
}

/* === Громкость === */
var volTimer = null;
function showVolume() {
  var bar = document.getElementById('vol-bar');
  document.getElementById('vol-fill').style.width = volume + '%';
  document.getElementById('vol-val').textContent = volume;
  bar.classList.add('show');
  clearTimeout(volTimer);
  volTimer = setTimeout(function () { bar.classList.remove('show'); }, 3000);
}

function setVolume(val) {
  volume = Math.max(0, Math.min(100, val));
  showVolume();
}

/* ============================================================
   Снимки — обновление всех камер в сетке
   ============================================================ */
function loadSnapshot(idx) {
  var img = document.getElementById('img-' + idx);
  var loading = img.parentElement.querySelector('.cam-loading');
  var url = CAMERAS[idx].snap + '?t=' + Date.now();

  var tmp = new Image();
  tmp.onload = function () {
    failCounts[idx] = 0;
    img.src = url;
    img.classList.add('live');
    if (loading) loading.style.display = 'none';
    if (timers[idx]) clearTimeout(timers[idx]);
    timers[idx] = setTimeout(function () { loadSnapshot(idx); }, REFRESH_MS);
  };
  tmp.onerror = function () {
    failCounts[idx]++;
    if (failCounts[idx] >= 5 && loading) {
      loading.textContent = '✕';
    } else if (loading) {
      loading.textContent = '...';
    }
    if (timers[idx]) clearTimeout(timers[idx]);
    timers[idx] = setTimeout(function () { loadSnapshot(idx); }, RETRY_MS);
  };
  tmp.src = url;
}

function loadZoomSnapshot() {
  if (!zoomMode) return;
  var img = document.getElementById('zoom-img');
  var loading = document.getElementById('zoom-loading');
  var url = CAMERAS[selIdx].snap + '?t=' + Date.now();

  var tmp = new Image();
  tmp.onload = function () {
    img.src = url;
    img.classList.add('live');
    loading.style.display = 'none';
    if (timers[0]) clearTimeout(timers[0]);
    timers[0] = setTimeout(loadZoomSnapshot, REFRESH_MS);
  };
  tmp.onerror = function () {
    loading.textContent = 'Переподключение...';
    loading.style.display = 'block';
    if (timers[0]) clearTimeout(timers[0]);
    timers[0] = setTimeout(loadZoomSnapshot, RETRY_MS);
  };
  tmp.src = url;
}

/* ============================================================
   Выбор камеры в сетке
   ============================================================ */
function updateSelection() {
  for (var i = 0; i < CAMERAS.length; i++) {
    var box = document.getElementById('box-' + i);
    box.classList.toggle('selected', i === selIdx);
  }
}

function selectCam(dir) {
  selIdx = ((selIdx + dir) % CAMERAS.length + CAMERAS.length) % CAMERAS.length;
  updateSelection();
}

/* ============================================================
   Увеличение / выход
   ============================================================ */
function enterZoom() {
  zoomMode = true;
  var zoom = document.getElementById('zoom');
  var zImg = document.getElementById('zoom-img');
  var zLabel = document.getElementById('zoom-label');
  var zLoading = document.getElementById('zoom-loading');
  var grid = document.getElementById('grid');

  zLabel.textContent = CAMERAS[selIdx].name;
  zImg.classList.remove('live');
  zLoading.textContent = 'Подключение...';
  zLoading.style.display = 'block';
  grid.style.display = 'none';
  zoom.classList.remove('hidden');

  /* Останавливаем сетку */
  for (var i = 0; i < 3; i++) {
    if (timers[i]) clearTimeout(timers[i]);
    timers[i] = null;
  }

  loadZoomSnapshot();
}

function exitZoom() {
  zoomMode = false;
  document.getElementById('zoom').classList.add('hidden');
  document.getElementById('grid').style.display = '';
  if (timers[0]) clearTimeout(timers[0]);

  /* Перезапускаем сетку */
  for (var i = 0; i < CAMERAS.length; i++) {
    loadSnapshot(i);
  }
}

/* ============================================================
   Управление
   ============================================================ */
function doBack() {
  if (zoomMode) {
    exitZoom();
    return;
  }
  try { window.history.back(); } catch (e) {}
  try { window.parent.postMessage('back', '*'); } catch (e) {}
}

function doRefresh() {
  if (zoomMode) {
    document.getElementById('zoom-img').classList.remove('live');
    document.getElementById('zoom-loading').textContent = 'Подключение...';
    document.getElementById('zoom-loading').style.display = 'block';
    loadZoomSnapshot();
  } else {
    for (var i = 0; i < CAMERAS.length; i++) {
      failCounts[i] = 0;
      document.getElementById('img-' + i).classList.remove('live');
      loadSnapshot(i);
    }
  }
}

function bindKeys() {
  document.addEventListener('keydown', function (e) {
    showHud();
    var k = e.keyCode || e.which;
    var keyName = e.key || '';

    /* Back */
    if (k === 10009 || k === 27 || k === 461) {
      e.preventDefault(); e.stopPropagation();
      doBack();
      return;
    }

    /* OK / Enter → увеличить */
    if (k === 13) {
      e.preventDefault();
      if (zoomMode) { exitZoom(); } else { enterZoom(); }
      return;
    }

    /* ← → */
    if (k === 37 || k === 10037 || keyName === 'ArrowLeft') {
      e.preventDefault(); e.stopPropagation();
      if (!zoomMode) selectCam(-1);
      return;
    }
    if (k === 39 || k === 10039 || keyName === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation();
      if (!zoomMode) selectCam(1);
      return;
    }

    /* ↑ ↓ */
    if (k === 38 || k === 10038 || keyName === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (!zoomMode) selectCam(-2);
      return;
    }
    if (k === 40 || k === 10040 || keyName === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      if (!zoomMode) selectCam(2);
      return;
    }

    /* VolumeUp / VolumeDown */
    if (k === 447 || k === 175 || keyName === 'VolumeUp') {
      e.preventDefault(); e.stopPropagation();
      setVolume(volume + 10);
      return;
    }
    if (k === 448 || k === 174 || keyName === 'VolumeDown') {
      e.preventDefault(); e.stopPropagation();
      setVolume(volume - 10);
      return;
    }

    /* Красная → обновить */
    if (k === 403 || k === 82) {
      e.preventDefault();
      doRefresh();
      return;
    }

    /* Зелёная → увеличить */
    if (k === 404 || k === 71) {
      e.preventDefault();
      if (zoomMode) exitZoom(); else enterZoom();
      return;
    }

    /* Жёлтая → назад */
    if (k === 405 || k === 89) {
      e.preventDefault();
      doBack();
      return;
    }
  }, true);

  document.addEventListener('mousemove', showHud);
  document.addEventListener('click', showHud);

  try {
    if (window.tizen && tizen.tvinputdevice) {
      var keys = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
                  'Return', 'Exit', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                  'VolumeUp', 'VolumeDown', 'VolumeMute'];
      keys.forEach(function (key) {
        try { tizen.tvinputdevice.registerKey(key); } catch (e) {}
      });
    }
  } catch (e) {}
}

/* === Кнопки === */
document.getElementById('btn-back').addEventListener('click', doBack);

/* Клик по камере в сетке */
for (var i = 0; i < 3; i++) {
  (function (idx) {
    document.getElementById('box-' + idx).addEventListener('click', function () {
      selIdx = idx;
      updateSelection();
      enterZoom();
    });
  })(i);
}

/* ============================================================
   СТАРТ
   ============================================================ */
tickClock();
setInterval(tickClock, 1000);
updateSelection();
showHud();
bindKeys();

/* Запуск всех камер в сетке */
for (var i = 0; i < CAMERAS.length; i++) {
  loadSnapshot(i);
}
