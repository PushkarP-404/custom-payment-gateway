import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if exists
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env:', e.message);
}

const PORT = Number(process.env.PORT || 4000);
const YOUPI_CHECKOUT_HOST = process.env.SYNAPSE_CHECKOUT_HOST || process.env.YOUPI_CHECKOUT_HOST || 'http://localhost:7000';
const YOUPI_GATEWAY_API = process.env.SYNAPSE_GATEWAY_API || process.env.YOUPI_GATEWAY_API || 'http://localhost:6100';
const YOUPI_MERCHANT_KEY = process.env.SYNAPSE_MERCHANT_KEY || process.env.YOUPI_MERCHANT_KEY || '00000000-0000-0000-0000-000000000001';
const YOUPI_WEBHOOK_SECRET = process.env.SYNAPSE_WEBHOOK_SECRET || process.env.YOUPI_WEBHOOK_SECRET || 'merchant_webhook_secret_for_wallet_store';

const app = express();

// In-memory persistence for demonstration
const orders = new Map();
const webhookLogs = [];

// CRITICAL: Webhook handler MUST receive raw unparsed bytes to verify HMAC-SHA256 signature
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'] || '';
  const deliveryId = req.headers['x-gateway-delivery-id'] || '';
  const eventHeader = req.headers['x-gateway-event'] || '';
  const timestamp = req.headers['x-gateway-timestamp'] || Date.now();

  console.log('\n====================================================');
  console.log('🔔 [WEBHOOK RECEIVED] Incoming server-to-server webhook');
  console.log(`• Delivery ID: ${deliveryId}`);
  console.log(`• Event Header: ${eventHeader}`);
  console.log(`• Signature: ${signature}`);

  if (!signature) {
    console.error('❌ Missing X-Gateway-Signature header');
    return res.status(401).json({ error: 'Missing signature header' });
  }

  // Calculate expected HMAC-SHA256 on raw body buffer
  const expected = 'sha256=' + crypto.createHmac('sha256', YOUPI_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    console.error('❌ HMAC Signature Verification Failed!');
    console.error(`  Expected: ${expected}`);
    console.error(`  Received: ${signature}`);
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  console.log('✅ HMAC-SHA256 Signature Authenticated Successfully!');

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    console.error('❌ Failed to parse webhook JSON:', err.message);
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }

  console.log('📦 Webhook Payload:', JSON.stringify(payload, null, 2));

  // Authoritative Order Status Update
  const { event, orderId, utr, amount, amountPaise, completedAt, method } = payload;
  const senderName = payload.senderName || payload.metadata?.senderName || payload.metadata?.customerName || payload.metadata?.customer?.name || payload.customer?.name || null;
  
  if (orderId && orders.has(orderId)) {
    const existing = orders.get(orderId);
    existing.status = event === 'SUCCESS' ? 'PAID' : (event || 'FAILED');
    existing.utr = utr || existing.utr;
    existing.completedAt = completedAt || new Date().toISOString();
    existing.paymentMethod = method || 'UPI';
    existing.senderName = senderName || existing.senderName || existing.customer?.name || 'Verified Payer';
    existing.verifiedViaWebhook = true;
    orders.set(orderId, existing);
    console.log(`🎉 [ORDER UPDATED] ${orderId} marked as ${existing.status} (UTR: ${existing.utr}, Payer: ${existing.senderName})`);
  } else if (orderId) {
    // Record order even if initiated without pre-creation
    orders.set(orderId, {
      orderId,
      amount: amount || '0.00',
      status: event === 'SUCCESS' ? 'PAID' : (event || 'FAILED'),
      utr: utr || '',
      senderName: senderName || 'Verified Payer',
      completedAt: completedAt || new Date().toISOString(),
      paymentMethod: method || 'UPI',
      verifiedViaWebhook: true
    });
  }

  // Record in webhook log for live UI inspection
  webhookLogs.unshift({
    deliveryId,
    event,
    orderId,
    amount,
    utr,
    method,
    completedAt,
    verifiedAt: new Date().toISOString(),
    rawSignature: signature
  });

  if (webhookLogs.length > 50) webhookLogs.pop();

  return res.status(200).json({ received: true, verified: true });
});

