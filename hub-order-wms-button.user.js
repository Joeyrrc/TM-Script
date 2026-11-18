// ==UserScript==
// @name         Hub order naar de WMS
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.5
// @description  Plaats WMS-knoppen naast de pagina-acties en bij de WMS Orders kaart
// @match        https://suite.rrcommerce.nl/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/hub-order-wms-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/hub-order-wms-button.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'rrc-hub-order-wms-btn';
  const PAGE_BTN_ID = 'rrc-hub-order-wms-page-btn';
  const STYLE_ID = 'rrc-hub-order-wms-style';
  const WMS_SEARCH_URL = 'https://wms.rrcommerce.nl/orders';

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID}, #${PAGE_BTN_ID} {
        background: #6b21fc;
        border-color: #6b21fc;
        color: #ffffff;
        text-decoration: none;
      }
      #${BTN_ID}:hover, #${PAGE_BTN_ID}:hover {
        background: #581cdb !important;
        border-color: #581cdb !important;
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getWmsCard() {
    return (
      document.getElementById('wms') ||
      Array.from(document.querySelectorAll('[data-slot="card"]')).find(card =>
        Array.from(card.querySelectorAll('h3')).some(heading => normalize(heading.textContent) === 'WMS Orders')
      )
    );
  }

  function getWmsOrderCode(card) {
    const match = normalize(card ? card.textContent : document.body.textContent).match(/\bOrder\s+(O\d{4}-\d+)\b/);
    return match ? match[1] : null;
  }

  function getHubOrderNumber() {
    const heading = Array.from(document.querySelectorAll('h1'))
      .find(item => /^Bestelling\s+#\d+/.test(normalize(item.textContent)));
    const match = heading ? normalize(heading.textContent).match(/#(\d+)/) : null;
    return match ? match[1] : null;
  }

  function makeWmsUrl(orderCode) {
    const url = new URL(WMS_SEARCH_URL);
    url.search = new URLSearchParams({ pageSize: '25', sort: 'updated:desc', q: orderCode }).toString();
    return url.href;
  }

  function makeButton(url, templateButton, id = BTN_ID) {
    const a = document.createElement('a');
    a.id = id;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'WMS';

    if (templateButton && templateButton.className) {
      a.className = templateButton.className;
      a.setAttribute('data-slot', templateButton.getAttribute('data-slot') || 'button');
    } else {
      a.className = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow] duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 border border-input bg-background shadow-xs hover:border-border-strong hover:bg-accent hover:text-accent-foreground active:bg-active-overlay h-[var(--component-height-sm)] px-2.5 text-xs justify-center';
      a.setAttribute('data-slot', 'button');
    }

    return a;
  }

  function findWmsOrderActions(card) {
    const orderText = Array.from(card.querySelectorAll('span, div'))
      .find(el => /^Order\s+O\d{4}-\d+/.test(normalize(el.textContent)));
    const orderRow = orderText ? orderText.closest('.flex.items-center.justify-between, .flex.items-start, .p-2\\.5') : null;
    const rowActions = orderRow ? orderRow.querySelector('.ml-3.flex.items-center') : null;
    if (rowActions) return rowActions;

    const actionButton = Array.from(card.querySelectorAll('button'))
      .find(button => normalize(button.textContent).startsWith('Acties'));
    return actionButton ? actionButton.parentElement : null;
  }

  function ensureButton(actions, url, id, before) {
    const existing = document.getElementById(id);
    if (existing && actions.contains(existing)) {
      if (existing.href !== url) existing.href = url;
      return;
    }
    if (existing) existing.remove();

    const button = makeButton(url, actions.querySelector('button'), id);
    actions.insertBefore(button, before);
  }

  function placeButton() {
    if (!/^\/(?:order-management\/|sales\/)?orders\/\d+(?:\/|$)/.test(location.pathname)) {
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(PAGE_BTN_ID)?.remove();
      return;
    }

    ensureStyle();

    const card = getWmsCard();
    const orderCode = card ? getWmsOrderCode(card) : null;
    const hubOrder = getHubOrderNumber();
    const key = hubOrder || orderCode;
    if (!key) return;

    const url = makeWmsUrl(key);
    const pageActions = document.querySelector('[aria-label="Pagina-acties"]');
    const actionButton = pageActions && Array.from(pageActions.querySelectorAll('button'))
      .find(button => normalize(button.textContent) === 'Acties');
    if (actionButton) {
      ensureButton(actionButton.parentElement, url, PAGE_BTN_ID, actionButton.nextSibling);
    }

    const actions = card ? findWmsOrderActions(card) : null;
    if (actions) ensureButton(actions, url, BTN_ID, actions.firstElementChild);
  }

  function init() {
    let tries = 0;
    const interval = setInterval(() => {
      placeButton();
      tries += 1;
      if (tries > 60 && document.getElementById(BTN_ID)) clearInterval(interval);
    }, 250);

    const observer = new MutationObserver(() => placeButton());
    observer.observe(document.body, { childList: true, subtree: true });

    const originalPushState = history.pushState;
    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      setTimeout(placeButton, 400);
      return result;
    };

    window.addEventListener('popstate', () => setTimeout(placeButton, 400));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
