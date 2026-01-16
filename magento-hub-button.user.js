// ==UserScript==
// @name         Magento knop naar de Hub (bij orders)
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.0
// @description  Plaats een Hub-knop naast het ordernummer in Magento orders
// @match        https://*/sales/order/view/*
// @match        https://*/*/sales/order/view/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/magento-hub-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/magento-hub-button.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'rrc-portal-btn-magento';
  const STYLE_ID = 'rrc-portal-style-magento';
  const BASE_URL = 'https://hub.rrcommerce.nl/open-order';
  const BLUE = '#0096FF';
  const BLUE_HOVER = '#007BDB';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Zorg dat titel en knop netjes naast elkaar staan */
      .page-title-wrapper{
        display:flex;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
      }
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
      }
      #${BTN_ID}:hover{
        background:${BLUE_HOVER} !important;
      }
    `;
    document.head.appendChild(style);
  }

  function readOrderNumber() {
    const h1 = document.querySelector('.page-title-wrapper h1.page-title');
    if (!h1) return null;
    const txt = h1.textContent.trim();
    // Pak alles na het # (cijfers); voorbeeld: "#3902255"
    const m = txt.match(/#\s*([0-9]+)/);
    return m ? m[1] : null;
  }

  function findWrapperAndTitle() {
    const wrapper = document.querySelector('.page-title-wrapper');
    if (!wrapper) return null;
    const title = wrapper.querySelector('h1.page-title');
    if (!title) return null;
    return { wrapper, title };
  }

  function makeBtn(url) {
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Hub';
    return a;
  }

  let lastOrder = null;

  function placeButton() {
    ensureStyle();

    const ctx = findWrapperAndTitle();
    const order = readOrderNumber();
    if (!ctx || !order) return;

    const { wrapper, title } = ctx;

    // Bestaan er al knoppen? Houd rekening met navigatie tussen orders
    const existing = document.getElementById(BTN_ID);
    if (existing && lastOrder === order) return;
    if (existing && lastOrder !== order) existing.remove();

    const url = `${BASE_URL}/${order}`;
    const btn = makeBtn(url);

    // Knop naast het ordernummer, in dezelfde div
    // Plaats als sibling na de H1
    if (title.nextSibling) {
      title.parentNode.insertBefore(btn, title.nextSibling);
    } else {
      wrapper.appendChild(btn);
    }

    lastOrder = order;
    console.debug('[TM][Magento] Hub-knop geplaatst naast order →', url);
  }

  function init() {
    // Probeer snel achter elkaar (voor dynamische loads)
    let tries = 0;
    const iv = setInterval(() => {
      placeButton();
      if (++tries > 40 || document.getElementById(BTN_ID)) clearInterval(iv);
    }, 250);

    // Observeer DOM-wijzigingen
    const mo = new MutationObserver(() => placeButton());
    mo.observe(document.body, { childList: true, subtree: true });

    // Intercept SPA navigatie
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