// JSON parser for regular API routes
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API: Get merchant gateway configuration
app.get('/api/config', (req, res) => {
  res.json({
    merchantKey: YOUPI_MERCHANT_KEY,
    checkoutHost: YOUPI_CHECKOUT_HOST,
    gatewayApi: YOUPI_GATEWAY_API,
    currency: 'INR'
  });
});

// API: Create an order in merchant database
app.post('/api/orders/create', (req, res) => {
  const { items = [], amount, customer = {}, orderId: reqOrderId } = req.body;
  const orderId = reqOrderId || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const order = {
    orderId,
    amount: parseFloat(amount || 499).toFixed(2),
    currency: 'INR',
    items,
    customer,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  orders.set(orderId, order);
  console.log(`🛒 [NEW ORDER CREATED] ${orderId} for ₹${order.amount}`);
  res.status(201).json(order);
});

// API: Check single order status (polled by customer or frontend)
app.get('/api/orders/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) {
    return res.json({
      orderId: req.params.orderId,
      status: 'PENDING',
      verifiedViaWebhook: false
    });
  }
  res.json(order);
});

// API: List recent orders
app.get('/api/orders', (req, res) => {
  const list = Array.from(orders.values()).reverse();
  res.json(list.slice(0, 20));
});

// API: Get recent verified webhooks
app.get('/api/webhooks', (req, res) => {
  res.json(webhookLogs.slice(0, 10));
});

// API: Dev Helper to trigger a bank observation for easy local testing
app.post('/api/dev/simulate-bank-credit', async (req, res) => {
  const { amount, utr, receivingAccountId } = req.body;
  const targetAmount = parseFloat(amount || 10).toFixed(2);
  const fakeUtr = utr || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
  
  let accId = receivingAccountId;
  if (!accId) {
    try {
      const accRes = await fetch(`${YOUPI_GATEWAY_API}/api/v1/admin/upi-accounts`);
      if (accRes.ok) {
        const accData = await accRes.json();
        const active = (accData.accounts || []).find(a => a.isActive);
        if (active) accId = active.id;
      }
    } catch {}
  }
  if (!accId) accId = '1df91122-5f92-4ef6-87ec-fb46720c9ef2';

  const smsText = `Dear Customer, your account has been credited with INR ${targetAmount} on ${new Date().toLocaleDateString('en-GB')} via UPI from customer@okhdfcbank. Ref/UTR: ${fakeUtr}. Available balance: INR 25,480.00 - HDFCBK`;

  try {
    const response = await fetch(`${YOUPI_GATEWAY_API}/api/v1/pollers/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receivingAccountId: accId,
        source: 'SMS',
        sender: 'HDFCBK',
        text: smsText,
        amountPaise: Math.round(parseFloat(targetAmount) * 100),
        bankReferenceNumber: fakeUtr,
        observedAt: new Date().toISOString()
      })
    });

    const result = await response.json();
    console.log('🤖 Simulated Bank SMS Sent:', smsText);
    console.log('   Gateway Response:', result);
    return res.json({ success: true, simulatedSms: smsText, gatewayResponse: result });
  } catch (err) {
    console.error('Failed to trigger simulated observer:', err.message);
    return res.status(500).json({ error: 'Failed to contact Gateway API', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🌐 Synapse Payment Website is running!`);
  console.log(`👉 Visit: http://localhost:${PORT}`);
  console.log(`🔗 Checkout Host:  ${YOUPI_CHECKOUT_HOST}`);
  console.log(`🔑 Merchant Key:   ${YOUPI_MERCHANT_KEY}`);
  console.log(`📬 Webhook URL:    http://localhost:${PORT}/api/webhook`);
  console.log('====================================================\n');
});
