/*
  palette — cookie-free visit analytics.

  What it records: that a visit happened, which channel it arrived from, how
  long it stayed, and which project carousels were clicked.

  What it never touches: cookies, localStorage, sessionStorage. The session id
  below lives in a JS variable and dies with the page, so nothing is written to
  the visitor's device and no identifier survives a reload. That is what keeps
  this outside ePrivacy Art. 5(3) — no consent banner required — and it is also
  why returning visitors cannot be recognised. That trade is deliberate.

  Of the referrer only the hostname is kept, never the full URL (which can carry
  search terms or private path segments). No IP address and no user-agent string
  is stored; the viewport is reduced to narrow/wide.
*/
(function () {
  var cfg = window.PALETTE_ANALYTICS;
  if (!cfg || cfg.url.indexOf('YOUR-PROJECT') === 0 || /YOUR-/.test(cfg.url)) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var endpoint = cfg.url.replace(/\/$/, '') + '/rest/v1/' + cfg.table;

  // in-memory only: correlates this page's events with each other, nothing more
  var session = Math.random().toString(36).slice(2) + Date.now().toString(36);

  function channel() {
    if (!document.referrer) return 'direct';
    try {
      var host = new URL(document.referrer).hostname.replace(/^www\./, '');
      return host === location.hostname ? 'direct' : host;
    } catch (e) {
      return 'unknown';
    }
  }

  function send(row) {
    row.session = session;
    // keepalive so the leave event still goes out while the page is unloading;
    // sendBeacon cannot carry the apikey headers Supabase needs.
    try {
      fetch(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
          Authorization: 'Bearer ' + cfg.anonKey,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      }).catch(function () {});
    } catch (e) {}
  }

  send({
    kind: 'view',
    channel: channel(),
    viewport: window.innerWidth < 700 ? 'narrow' : 'wide',
  });

  // dwell = time the page was actually visible, not time since load: a tab left
  // open in the background for an hour is not an hour of reading.
  var activeMs = 0;
  var since = document.visibilityState === 'visible' ? Date.now() : null;

  function accumulate() {
    if (since !== null) {
      activeMs += Date.now() - since;
      since = null;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (since === null) since = Date.now();
    } else {
      accumulate();
      flush();
    }
  });

  // Reported every time the page goes away, not once: a visitor who tabs out
  // after five seconds and comes back for ten minutes would otherwise be
  // recorded as a five-second visit. Each report carries the running total, and
  // the dashboard keeps the largest per session — which also means an
  // unreliable pagehide (Safari on iOS) costs precision, never the whole visit.
  var lastSent = 0;
  function flush() {
    if (activeMs < 1000 || activeMs - lastSent < 1000) return;
    lastSent = activeMs;
    send({ kind: 'leave', dwell_ms: Math.round(activeMs) });
  }
  window.addEventListener('pagehide', function () { accumulate(); flush(); });

  // carousel clicks, attributed to the project row the carousel sits in
  document.addEventListener('click', function (event) {
    var control = event.target.closest('.carousel-nav, .carousel-dot');
    if (!control) return;
    var row = control.closest('.row');
    var carousel = control.closest('.carousel');
    if (!row || !carousel) return;

    var slides = carousel.querySelectorAll('.carousel-slide');
    var index = 0;
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].classList.contains('is-active')) index = i;
    }

    send({ kind: 'carousel', project: row.id, slide: index });
  });
})();
