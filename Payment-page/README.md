# Apex Cloud Merchant Store — YOUPI PG Integration

This is a complete, self-contained reference Node.js website demonstrating how to integrate the **YOUPI Payment Gateway (YOUPI PG)** into any external web application.

---

## 🏗️ Architecture & Component Flow

```mermaid
flowchart LR
    subgraph MerchantStore["Your Website (Payment-page)"]
        Browser["Customer Browser<br/>(http://localhost:4000)"]
        Server["Store Backend<br/>(server.js - Port 4000)"]
    end

    subgraph YoupiGateway["YOUPI PG Services (Root Repo)"]
        CheckoutPortal["Checkout Portal (Port 7000)<br/>Serves youpi.js & iframe modal"]
        PaymentAPI["Payment REST API (Port 6100)<br/>State machine & SQLite WAL"]
    end

    subgraph ObservationMesh["Banking Observers"]
        SMSObs["SMS / Android Observer<br/>Detects Bank Credit"]
    end

    Browser -->|1. Loads youpi.js & clicks Pay| CheckoutPortal
    CheckoutPortal -->|2. Renders Dynamic Vector QR| Browser
    Browser -->|3. Customer pays via UPI App| ObservationMesh
    ObservationMesh -->|4. Observes bank credit| PaymentAPI
    PaymentAPI -->|5. Transitions session to SUCCESS| PaymentAPI
    PaymentAPI -->|6. POST /api/webhook (HMAC-SHA256)| Server
    Server -->|7. Authoritative Order Paid Update| Browser
```

---

## 🚀 How to Run the Complete Stack

### Step 1: Start the Gateway (Root Repo)
Open a terminal in the root folder (`Payment-website`):
```powershell
npm run dev
```
This automatically spins up:
- **Payment Core REST API**: `http://localhost:6100`
- **Checkout Portal (serves youpi.js)**: `http://localhost:7000`
- **Merchant Admin Panel**: `http://localhost:6001`
- **Supervisor Control Center**: `http://localhost:8090`

### Step 2: Start the Merchant Website
Open a second terminal in the `Payment-page` directory:
```powershell
npm start
```
Your store is now live at **`http://localhost:4000`**!

---

## 💡 Key Code Components & Integration Reference

### 1. Universal Frontend Script Inclusion
In [public/index.html](public/index.html):
```html
<script 
  id="youpi-script" 
  src="http://localhost:7000/youpi.js" 
  data-youpi-key="00000000-0000-0000-0000-000000000001">
</script>
```

### 2. Zero-JS Declarative Button
Add `data-youpi-pay` to any button:
```html
<button 
  data-youpi-pay 
  data-order-id="ORD-1001" 
  data-amount="299"
  data-currency="INR"
  data-name="Apex Cloud"
  data-customer-name="Rahul Sharma"
  data-customer-phone="9876543210"
  data-customer-email="rahul@example.com">
  Pay ₹299 via UPI
</button>
```

### 3. Programmatic JavaScript API
For React, Vue, Svelte, or dynamic single-page applications:
```javascript
Youpi.pay({
  order_id: "ORD-1001",
  amount: 299.00,
  currency: "INR",
  customer: {
    name: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@example.com"
  },
  handler: function(response) {
    console.log("Payment Confirmed in Modal:", response);
  },
  onClose: function() {
    console.log("Customer closed the checkout modal");
  }
});
```

### 4. Authoritative HMAC-SHA256 Server Webhook Listener
In [server.js](server.js):
> **CRITICAL**: Use unparsed raw request bytes (`express.raw({ type: 'application/json' })`) before computing HMAC-SHA256.

```javascript
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'] || '';
  const secret = process.env.YOUPI_WEBHOOK_SECRET;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  if (payload.event === 'SUCCESS') {
    // Authoritatively mark order as PAID in your database
    db.orders.markPaid(payload.orderId, { utr: payload.utr, amount: payload.amount });
  }

  res.status(200).json({ received: true });
});
```

---

## 🧪 Testing Payments & Webhook Verification

1. Go to `http://localhost:4000` in your browser.
2. Select any tier (e.g., ₹299 or ₹499).
3. Click **"Pay via UPI"** to launch the popup checkout modal.
4. To test observer verification without a physical banking phone, click **"Simulate Bank Credit"** in the on-screen terminal.
5. The gateway will match the credit amount, transition the session to `SUCCESS`, and dispatch the signed webhook to `http://localhost:4000/api/webhook`.
6. Watch the terminal turn green with the Bank UTR and authoritative badge!
