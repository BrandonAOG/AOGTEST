// ============================================================
//  Always On Generators – Field Hub
//  Update Banner  |  update-banner.js
//
//  HOW TO USE:
//  Add this ONE line to the <head> of every page:
//    <script src="../update-banner.js"></script>
//
//  DO NOT edit changelog text here.
//  Edit the CHANGELOG array in sw.js instead.
//  That's the only file you need to touch when you update.
// ============================================================

(function () {
  if (!('serviceWorker' in navigator)) return;

  // ── Inject banner CSS ──────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#aog-update-banner {',
    '  position: fixed;',
    '  top: 0; left: 0; right: 0;',
    '  z-index: 9999;',
    '  background: #1a1a2e;',
    '  color: #fff;',
    '  font-family: sans-serif;',
    '  font-size: 14px;',
    '  padding: 12px 16px;',
    '  display: flex;',
    '  align-items: flex-start;',
    '  gap: 12px;',
    '  box-shadow: 0 2px 8px rgba(0,0,0,0.4);',
    '  transform: translateY(-100%);',
    '  transition: transform 0.35s ease;',
    '}',
    '#aog-update-banner.show { transform: translateY(0); }',
    '#aog-update-banner .aog-text { flex: 1; line-height: 1.5; }',
    '#aog-update-banner .aog-title {',
    '  font-weight: bold;',
    '  font-size: 15px;',
    '  margin-bottom: 4px;',
    '}',
    '#aog-update-banner .aog-list {',
    '  margin: 0;',
    '  padding-left: 18px;',
    '  color: #ccc;',
    '}',
    '#aog-update-banner .aog-list li { margin: 2px 0; }',
    '#aog-update-banner .aog-btn {',
    '  background: #e8a020;',
    '  color: #000;',
    '  border: none;',
    '  border-radius: 6px;',
    '  padding: 8px 14px;',
    '  font-weight: bold;',
    '  font-size: 13px;',
    '  cursor: pointer;',
    '  white-space: nowrap;',
    '  align-self: center;',
    '}',
    '#aog-update-banner .aog-btn:hover { background: #f5b535; }'
  ].join('\n');
  document.head.appendChild(style);

  // ── Ask the waiting SW for its changelog, then show banner ─
  function askAndShow(waitingWorker) {
    var channel = new MessageChannel();

    channel.port1.onmessage = function (event) {
      var version   = event.data.version   || 'New Version';
      var changelog = event.data.changelog || ['App has been updated'];
      showBanner(version, changelog, waitingWorker);
    };

    // Send GET_CHANGELOG to the *waiting* (new) SW, not the active one.
    // This guarantees we always get the fresh changelog text.
    waitingWorker.postMessage({ action: 'GET_CHANGELOG' }, [channel.port2]);
  }

  // ── Build and display the banner ───────────────────────────
  function showBanner(version, changelog, waitingWorker) {
    if (document.getElementById('aog-update-banner')) return; // already showing

    var listItems = changelog.map(function (item) {
      return '<li>' + item + '</li>';
    }).join('');

    var banner = document.createElement('div');
    banner.id = 'aog-update-banner';
    banner.innerHTML =
      '<div class="aog-text">' +
        '<div class="aog-title">⚡ App Update Ready — ' + version + '</div>' +
        '<ul class="aog-list">' + listItems + '</ul>' +
      '</div>' +
      '<button class="aog-btn" id="aog-update-btn">Update Now</button>';

    document.body.insertBefore(banner, document.body.firstChild);

    setTimeout(function () { banner.classList.add('show'); }, 100);

    document.getElementById('aog-update-btn').addEventListener('click', function () {
      waitingWorker.postMessage({ action: 'SKIP_WAITING' });
    });
  }

  // ── Reload once the new SW takes control ───────────────────
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    window.location.reload();
  });

  // ── Register SW and watch for a waiting update ─────────────
  navigator.serviceWorker.register('../sw.js', { scope: '../' })
    .then(function (reg) {

      // Waiting worker already present on page load
      if (reg.waiting) {
        askAndShow(reg.waiting);
        return;
      }

      // New worker found while user has the page open
      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            askAndShow(newWorker);
          }
        });
      });
    })
    .catch(function (err) {
      console.warn('[AOG Banner] SW registration failed:', err);
    });

})();
