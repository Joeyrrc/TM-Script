// ==UserScript==
// @name         Zendesk Portal Knop (in app sidebar)
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.2
// @description  Plaats portal-knop naast ordernummer in de Webshop Orders app (iframe)
// @match        https://rrcommerce.zendesk.com/*
// @match        https://*.apps.zdusercontent.com/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/zendesk-portal-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/zendesk-portal-button.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'rrc-portal-btn';
  const BASE_URL = 'https://hub.rrcommerce.nl/open-order/';
  // Vind ordernummer uit de H1 van de app (met #)
  function findHeaderAndOrder() {
    const h1 = document.querySelector('h1.flex') || document.querySelector('h1');
    if (!h1) return null;

    // Zoek het <a> met de tekst "#1234567"
    const a = h1.querySelector('a');
    const txt = (a ? a.textContent : h1.textContent) || '';
    const m = txt.match(/#(\d{6,})\b/); // minimaal 6 cijfers
    if (!m) return null;

    const badge = h1.querySelector('.badge') || h1.querySelector('[class*="badge"]');
    return { h1, anchor: a || h1, badge, order: m[1] };
  }

  function makeBtn(url) {
    const btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.href = url;
    btn.target = '_blank';
    btn.textContent = 'Hub';
    Object.assign(btn.style, {
      marginLeft: '8px',
      marginRight: '8px',
      padding: '4px 10px',
      background: '#007BDB',
      color: '#fff',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: '600',
      lineHeight: '18px',
      display: 'inline-flex',
      alignItems: 'center',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    });
    return btn;
  }

  let lastOrder = null;

  function placeButton() {
    const found = findHeaderAndOrder();
    if (!found) return;

    const { h1, anchor, badge, order } = found;
    if (document.getElementById(BTN_ID) && lastOrder === order) return;

    // vervang oude voor ander ticket
    const old = document.getElementById(BTN_ID);
    if (old && lastOrder !== order) old.remove();

    const url = `${BASE_URL}/${order}`;
    const btn = makeBtn(url);

    // Plaatsing: vóór de badge als die bestaat, anders direct achter de anchor
    if (badge) {
      badge.parentNode.insertBefore(btn, badge);
    } else if (anchor && anchor.insertAdjacentElement) {
      anchor.insertAdjacentElement('afterend', btn);
    } else {
      h1.appendChild(btn);
    }

    lastOrder = order;
    console.debug('[TM] Portal-knop geplaatst in app:', order, url);
  }

  // Wacht tot er een H1 in beeld is
  function waitForAppHeader(timeout = 20000) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('h1')) return resolve();
      const mo = new MutationObserver(() => {
        if (document.querySelector('h1')) { mo.disconnect(); resolve(); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { mo.disconnect(); reject(new Error('no h1')); }, timeout);
    });
  }

  (async () => {
    try {
      await waitForAppHeader();
      // Eerste snelle pogingen
      let tries = 0;
      const iv = setInterval(() => {
        placeButton();
        if (++tries > 30 || document.getElementById(BTN_ID)) clearInterval(iv);
      }, 250);

      // Observeer updates (app herlaadt content vaak)
      const mo = new MutationObserver(() => placeButton());
      mo.observe(document.body, { childList: true, subtree: true });

      // Reageer op SPA navigatie in de hoofdapp
      const _push = history.pushState;
      history.pushState = function () {
        const r = _push.apply(this, arguments);
        setTimeout(placeButton, 400);
        return r;
      };
      window.addEventListener('popstate', () => setTimeout(placeButton, 400));
    } catch (e) {
      console.warn('[TM] init fail', e);
    }
  })();
})();