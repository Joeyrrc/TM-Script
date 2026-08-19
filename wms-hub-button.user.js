// ==UserScript==
// @name         WMS knop naar de Hub (bij orders)
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      2.1
// @description  Plaats Hub-knop links van de Bewerk-knop in de Klant-card op WMS orderpagina's
// @match        https://wms.rrcommerce.nl/orders/*
// @match        https://wms.rrcommerce.nl/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/wms-hub-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/wms-hub-button.user.js
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  const BTN_ID = 'rrc-portal-btn-wms';
  const BASE_URL = 'https://hub.rrcommerce.nl/open-order';
  const BLUE = '#0096FF';
  const BLUE_HOVER = '#007BDB';

  function ensureStyle() {
    if (document.getElementById('rrc-portal-style')) return;
    const style = document.createElement('style');
    style.id = 'rrc-portal-style';
    style.textContent = `
      #${BTN_ID}{
        background:${BLUE};
        color:#fff;
        padding:6px 14px;
        border-radius:14px;
        font-size:14px;
        font-weight:600;
        line-height:20px;
        display:inline-flex;
        align-items:center;
        text-decoration:none;
        white-space:nowrap;
        vertical-align:middle;
        transition:background .2s ease;
        margin-right:0;
      }
      #${BTN_ID}:hover{
        background:${BLUE_HOVER} !important;
      }
      .rrc-wms-hub-actions{
        display:inline-flex;
        align-items:center;
        gap:8px;
        margin-left:auto;
      }
    `;
    document.head.appendChild(style);
  }

  function normalize(text) {
    return (text || '').trim().toLowerCase();
  }

  function getReferenceOrder(value) {
    const match = (value || '').match(/#\s*(\d{5,})/);
    return match ? match[1] : null;
  }

  // vind ordernummer uit "Referentie" regel (ondersteunt Picqer én het nieuwe WMS)
  function findOrderFromReference() {
    // Nieuwe WMS-structuur: <dt>Referentie</dt><dd>huellendirekt.de #4474985</dd>
    const definitionTerms = document.querySelectorAll('dt');
    for (const label of definitionTerms) {
      if (normalize(label.textContent) !== 'referentie') continue;
      const row = label.parentElement;
      const value = row ? row.querySelector('dd') : null;
      const order = value ? getReferenceOrder(value.textContent) : null;
      if (order) return order;
    }

    // Picqer structuur: <div class="data-list-item"><dt>Referentie</dt><dd>hoesjesdirect.nl #4080526</dd></div>
    const newRows = document.querySelectorAll('.data-list-item');
    for (const row of newRows) {
      const label = row.querySelector('dt');
      const value = row.querySelector('dd');
      if (!label || !value) continue;
      if (normalize(label.textContent) === 'referentie') {
        const order = getReferenceOrder(value.textContent);
        if (order) return order;
      }
    }

    // OUDE structuur (fallback): .data-list__item met .data-list__item__label en .data-list__item__value
    const oldRows = document.querySelectorAll('.card-section .data-list .data-list__item');
    for (const row of oldRows) {
      const label = row.querySelector('.data-list__item__label');
      const value = row.querySelector('.data-list__item__value');
      if (!label || !value) continue;
      if (normalize(label.textContent) === 'referentie') {
        const order = getReferenceOrder(value.textContent);
        if (order) return order;
      }
    }

    return null;
  }

  // vind de "Klant" card-header en Bewerk-knop
  function findKlantHeader() {
    const headings = document.querySelectorAll('h2, .card-heading');
    for (const heading of headings) {
      if (normalize(heading.textContent) !== 'klant') continue;

      const card = heading.closest('[data-slot="card"], .card');
      const header =
        heading.closest('.card-header') ||
        heading.closest('[class*="border-b"]') ||
        heading.parentElement;

      if (!header) continue;

      const editBtn =
        header.querySelector('button, a') ||
        (card ? card.querySelector('button, a') : null);

      return { header, editBtn };
    }

    const headers = document.querySelectorAll('.card-header');
    for (const h of headers) {
      const heading = h.querySelector('.card-heading');
      if (heading && normalize(heading.textContent) === 'klant') {
        const editBtn = h.querySelector('button, a');
        return { header: h, editBtn };
      }
    }
    return null;
  }

  function makeBtn(url) {
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.href = url;
    a.target = '_blank';
    a.textContent = 'Hub';
    return a;
  }

  function placeButtonNextToEdit(header, editBtn, btn) {
    if (!editBtn || !editBtn.parentNode) {
      header.appendChild(btn);
      return;
    }

    const currentGroup = editBtn.closest('.rrc-wms-hub-actions');
    if (currentGroup) {
      currentGroup.insertBefore(btn, editBtn);
      return;
    }

    const actions = document.createElement('div');
    actions.className = 'rrc-wms-hub-actions';

    editBtn.parentNode.insertBefore(actions, editBtn);
    actions.appendChild(btn);
    actions.appendChild(editBtn);
  }

  let lastOrder = null;

  function placeButton() {
    ensureStyle();
    const order = findOrderFromReference();
    const klant = findKlantHeader();

    if (!order || !klant) return;

    const { header, editBtn } = klant;
    const existing = document.getElementById(BTN_ID);

    if (existing && lastOrder === order) return;
    if (existing && lastOrder !== order) existing.remove();

    const url = `${BASE_URL}/${order}`;
    const btn = makeBtn(url);

    // Plaats Hub en Bewerk samen rechts in de header.
    placeButtonNextToEdit(header, editBtn, btn);

    lastOrder = order;
    console.debug('[TM][WMS] Hub-knop geplaatst in Klant-card ->', url);
  }

  // observer setup
  function init() {
    let tries = 0;
    const iv = setInterval(() => {
      placeButton();
      if (++tries > 40 || document.getElementById(BTN_ID)) clearInterval(iv);
    }, 250);

    const mo = new MutationObserver(() => placeButton());
    mo.observe(document.body, { childList: true, subtree: true });

    const _push = history.pushState;
    history.pushState = function () {
      const r = _push.apply(this, arguments);
      setTimeout(placeButton, 400);
      return r;
    };

    window.addEventListener('popstate', () => setTimeout(placeButton, 400));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
