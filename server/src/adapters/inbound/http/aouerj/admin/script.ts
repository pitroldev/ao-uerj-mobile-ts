/**
 * O script da administração (`/aouerj/admin/admin.js`), um arquivo à parte
 * para a CSP do helmet (`script-src 'self'`) valer sem exceção. Só melhora o
 * que o HTML já faz: sem ele, as listas são links e as ações, formulários.
 *
 * - J/K (ou as setas) andam pela lista, E faz a ação principal, segurar T
 *   (ou o botão) corta, 0 a 6 trocam de área, Ctrl K ou / abrem o "Ir para".
 * - O corte só sai depois de segurar o botão (0,9 s; o que não tem volta, 1,5 s).
 * - O formulário de banir diz o prazo e só libera com o motivo.
 *
 * Tudo o que vem da página entra como texto (textContent), nunca como HTML.
 */
export const ADMIN_SCRIPT = String.raw`(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ a lista */
  var rundown = document.getElementById('rundown');
  var listKey = 'ao-admin-scroll:' + (rundown ? rundown.getAttribute('data-list') : '');
  if (rundown) {
    var saved = sessionStorage.getItem(listKey);
    if (saved) rundown.scrollTop = Number(saved) || 0;
    var current = rundown.querySelector('[aria-current="true"]');
    if (current) current.scrollIntoView({ block: 'nearest' });
    window.addEventListener('pagehide', function () {
      sessionStorage.setItem(listKey, String(rundown.scrollTop));
    });
  }
  function rows() {
    return rundown ? Array.prototype.slice.call(rundown.querySelectorAll('a.row')) : [];
  }
  function step(delta) {
    var list = rows();
    if (!list.length) return;
    var at = list.findIndex(function (row) { return row.getAttribute('aria-current') === 'true'; });
    var next = list[Math.max(0, Math.min(list.length - 1, (at < 0 ? -1 : at) + delta))];
    if (next && next !== list[at]) location.assign(next.href);
  }

  /* ------------------------------------------------- segurar para cortar */
  var holding = null;
  function startHold(button) {
    if (!button || button.disabled || holding) return;
    var ms = Number(button.getAttribute('data-hold')) || 900;
    var label = button.querySelector('[data-label]');
    var original = label ? label.textContent : '';
    if (label) label.textContent = 'Segurando…';
    button.classList.add('holding');
    var begin = performance.now();
    var frame = 0;
    function tick(now) {
      var progress = reduced ? 1 : Math.min(1, (now - begin) / ms);
      button.style.setProperty('--p', String(progress));
      if (progress >= 1 && now - begin >= ms) {
        holding = null;
        button.setAttribute('data-armed', '1');
        if (button.form) button.form.requestSubmit(button);
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    holding = {
      button: button,
      stop: function () {
        cancelAnimationFrame(frame);
        holding = null;
        button.classList.remove('holding');
        button.style.setProperty('--p', '0');
        if (label) label.textContent = original;
      },
    };
  }
  function stopHold() {
    if (holding) holding.stop();
  }
  document.addEventListener('pointerdown', function (event) {
    var button = event.target.closest && event.target.closest('button[data-hold]');
    if (button && event.button === 0) {
      event.preventDefault();
      button.focus();
      startHold(button);
    }
  });
  document.addEventListener('pointerup', stopHold);
  document.addEventListener('pointercancel', stopHold);
  document.addEventListener('pointerout', function (event) {
    if (holding && event.target === holding.button && !holding.button.contains(event.relatedTarget)) stopHold();
  });
  // o clique sozinho não corta: só o fim do segurar
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('button[data-hold]');
    if (button && button.getAttribute('data-armed') !== '1') event.preventDefault();
  }, true);

  /* ------------------------------------------------------------ o teclado */
  document.addEventListener('keydown', function (event) {
    var key = event.key;
    if ((event.ctrlKey || event.metaKey) && (key === 'k' || key === 'K')) {
      event.preventDefault();
      openPalette();
      return;
    }
    var target = event.target;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (target.closest && target.closest('button[data-hold]') && (key === 'Enter' || key === ' ')) {
      event.preventDefault();
      if (!event.repeat) startHold(target.closest('button[data-hold]'));
      return;
    }
    if (target.closest && target.closest('input, textarea, select, [contenteditable]')) return;
    if (key === 'j' || key === 'J' || key === 'ArrowDown') {
      if (rundown) { event.preventDefault(); step(1); }
    } else if (key === 'k' || key === 'K' || key === 'ArrowUp') {
      if (rundown) { event.preventDefault(); step(-1); }
    } else if (key === 'e' || key === 'E') {
      var primary = document.querySelector('[data-primary]');
      if (primary && !primary.disabled) { event.preventDefault(); primary.click(); }
    } else if (key === 't' || key === 'T') {
      if (!event.repeat) {
        var take = document.querySelector('button[data-hold]');
        if (take) { event.preventDefault(); startHold(take); }
      }
    } else if (key === '/') {
      event.preventDefault();
      openPalette();
    } else if (/^[0-6]$/.test(key)) {
      var area = document.querySelector('[data-key="' + key + '"]');
      if (area) location.assign(area.href);
    }
  });
  document.addEventListener('keyup', function (event) {
    if (event.key === 't' || event.key === 'T' || event.key === 'Enter' || event.key === ' ') stopHold();
  });

  /* ------------------------------------------------------------ Ir para */
  var palette = document.getElementById('palette');
  var paletteData = document.getElementById('palette-data');
  var entries = [];
  try { entries = paletteData ? JSON.parse(paletteData.textContent || '[]') : []; } catch (err) { entries = []; }
  var query = palette ? palette.querySelector('input') : null;
  var results = palette ? palette.querySelector('ul') : null;
  var chosen = 0;
  var shown = [];
  function drawPalette() {
    var text = query.value.trim().toLowerCase();
    shown = (text
      ? entries.filter(function (entry) {
          return (entry.label + ' ' + (entry.meta || '') + ' ' + entry.group).toLowerCase().indexOf(text) >= 0;
        })
      : entries.filter(function (entry) { return entry.top; })
    ).slice(0, 16);
    chosen = Math.min(chosen, Math.max(0, shown.length - 1));
    results.textContent = '';
    var group = '';
    shown.forEach(function (entry, index) {
      if (entry.group !== group) {
        group = entry.group;
        var heading = document.createElement('li');
        heading.className = 'h';
        heading.textContent = group;
        results.appendChild(heading);
      }
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = entry.href;
      link.setAttribute('aria-selected', String(index === chosen));
      var label = document.createElement('span');
      label.textContent = entry.label;
      link.appendChild(label);
      if (entry.meta) {
        var meta = document.createElement('span');
        meta.className = 'm';
        meta.textContent = entry.meta;
        link.appendChild(meta);
      }
      item.appendChild(link);
      results.appendChild(item);
    });
    if (!shown.length) {
      var none = document.createElement('li');
      none.className = 'h';
      none.textContent = 'Nada com esse nome. A matrícula se busca em Alunos.';
      results.appendChild(none);
    }
  }
  function openPalette() {
    if (!palette || palette.open) return;
    query.value = '';
    chosen = 0;
    drawPalette();
    palette.showModal();
    query.focus();
  }
  if (palette) {
    query.addEventListener('input', function () { chosen = 0; drawPalette(); });
    query.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); chosen = Math.min(shown.length - 1, chosen + 1); drawPalette(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); chosen = Math.max(0, chosen - 1); drawPalette(); }
      if (event.key === 'Enter' && shown[chosen]) { event.preventDefault(); location.assign(shown[chosen].href); }
    });
    palette.addEventListener('click', function (event) { if (event.target === palette) palette.close(); });
  }
  var go = document.getElementById('go');
  if (go) go.addEventListener('click', function (event) { event.preventDefault(); openPalette(); });

  /* ------------------------------------------------------------ banir */
  var ban = document.getElementById('ban-form');
  if (ban) {
    var reason = ban.querySelector('[name="motivo"]');
    var banTake = ban.querySelector('button[data-hold]');
    var banLabel = banTake.querySelector('[data-label]');
    var until = document.getElementById('ban-until');
    var stamp = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    var update = function () {
      var picked = ban.querySelector('[name="prazo"]:checked');
      var days = picked ? picked.value : '7';
      var ok = reason.value.trim().length >= 4;
      var forever = days === 'sempre';
      banTake.disabled = !ok;
      banTake.setAttribute('data-hold', forever ? '1500' : '900');
      banTake.classList.toggle('final', forever);
      banLabel.textContent = !ok ? 'Escolha ou escreva o motivo' : forever ? 'Segure para banir de vez' : 'Segure para banir por ' + (days === '1' ? '1 dia' : days + ' dias');
      if (until) until.textContent = forever ? 'Para sempre' : 'Até ' + stamp.format(new Date(Date.now() + Number(days) * 86400000));
    };
    ban.addEventListener('input', update);
    ban.addEventListener('change', update);
    Array.prototype.forEach.call(ban.querySelectorAll('[data-reason]'), function (chip) {
      chip.addEventListener('click', function () {
        reason.value = chip.getAttribute('data-reason') || '';
        update();
        reason.focus();
      });
    });
    update();
  }

  /* ----------------------------------------- copiar, o aviso e o relógio */
  document.addEventListener('click', function (event) {
    var copy = event.target.closest && event.target.closest('[data-copy]');
    if (!copy) return;
    event.preventDefault();
    var text = copy.getAttribute('data-copy') || '';
    var label = copy.querySelector('[data-label]');
    var done = function (word) { if (label) label.textContent = word; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done('Copiado'); }, function () { done('Não deu para copiar'); });
    else done('Não deu para copiar');
  });
  var snack = document.querySelector('.snack[data-auto]');
  if (snack) setTimeout(function () { snack.classList.add('gone'); }, 8000);
  var eye = document.getElementById('tok-eye');
  if (eye) eye.addEventListener('click', function () {
    var field = document.getElementById('token');
    field.type = field.type === 'password' ? 'text' : 'password';
    eye.setAttribute('aria-label', field.type === 'password' ? 'Mostrar o token' : 'Esconder o token');
  });
  var clock = document.getElementById('tc');
  if (clock) {
    var day = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' });
    var time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    var tickClock = function () {
      var now = new Date();
      clock.textContent = '';
      clock.appendChild(document.createTextNode(day.format(now).replace('.', '') + ' · '));
      var strong = document.createElement('b');
      strong.textContent = time.format(now);
      clock.appendChild(strong);
    };
    tickClock();
    setInterval(tickClock, 1000);
  }
})();
`;
