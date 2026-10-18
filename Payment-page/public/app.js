(function () {
  'use strict';

  // State
  let currentPlan = {
    name: 'Micro Test Sandbox Plan',
    amount: '10',
    currency: 'INR'
  };
  let currentOrderId = `ORD-${Date.now()}`;
  let isProgrammatic = false;
  let activePollInterval = null;

  // DOM Elements
  const planOptions = document.querySelectorAll('.plan-option');
  const summaryPlanName = document.getElementById('summaryPlanName');
  const summarySubtotal = document.getElementById('summarySubtotal');
  const summaryTotal = document.getElementById('summaryTotal');
  const btnPayLabel = document.getElementById('btnPayLabel');
  const declarativePayBtn = document.getElementById('declarativePayBtn');
  const programmaticPayBtn = document.getElementById('programmaticPayBtn');
  const custNameInput = document.getElementById('custName');
  const custPhoneInput = document.getElementById('custPhone');
  const custEmailInput = document.getElementById('custEmail');
  const btnModeDeclarative = document.getElementById('btnModeDeclarative');
  const btnModeProgrammatic = document.getElementById('btnModeProgrammatic');
  const modeBadge = document.getElementById('modeBadge');
  const terminalLogs = document.getElementById('terminalLogs');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const simulateSmsBtn = document.getElementById('simulateSmsBtn');
  const verificationPanel = document.getElementById('verificationPanel');
  const verifiedOrderId = document.getElementById('verifiedOrderId');
  const verifiedAmount = document.getElementById('verifiedAmount');
  const verifiedUtr = document.getElementById('verifiedUtr');

  // Success Modal Elements
  const paymentSuccessModal = document.getElementById('paymentSuccessModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const btnModalContinue = document.getElementById('btnModalContinue');
  const modalAmountVal = document.getElementById('modalAmountVal');
  const modalHeaderSender = document.getElementById('modalHeaderSender');
  const modalSenderText = document.getElementById('modalSenderText');
  const modalOrderId = document.getElementById('modalOrderId');
  const modalUtr = document.getElementById('modalUtr');
  const modalMethod = document.getElementById('modalMethod');
  const btnCopyUtr = document.getElementById('btnCopyUtr');
  const confettiContainer = document.getElementById('confettiContainer');

  function launchConfetti() {
    if (!confettiContainer) return;
    confettiContainer.innerHTML = '';
    const colors = ['#10b981', '#34d399', '#6366f1', '#a855f7', '#38bdf8', '#f59e0b', '#ec4899'];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      piece.style.animationDuration = `${1.8 + Math.random() * 1.5}s`;
      confettiContainer.appendChild(piece);
    }
  }

  function showPaymentSuccessModal(details = {}) {
    if (!paymentSuccessModal) return;
    const rawAmt = details.amount || currentPlan.amount || '0';
    if (modalAmountVal) modalAmountVal.textContent = parseFloat(rawAmt).toFixed(2);
    if (modalOrderId) modalOrderId.textContent = details.orderId || currentOrderId;
    if (modalUtr) modalUtr.textContent = details.utr || 'Bank Observer Verified';
    if (modalMethod) modalMethod.textContent = details.method || 'UPI Direct (0% Fees)';

    const senderName = details.senderName || details.customerName || (custNameInput ? custNameInput.value.trim() : '') || 'Pushkar Patel';
    if (modalHeaderSender) modalHeaderSender.textContent = senderName;
    if (modalSenderText) modalSenderText.textContent = senderName;

    launchConfetti();
    paymentSuccessModal.style.display = 'flex';
  }

  function hidePaymentSuccessModal() {
    if (paymentSuccessModal) paymentSuccessModal.style.display = 'none';
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hidePaymentSuccessModal);
  if (btnModalContinue) btnModalContinue.addEventListener('click', hidePaymentSuccessModal);
  if (paymentSuccessModal) {
    paymentSuccessModal.addEventListener('click', (e) => {
      if (e.target === paymentSuccessModal) hidePaymentSuccessModal();
    });
  }

  if (btnCopyUtr) {
    btnCopyUtr.addEventListener('click', () => {
      const utr = modalUtr ? modalUtr.textContent : '';
      if (utr && utr !== '-') {
        navigator.clipboard.writeText(utr).then(() => {
          btnCopyUtr.innerHTML = '<span style="color:#34d399;font-size:11px;font-weight:bold;">✓</span>';
          setTimeout(() => {
            btnCopyUtr.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
          }, 1800);
        }).catch(() => {});
      }
    });
  }

  // Terminal logging helper
  function addLog(type, text) {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    line.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="log-text">${escapeHtml(text)}</span>`;
    terminalLogs.appendChild(line);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Update Declarative Button attributes
  function syncDeclarativeButton() {
    currentOrderId = `ORD-${Date.now()}`;
    declarativePayBtn.setAttribute('data-order-id', currentOrderId);
    declarativePayBtn.setAttribute('data-amount', currentPlan.amount);
    declarativePayBtn.setAttribute('data-description', currentPlan.name);
    declarativePayBtn.setAttribute('data-customer-name', custNameInput.value.trim());
    declarativePayBtn.setAttribute('data-customer-phone', custPhoneInput.value.trim());
    declarativePayBtn.setAttribute('data-customer-email', custEmailInput.value.trim());
    declarativePayBtn.setAttribute('data-metadata', JSON.stringify({
      plan: currentPlan.name,
      amount: currentPlan.amount,
      client: 'payment_page_sample'
    }));

    btnPayLabel.textContent = `Pay ₹${currentPlan.amount} via UPI`;
  }

  // Plan Selection
  planOptions.forEach((option) => {
    option.addEventListener('click', () => {
      planOptions.forEach(p => p.classList.remove('active'));
      option.classList.add('active');

      const radio = option.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      currentPlan.amount = option.getAttribute('data-amount');
      currentPlan.name = option.getAttribute('data-name');

      summaryPlanName.textContent = currentPlan.name;
      summarySubtotal.textContent = `₹${currentPlan.amount}.00`;
      summaryTotal.textContent = `₹${currentPlan.amount}.00`;

      syncDeclarativeButton();
      addLog('info', `Selected tier: ${currentPlan.name} (₹${currentPlan.amount})`);
    });
  });

  // Customer Input Syncer
  [custNameInput, custPhoneInput, custEmailInput].forEach((input) => {
    input.addEventListener('input', syncDeclarativeButton);
  });

  // Mode Switcher (Declarative vs Programmatic)
  btnModeDeclarative.addEventListener('click', () => {
    isProgrammatic = false;
    btnModeDeclarative.classList.add('active');
    btnModeProgrammatic.classList.remove('active');
    modeBadge.textContent = 'Declarative Button';
    declarativePayBtn.style.display = 'flex';
    programmaticPayBtn.style.display = 'none';
    addLog('info', 'Switched to Declarative Mode: [data-youpi-pay]');
  });

  btnModeProgrammatic.addEventListener('click', () => {
    isProgrammatic = true;
    btnModeProgrammatic.classList.add('active');
    btnModeDeclarative.classList.remove('active');
    modeBadge.textContent = 'Programmatic API';
    declarativePayBtn.style.display = 'none';
    programmaticPayBtn.style.display = 'flex';
    addLog('info', 'Switched to Programmatic Mode: Youpi.pay({...})');
  });

  // Programmatic Pay Trigger
  programmaticPayBtn.addEventListener('click', async () => {
    if (typeof window.Youpi === 'undefined' || typeof window.Youpi.pay !== 'function') {
      addLog('error', 'YOUPI PG SDK (youpi.js) is not loaded! Make sure port 7000 is running.');
      alert('YOUPI PG SDK (youpi.js) is not loaded. Please start the gateway services via `npm run dev` in the main repository.');
      return;
    }

    try {
      addLog('info', 'Pre-registering order in merchant backend (/api/orders/create)...');
      
      const orderRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: currentPlan.amount,
          items: [{ name: currentPlan.name, price: currentPlan.amount, qty: 1 }],
          customer: {
            name: custNameInput.value.trim(),
            phone: custPhoneInput.value.trim(),
            email: custEmailInput.value.trim()
          }
        })
      });
      const orderData = await orderRes.json();
      currentOrderId = orderData.orderId;
      addLog('info', `Order created in merchant DB: ${currentOrderId}`);

      window._youpiMarkExpired = startWebhookPolling(currentOrderId);

      addLog('info', 'Invoking Youpi.pay() programmatic modal launcher...');
      window.Youpi.pay({
        order_id: currentOrderId,
        amount: parseFloat(currentPlan.amount),
        currency: 'INR',
        name: 'Apex Cloud',
        description: currentPlan.name,
        customer: {
          name: custNameInput.value.trim(),
          phone: custPhoneInput.value.trim(),
          email: custEmailInput.value.trim()
        },
        metadata: {
          plan: currentPlan.name,
          checkoutMode: 'programmatic'
        },
        handler: function (response) {
          addLog('event', `[Youpi.pay handler] Status: ${response.status}, UTR: ${response.utr || 'Pending verification'}`);
          if (response.status === 'SUCCESS') {
            showPaymentSuccessModal({
              orderId: response.order_id || currentOrderId,
              amount: response.amount_received || currentPlan.amount,
              utr: response.utr,
              method: response.payment_mode || 'UPI'
            });
          }
        },
        onFailed: function (err) {
          addLog('error', `[Youpi.pay onFailed] Payment failed: ${err.reason || err.message}`);
        },
        onClose: function () {
          addLog('info', '[Youpi.pay onClose] Customer closed modal.');
        }
      });
    } catch (err) {
      addLog('error', `Error launching payment: ${err.message}`);
    }
  });

  // Listen to Click on Declarative button to initiate polling and launch modal
  declarativePayBtn.addEventListener('click', async () => {
    syncDeclarativeButton();
    addLog('info', `Triggered [data-youpi-pay] for order ${currentOrderId} (₹${currentPlan.amount})`);

    if (!window.Youpi) {
      addLog('error', 'YOUPI PG SDK (http://localhost:7000/youpi.js) is not loaded. Please ensure gateway services are running!');
      alert('The YOUPI Payment Gateway is starting up on http://localhost:7000.\nPlease refresh the page in a few seconds!');
      return;
    }

    try {
      await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrderId,
          amount: currentPlan.amount,
          items: [{ name: currentPlan.name, price: currentPlan.amount, qty: 1 }],
          customer: {
            name: custNameInput.value.trim(),
            phone: custPhoneInput.value.trim(),
            email: custEmailInput.value.trim()
          }
        })
      });
    } catch {}

    window._youpiMarkExpired = startWebhookPolling(currentOrderId);

    // Guaranteed direct launch
    if (window.Youpi && typeof window.Youpi.handleButtonClick === 'function') {
      window.Youpi.handleButtonClick(declarativePayBtn);
    }
  });

  // Normalized DOM Event Listeners emitted by youpi.js
  window.addEventListener('youpi:payment:success', (e) => {
    const d = e.detail || {};
    addLog('success', `[Browser Event: youpi:payment:success] Order ${d.order_id} verified! Amount: ₹${d.amount_received}, UTR: ${d.utr}`);
    
    // Auto-dismiss youpi iframe backdrop to ensure clean modal reveal
    const ypBackdrop = document.querySelector('.youpi-checkout-backdrop');
    if (ypBackdrop) ypBackdrop.style.display = 'none';

    showPaymentSuccessModal({
      orderId: d.order_id || currentOrderId,
      amount: d.amount_received || currentPlan.amount,
      utr: d.utr,
      senderName: d.sender_name || (d.metadata && d.metadata.customerName) || custNameInput.value.trim() || 'Pushkar Patel',
      method: d.payment_mode || 'UPI'
    });
  });

  window.addEventListener('youpi:payment:failed', (e) => {
    const d = e.detail || {};
    addLog('error', `[Browser Event: youpi:payment:failed] Order ${d.order_id} failed: ${d.reason || 'declined'}`);
  });

  window.addEventListener('youpi:payment:expired', (e) => {
    const d = e.detail || {};
    addLog('error', `[Browser Event: youpi:payment:expired] Payment window expired for order ${d.order_id}`);
    addLog('info', `⏳ [LATE RECOVERY ACTIVE] Still watching for delayed SMS confirmation up to 10 minutes...`);

    // Show a subtle banner so user knows we're still watching
    const existing = document.getElementById('youpiExpiryBanner');
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'youpiExpiryBanner';
      banner.style.cssText = [
        'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(30,30,40,0.95)', 'color:#f59e0b',
        'border:1px solid rgba(245,158,11,0.4)', 'border-radius:12px',
        'padding:12px 20px', 'font-size:13px', 'font-family:sans-serif',
        'z-index:2147483640', 'text-align:center', 'backdrop-filter:blur(10px)',
        'box-shadow:0 4px 24px rgba(0,0,0,0.5)', 'max-width:340px'
      ].join(';');
      banner.innerHTML = '⏳ <strong>QR Expired</strong> — Still watching for delayed bank SMS&hellip;<br><span style="font-size:11px;opacity:0.7;">This will auto-dismiss if payment is confirmed</span>';
      document.body.appendChild(banner);
    }

    // Signal the poller that we're in late-recovery mode
    if (typeof window._youpiMarkExpired === 'function') {
      window._youpiMarkExpired();
    }
  });

  window.addEventListener('youpi:payment:cancelled', (e) => {
    const d = e.detail || {};
    addLog('info', `[Browser Event: youpi:payment:cancelled] Checkout cancelled by customer for order ${d.order_id}`);
  });

  window.addEventListener('youpi:payment:result', (e) => {
    const d = e.detail || {};
    addLog('event', `[Browser Event: youpi:payment:result] Result: ${d.status} for order ${d.order_id}`);
  });

  // Webhook Polling for Authoritative Server Confirmation
  // Continues even after checkout modal expires — catches delayed-SMS bank recoveries
  function startWebhookPolling(orderId) {
    if (activePollInterval) clearInterval(activePollInterval);

    addLog('info', `Started backend webhook watcher for order ${orderId}...`);

    let checks = 0;
    let isExpired = false;
    const MAX_CHECKS = 300; // 10 minutes at 2s intervals

    activePollInterval = setInterval(async () => {
      checks++;
      if (checks > MAX_CHECKS) {
        clearInterval(activePollInterval);
        addLog('info', `Polling stopped for order ${orderId} after 10 minutes.`);
        return;
      }

      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === 'PAID' && data.verifiedViaWebhook) {
          clearInterval(activePollInterval);

          if (isExpired) {
            addLog('webhook', `⚡ [LATE SMS RECOVERY] Order ${orderId} resurrected from EXPIRED → PAID via delayed bank SMS!`);
          } else {
            addLog('webhook', `🔥 [WEBHOOK VERIFIED] Order ${orderId} authoritatively PAID via HMAC-SHA256 signature!`);
          }
          addLog('success', `🎉 Bank Reference UTR: ${data.utr} (Amount: ₹${data.amount})`);

          // Dismiss any expiry banner
          const expiryBanner = document.getElementById('youpiExpiryBanner');
          if (expiryBanner) expiryBanner.remove();

          // Show Verification Panel
          verificationPanel.style.display = 'flex';
          verifiedOrderId.textContent = data.orderId;
          verifiedAmount.textContent = `₹${data.amount}`;
          verifiedUtr.textContent = data.utr;

          // Auto-dismiss youpi iframe backdrop to ensure clean modal reveal
          const ypBackdrop = document.querySelector('.youpi-checkout-backdrop');
          if (ypBackdrop) ypBackdrop.style.display = 'none';

          // Trigger Success Popup Modal
          showPaymentSuccessModal({
            orderId: data.orderId,
            amount: data.amount,
            utr: data.utr,
            senderName: data.senderName || (data.customer && data.customer.name) || custNameInput.value.trim() || 'Pushkar Patel',
            method: data.paymentMethod || 'UPI'
          });
        }
      } catch (err) {
        // Polling error, ignore
      }
    }, 2000);

    // Return a function to signal expiry without stopping the poll
    return function markExpired() { isExpired = true; };
  }

  // Developer Simulator: Simulate Bank SMS Credit
  simulateSmsBtn.addEventListener('click', async () => {
    addLog('info', `Simulating incoming bank SMS for ₹${currentPlan.amount}...`);
    simulateSmsBtn.disabled = true;
    simulateSmsBtn.textContent = 'Simulating...';

    try {
      const res = await fetch('/api/dev/simulate-bank-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: currentPlan.amount
        })
      });
      const data = await res.json();
      if (data.success) {
        addLog('success', 'Simulated SMS transmitted to Gateway Observer intake!');
        addLog('info', `SMS text: "${data.simulatedSms}"`);
      } else {
        addLog('error', `Simulation failed: ${data.error || 'Gateway returned error'}`);
      }
    } catch (err) {
      addLog('error', `Simulator network error: ${err.message}. Is payment-api running on port 6100?`);
    } finally {
      simulateSmsBtn.disabled = false;
      simulateSmsBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Simulate Bank Credit
      `;
    }
  });

  // Clear Logs
  clearLogsBtn.addEventListener('click', () => {
    terminalLogs.innerHTML = '';
    addLog('info', 'Terminal logs cleared.');
  });

  // Gateway Connection Checker
  const statusLabel = document.getElementById('statusLabel');
  const statusDot = document.getElementById('statusDot');
  const gatewayStatusPill = document.getElementById('gatewayStatusPill');

  function checkGatewayStatus() {
    if (window.Youpi) {
      if (statusLabel) statusLabel.textContent = 'YOUPI PG Connected';
      if (statusDot) statusDot.style.backgroundColor = '#10b981';
      if (gatewayStatusPill) {
        gatewayStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        gatewayStatusPill.style.color = '#34d399';
      }
    } else {
      if (statusLabel) statusLabel.textContent = 'Gateway Offline (Port 7000)';
      if (statusDot) statusDot.style.backgroundColor = '#ef4444';
      if (gatewayStatusPill) {
        gatewayStatusPill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        gatewayStatusPill.style.color = '#f87171';
      }
    }
  }

  // Initialize
  syncDeclarativeButton();
  checkGatewayStatus();
  setTimeout(checkGatewayStatus, 800);
  setTimeout(checkGatewayStatus, 2500);
  addLog('info', 'Apex Cloud merchant frontend initialized.');
})();
