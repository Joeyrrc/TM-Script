// ==UserScript==
// @name         Hub knop Bij producten
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.3
// @description  Voeg een knop toe naar de hub in de productnavigatie
// @match        https://*.picqer.com/*
// @match        https://app.picqer.com/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/hub-knop-bij-producten.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/hub-knop-bij-producten.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'rrc-hub-pill';
  const BASE_URL = 'https://hub.rrcommerce.nl/inventory/products';

  function extractSku() {
    // SKU staat in div[title="Productcode"]
    const skuDiv = document.querySelector('div[title="Productcode"]');
    if (!skuDiv) return null;

    const textNode = Array.from(skuDiv.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    const raw = (textNode ? textNode.textContent : skuDiv.textContent).trim();
    const m = raw.match(/([A-Za-z0-9][A-Za-z0-9._-]+)/);
    return m ? m[1] : null;
  }

  function findPillsUl() {
    return document.querySelector('ul.pills');
  }

  function makeLi(url) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.href = url;
    a.target = '_blank';
    a.textContent = 'Hub';
    li.appendChild(a);
    return li;
  }

  function placeButton() {
    const ul = findPillsUl();
    if (!ul) return;

    const existing = document.getElementById(BTN_ID);
    if (existing) return;

    const sku = extractSku();
    if (!sku) return;

    const hubUrl = `${BASE_URL}/${encodeURIComponent(sku)}`;
    const li = makeLi(hubUrl);

    // Zoek het 'Inkopen'-element
    const links = Array.from(ul.querySelectorAll('li > a'));
    const inkopenLink = links.find(a => a.textContent.trim().toLowerCase() === 'inkopen');

    if (inkopenLink && inkopenLink.parentElement) {
      inkopenLink.parentElement.insertAdjacentElement('afterend', li);
    } else {
      // fallback: gewoon aan het einde
      ul.appendChild(li);
    }

    console.debug('[TM][Product] Hub-knop toegevoegd aan pills →', hubUrl);
  }

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