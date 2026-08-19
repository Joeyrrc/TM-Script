// ==UserScript==
// @name         WMS Hub knop bij producten
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      2.0
// @description  Voeg een Hub-knop toe aan de productnavigatie in WMS
// @match        https://wms.rrcommerce.nl/products/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/hub-knop-bij-producten.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/hub-knop-bij-producten.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'rrc-hub-pill';
  const BASE_URL = 'https://hub.rrcommerce.nl/products';

  function normalize(text) {
    return (text || '').trim().toLowerCase();
  }

  function cleanSku(text) {
    const raw = (text || '').trim();
    const m = raw.match(/([A-Za-z0-9][A-Za-z0-9._-]+)/);
    return m ? m[1] : null;
  }

  function extractSku() {
    // Oude Picqer fallback.
    const skuDiv = document.querySelector('div[title="Productcode"]');
    if (skuDiv) {
      const textNode = Array.from(skuDiv.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      const sku = cleanSku(textNode ? textNode.textContent : skuDiv.textContent);
      if (sku) return sku;
    }

    // Nieuwe WMS-structuur: <dt>Productcode</dt><dd>1-0122624</dd>
    const labels = document.querySelectorAll('dt');
    for (const label of labels) {
      if (normalize(label.textContent) !== 'productcode') continue;

      const value = label.parentElement ? label.parentElement.querySelector('dd') : null;
      const sku = value ? cleanSku(value.textContent) : null;
      if (sku) return sku;
    }

    // Header fallback: "1-0122624 · 4894240122624 · 0 op voorraad"
    const headerMeta = document.querySelector('.wms-product-detail-page h1 + * span, .wms-product-detail-page [class*="text-muted-foreground"] span');
    if (headerMeta) {
      const sku = cleanSku(headerMeta.textContent.split('·')[0]);
      if (sku) return sku;
    }

    return null;
  }

  function findProductNavigation() {
    return (
      document.querySelector('.wms-product-detail-tabs [data-slot="tabs-list"]') ||
      document.querySelector('[aria-label="Detailnavigatie"]') ||
      document.querySelector('ul.pills')
    );
  }

  function makeButton(url, templateLink) {
    const a = document.createElement('a');
    a.id = BTN_ID;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Hub';

    if (templateLink) {
      a.className = templateLink.className;
      a.setAttribute('data-slot', templateLink.getAttribute('data-slot') || 'tabs-trigger');
    }

    return a;
  }

  let lastSku = null;

  function placeButton() {
    const nav = findProductNavigation();
    if (!nav) return;

    const existing = document.getElementById(BTN_ID);

    const sku = extractSku();
    if (!sku) return;

    if (existing && lastSku === sku) return;
    if (existing && lastSku !== sku) existing.remove();

    const hubUrl = `${BASE_URL}/${encodeURIComponent(sku)}`;

    // Zoek het 'Inkopen'-element in oude en nieuwe navigatie.
    const links = Array.from(nav.querySelectorAll('a'));
    const inkopenLink = links.find(a => normalize(a.textContent) === 'inkopen');
    const button = makeButton(hubUrl, inkopenLink || links[links.length - 1]);

    if (inkopenLink && inkopenLink.parentElement) {
      inkopenLink.insertAdjacentElement('afterend', button);
    } else {
      nav.appendChild(button);
    }

    lastSku = sku;
    console.debug('[TM][Product] Hub-knop toegevoegd aan productnavigatie ->', hubUrl);
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
