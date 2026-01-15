// ==UserScript==
// @name         Picqer knop naar de Hub (bij orders)
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Plaats Portal-knop links van de Bewerk-knop in de Klant-card op Picqer orderpagina's
// @match        https://*.picqer.com/*
// @match        https://app.picqer.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  const BTN_ID = 'rrc-portal-btn-picqer';
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
        margin-right:12px;
      }
      #${BTN_ID}:hover{
        background:${BLUE_HOVER} !important;
      }
    `;
    document.head.appendChild(style);
  }

  // vind ordernummer uit "Referentie" regel (ondersteunt oude én nieuwe HTML-structuur)
  function findOrderFromReference() {
    // NIEUWE structuur: <div class="data-list-item"><dt>Referentie</dt><dd>hoesjesdirect.nl #4080526</dd></div>
    const newRows = document.querySelectorAll('.data-list-item');
    for (const row of newRows) {
      const label = row.querySelector('dt');
      const value = row.querySelector('dd');
      if (!label || !value) continue;
      if (label.textContent.trim().toLowerCase() === 'referentie') {
        const match = value.textContent.match(/#(\d{5,})/);
        if (match) return match[1];
      }
    }

    // OUDE structuur (fallback): .data-list__item met .data-list__item__label en .data-list__item__value
    const oldRows = document.querySelectorAll('.card-section .data-list .data-list__item');
    for (const row of oldRows) {
      const label = row.querySelector('.data-list__item__label');
      const value = row.querySelector('.data-list__item__value');
      if (!label || !value) continue;
      if (label.textContent.trim().toLowerCase() === 'referentie') {
        const match = value.textContent.match(/#(\d{5,})/);
        if (match) return match[1];
      }
    }

    return null;
  }

  // vind de "Klant" card-header en Bewerk-knop
  function findKlantHeader() {
    const headers = document.querySelectorAll('.card-header');
    for (const h of headers) {
      const heading = h.querySelector('.card-heading');
      if (heading && heading.textContent.trim().toLowerCase() === 'klant') {
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

    // plaats knop links van Bewerk
    if (editBtn && editBtn.parentNode) {
      editBtn.parentNode.insertBefore(btn, editBtn);
    } else {
      header.appendChild(btn);
    }

    lastOrder = order;
    console.debug('[TM][Picqer] Portal-knop geplaatst in Klant-card →', url);
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
