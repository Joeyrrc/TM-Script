// ==UserScript==
// @name         WMS Backorder Marker met kleuren en slimme comment-check
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.4
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
      .rrc-wms-comment-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        padding: 2px 8px;
        border-radius: 16px;
        background-color: #ffcc00;
        color: #111827;
        font-size: 13px;
        font-weight: 700;
        line-height: 18px;
        white-space: nowrap;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function parseCommentAgeDays(dateText) {
    const text = normalize(dateText).toLowerCase();

    const daysMatch = text.match(/(\d+)\s+dagen?\s+geleden/);
    if (daysMatch) return parseInt(daysMatch[1], 10);

    const weeksMatch = text.match(/(\d+)\s+weken?\s+geleden/);
    if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;

    const monthsMatch = text.match(/(\d+)\s+maanden?\s+geleden/);
    if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;

    if (/gisteren/.test(text)) return 1;
    if (/zojuist|minuten?\s+geleden|uur\s+geleden|uren\s+geleden/.test(text)) return 0;

    return null;
  }

  function getCommentAgeFromTime(time) {
    const datetime = time.getAttribute('datetime');
    if (datetime) {
      const date = new Date(datetime);
      if (!Number.isNaN(date.getTime())) {
        return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
      }
    }

    return parseCommentAgeDays(time.textContent);
  }

  function getOldestCommentAgeDays(elements) {
    let oldestAge = 0;

    for (const element of elements) {
      const time = element.querySelector('time, span[title]');
      if (!time) continue;

      const age = getCommentAgeFromTime(time);
      if (age !== null && age > oldestAge) oldestAge = age;
    }

    return oldestAge;
  }

  function getCommentData(doc) {
    const commentsRoot = doc.querySelector('#comments');
    if (!commentsRoot) return { text: '', count: 0, oldestAge: 0 };

    const internalComments = Array.from(
      commentsRoot.querySelectorAll('section[aria-label="Interne opmerkingen"] article')
    );
    const internalCommentTexts = internalComments
      .map(comment => normalize((comment.querySelector('p') || comment).textContent))
      .filter(Boolean);

    if (internalCommentTexts.length) {
      return {
        text: normalize(internalCommentTexts.join(' ')),
        count: internalCommentTexts.length,
        oldestAge: getOldestCommentAgeDays(internalComments),
      };
    }

    return { text: '', count: 0, oldestAge: 0 };
  }

  async function fetchOrderCommentData(orderId, href) {
    const cached = orderCache.get(orderId);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;

    const response = await fetch(href, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });

    if (!response.ok) {
      throw new Error(`Order ${orderId} ophalen mislukt: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const data = getCommentData(doc);

    orderCache.set(orderId, { time: Date.now(), data });
    return data;
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

  function addCommentBadge(row, orderLink, commentData) {
    if (!commentData.count || row.querySelector('.rrc-wms-comment-badge')) return;

    const badge = document.createElement('span');
    badge.className = 'rrc-wms-comment-badge';
    badge.textContent = `💬 ${commentData.count}${commentData.oldestAge > 14 ? ' 📤' : ''}`;
    badge.title = `${commentData.count} interne opmerking${commentData.count === 1 ? '' : 'en'}`;

    orderLink.insertAdjacentElement('afterend', badge);
  }

  function applyMarker(row, orderLink, commentData) {
    addCommentBadge(row, orderLink, commentData);

    const lower = commentData.text.toLowerCase();
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
        const commentData = await fetchOrderCommentData(match[1], href);
        applyMarker(row, orderLink, commentData);
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
