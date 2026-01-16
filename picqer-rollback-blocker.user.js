// ==UserScript==
// @name         Picqer Annuleerknop verbergen bij rollback
// @namespace    https://github.com/Joeyrrc/TM-Script
// @version      1.0
// @description  Verberg annuleerknop als order al verzonden is (rollback preventie)
// @match        https://rr-commerce.picqer.com/orders/*/cancel
// @updateURL    https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/picqer-rollback-blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/Joeyrrc/TM-Script/main/picqer-rollback-blocker.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('[RollbackBlocker] Script actief');

    function checkForRollbackRisk() {
        const warningText = 'afgeboekte voorraad weer teruggeboekt naar het magazijn';
        const block = document.querySelector('.are-you-sure-block');

        if (!block) return;

        if (block.innerText.toLowerCase().includes(warningText)) {
            console.log('[RollbackBlocker] Rollback risico gedetecteerd. Annuleerknop wordt verborgen.');

            const cancelButton = block.querySelector('a.btn-danger');
            if (cancelButton) {
                cancelButton.style.display = 'none';

                // Waarschuwing tonen
                const alert = document.createElement('div');
                alert.innerHTML = `<span style="font-size: 40px; font-weight: bold;">⚠️</span> Deze order is al verzonden. Annuleren is uitgeschakeld om voorraadfouten te voorkomen.`;
                alert.style.backgroundColor = '#fff3cd';
                alert.style.border = '1px solid #ffeeba';
                alert.style.color = '#856404';
                alert.style.padding = '20px';
                alert.style.marginTop = '20px';
                alert.style.borderRadius = '10px';
                block.appendChild(alert);
            }
        } else {
            console.log('[RollbackBlocker] Geen rollback-risico gevonden. Annuleerknop blijft zichtbaar.');
        }
    }

    window.addEventListener('load', () => {
        setTimeout(checkForRollbackRisk, 100); // kleine delay om zeker te zijn dat DOM klaar is
    });
})();

