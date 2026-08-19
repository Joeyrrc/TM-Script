// ==UserScript==
// @name         WMS Backorder Marker met kleuren en slimme comment-check
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.1
// @description  Kleurt WMS-backorders op basis van orderopmerkingen: B2B blauw, niet leverbaar/niet op voorraad groen.
// @match        https://wms.rrcommerce.nl/backorders*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/wms-backorder-marker.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/wms-backorder-marker.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'rrc-wms-backorder-marker-style';
  const ROW_STATUS_ATTR = 'data-rrc-backorder-marker';
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const CONCURRENCY = 3;

  const orderCache = new Map();
  const queue = [];
  let running = 0;

  console.debug('[BackorderMarker][WMS] Script actief');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      tr[${ROW_STATUS_ATTR}="b2b"] {
        background-color: #eff7ff !important;
      }
      tr[${ROW_STATUS_ATTR}="stock"] {
        background-color: #f0fdf4 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function getCommentText(doc) {
    const commentsRoot = doc.querySelector('#comments');
    if (!commentsRoot) return '';

    const timelineItems = Array.from(commentsRoot.querySelectorAll('ol li'));
    const realComments = timelineItems.filter(item => {
      const text = normalize(item.textContent);
      return text && !/^aangemaakt\b/i.test(text);
    });

    return normalize(realComments.map(item => item.textContent).join(' '));
  }

  async function fetchOrderCommentText(orderId, href) {
    const cached = orderCache.get(orderId);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.text;

    const response = await fetch(href, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });

    if (!response.ok) {
      throw new Error(`Order ${orderId} ophalen mislukt: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = getCommentText(doc);

    orderCache.set(orderId, { time: Date.now(), text });
    return text;
  }

  function enqueue(task) {
    queue.push(task);
    runQueue();
  }

  function runQueue() {
    while (running < CONCURRENCY && queue.length) {
      const task = queue.shift();
      running += 1;

      Promise.resolve()
        .then(task)
        .catch(error => console.warn('[BackorderMarker][WMS]', error))
        .finally(() => {
          running -= 1;
          runQueue();
        });
    }
  }

  function findOrderLink(row) {
    return Array.from(row.querySelectorAll('a[href^="/orders/"]'))
      .find(link => /\/orders\/\d+/.test(link.getAttribute('href') || ''));
  }

  function applyMarker(row, commentText) {
    const lower = commentText.toLowerCase();
    const isStockComment = lower.includes('niet leverbaar') || lower.includes('niet op voorraad');

    if (isStockComment) {
      row.setAttribute(ROW_STATUS_ATTR, 'stock');
      return;
    }

    if (lower.includes('b2b')) {
      row.setAttribute(ROW_STATUS_ATTR, 'b2b');
      return;
    }

    row.setAttribute(ROW_STATUS_ATTR, 'checked');
  }

  function processRows() {
    ensureStyle();

    const rows = document.querySelectorAll('table tbody tr');
    for (const row of rows) {
      if (row.hasAttribute(ROW_STATUS_ATTR)) continue;

      const orderLink = findOrderLink(row);
      if (!orderLink) continue;

      const href = orderLink.getAttribute('href');
      const match = href.match(/\/orders\/(\d+)/);
      if (!match) continue;

      row.setAttribute(ROW_STATUS_ATTR, 'loading');

      enqueue(async () => {
        const commentText = await fetchOrderCommentText(match[1], href);
        applyMarker(row, commentText);
      });
    }
  }

  function init() {
    let tries = 0;
    const interval = setInterval(() => {
      processRows();
      tries += 1;
      if (tries > 40 && document.querySelector('table tbody tr')) clearInterval(interval);
    }, 500);

    const observer = new MutationObserver(() => processRows());
    observer.observe(document.body, { childList: true, subtree: true });

    const originalPushState = history.pushState;
    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      setTimeout(processRows, 400);
      return result;
    };

    window.addEventListener('popstate', () => setTimeout(processRows, 400));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
