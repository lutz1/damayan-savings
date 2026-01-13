# PayMongo Webhook Debugging Guide

## The Problem

Your logs show:
```
[2026-01-12T23:54:33.268Z] POST /api/paymongo-webhook
```

But deposit isn't being created. This guide helps you figure out **exactly why**.

---

## What to Look For in Render Logs

After making a test deposit, search Render logs for `[paymongo-webhook]`. You should see one of these:

### ✅ SUCCESS Scenario
```
[paymongo-webhook] 🔄 Webhook payload received: {
  "data": {
    "type": "checkout_session.payment.success",
    "attributes": {
      "checkout_session_id": "cs_xxx...",
      "payment_intent": { ... },
      "payments": [ ... ]
    }
  }
}
[paymongo-webhook] Webhook type: checkout_session.payment.success
[paymongo-webhook] 🔍 Looking for metadata with checkoutId: cs_xxx...
[paymongo-webhook] ✅ Metadata found - creating deposit for user: xxx
[paymongo-webhook] ✅ DEPOSIT CREATED - user=xxx amount=₱600 checkoutId=cs_xxx...
```

**Result**: Deposit created! Go check admin panel.

---

### ❌ FAILURE Scenario 1: Wrong Webhook Event Type

```
[paymongo-webhook] 🔄 Webhook payload received: {
  "data": {
    "type": "payment.success",  // <-- WRONG TYPE!
    ...
  }
}
[paymongo-webhook] Webhook type: payment.success
[paymongo-webhook] ℹ️ Ignoring webhook type: payment.success
```

**Problem**: PayMongo is sending a different event type.  
**Solution**: 
1. Go to PayMongo Dashboard → Webhooks
2. Check which events are configured
3. Make sure `checkout_session.payment.success` is selected
4. Disable other events

---

### ❌ FAILURE Scenario 2: Missing Attributes

```
[paymongo-webhook] 🔄 Webhook payload received: {
  "data": {
    "type": "checkout_session.payment.success",
    "attributes": {}  // <-- EMPTY!
  }
}
[paymongo-webhook] Webhook type: checkout_session.payment.success
[paymongo-webhook] ❌ No checkout_session_id in webhook data
[paymongo-webhook] Attributes: {}
```

**Problem**: PayMongo isn't sending `checkout_session_id`.  
**Solution**: Contact PayMongo support or check if webhook is from a different API version.

---

### ❌ FAILURE Scenario 3: Metadata Not Found

```
[paymongo-webhook] 🔄 Webhook payload received: {...}
[paymongo-webhook] Webhook type: checkout_session.payment.success
[paymongo-webhook] 🔍 Looking for metadata with checkoutId: cs_xxx...
[paymongo-webhook] ❌ Payment metadata not found for checkoutId: cs_xxx...
```

**Problem**: The checkoutId from PayMongo doesn't match what was stored.  
**Likely cause**: 
- Checkout session ID changed
- Different environment (test vs live)
- Or metadata wasn't stored

**Solution**:
1. Check if `paymentMetadata` collection has the document
2. Compare checkoutId values
3. Make sure same Firebase project is used

---

### ❌ FAILURE Scenario 4: No Webhook Call at All

**Symptom**: You see nothing in logs about `[paymongo-webhook]`

**Why it happens**:
1. PayMongo isn't calling the webhook (wrong URL)
2. Your backend isn't receiving the request
3. Request is being rejected before reaching your endpoint

**Check list**:
1. Is backend running? (`cd backend && node server.js`)
2. What's your Render URL? (Should be `https://xxx-xxx.onrender.com`)
3. Go to PayMongo Dashboard → Webhooks
4. Is the webhook URL correct?
5. Is the webhook **enabled** (not disabled)?

**How to fix**:
```
Go to PayMongo Dashboard:
1. Developers → Webhooks
2. Find your webhook or create new one
3. Endpoint: https://your-render-url.onrender.com/api/paymongo-webhook
4. Event: checkout_session.payment.success
5. Click Enable / Save
```

---

## Complete Log Examples

### Example 1: First-Time Test (Empty paymentMetadata)

```
[paymongo-webhook] 🔄 Webhook payload received: {...}
[paymongo-webhook] Webhook type: checkout_session.payment.success
[paymongo-webhook] 🔍 Looking for metadata with checkoutId: cs_xxx
[paymongo-webhook] ❌ Payment metadata not found for checkoutId: cs_xxx
```

**What happened**: User completed payment but /api/create-payment-link never ran  
**Solution**: Make sure DepositDialog properly calls the backend before redirecting

---

### Example 2: Backend Gets Request but Can't Parse

```
[paymongo-webhook] ❌ Error: Cannot read property 'checkout_session_id' of undefined
[paymongo-webhook] Stack: Error at Object.<anonymous>...
```

**What happened**: Webhook payload structure is different  
**Solution**: Share the full `Webhook payload received` logs so I can update the parser

---

### Example 3: Successful Scenario

```
[2026-01-13T00:15:30.000Z] POST /api/create-payment-link
Creating PayMongo checkout for user: nCnT38kqijguRWUYCUsVCgTx08D2 amount: 600
PayMongo response status: 200
[paymongo-webhook] 🔄 Webhook payload received: {...full payload...}
[paymongo-webhook] Webhook type: checkout_session.payment.success
[paymongo-webhook] 🔍 Looking for metadata with checkoutId: cs_nUr9zze9zmNRAqo4yc3jwonB
[paymongo-webhook] ✅ Metadata found - creating deposit for user: nCnT38kqijguRWUYCUsVCgTx08D2
[paymongo-webhook] ✅ DEPOSIT CREATED - user=nCnT38kqijguRWUYCUsVCgTx08D2 amount=₱600 checkoutId=cs_nUr9zze9zmNRAqo4yc3jwonB depositId=auto_id_123
```

**Expected next step**: Check Firebase → deposits collection → Find document with that depositId

---

## What to Do When You See an Error

### If Webhook Logs Show ❌ Error

**IMMEDIATELY**:
1. Copy the FULL error log
2. Share it with me
3. Include these details:
   - What amount did you try to deposit?
   - When did you test (what time)?
   - What's your Render URL?
   - Are you on free or paid Render tier?

### If No Webhook Logs at All

**IMMEDIATELY**:
1. Check Render logs have `[paymongo-webhook]` mentioned somewhere
2. If not, check PayMongo Dashboard webhooks configuration
3. Test webhook in PayMongo Dashboard (usually has a "Test" button)
4. Look for PayMongo's test response (should show success or error)

### If You See Both Webhook Success AND Deposit Still Missing

**Then**:
1. Check Firestore → deposits collection
2. Search for document with matching userId
3. Check if `createdAt` timestamp is recent
4. If deposit exists but not in admin panel, it might be a filter issue

---

## Testing Webhook Without Full Deposit

### Using Postman or curl

Test the webhook endpoint directly:

```bash
curl -X POST http://localhost:5000/api/paymongo-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "checkout_session.payment.success",
      "attributes": {
        "checkout_session_id": "cs_test_123"
      }
    }
  }'
```

**Expected response**:
```json
{
  "success": true,
  "message": "Metadata will be created on success page"
}
```

(Response is 200 because metadata doesn't exist in test)

---

## PayMongo Webhook Settings Reference

### Where to Configure

**PayMongo Dashboard**:
1. Click your avatar (top right)
2. Settings → API Keys → Webhooks  
   OR
   Developers → Webhooks

### Required Fields

| Field | Value |
|-------|-------|
| Webhook URL | `https://your-render.onrender.com/api/paymongo-webhook` |
| Event(s) | ✅ `checkout_session.payment.success` |
| Status | ✅ Enabled |
| API Version | Latest (should auto-select) |

### Optional but Helpful

- Add description: "Damayan Savings Deposits"
- Enable test mode: Toggle ON (for testing)
- Enable live mode: Toggle ON (for production)

---

## Quick Decision Tree

```
Is webhook log appearing?
  ├─ YES → Is it saying "DEPOSIT CREATED"?
  │   ├─ YES → ✅ Success! Check admin panel
  │   └─ NO → Share the error log with me
  │
  └─ NO → Is the endpoint configured in PayMongo?
      ├─ Might be wrong URL
      ├─ Might be disabled
      └─ Go to PayMongo Dashboard and verify/update
```

---

## How I Can Help

When debugging, please share:

1. **Render Log Excerpt** (lines containing `[paymongo-webhook]`)
2. **Test Details**:
   - Amount deposited: ₱???
   - Time of test: HH:MM
3. **PayMongo Details**:
   - Your Render URL (if using Render)
   - Webhook endpoint URL you configured
   - Is webhook enabled? (yes/no)

With this info, I can:
- ✅ Update backend to handle different payload structures
- ✅ Fix any parsing errors
- ✅ Ensure deposits appear in admin panel

---

**This is the debugging guide. Share any error logs you see and I'll help fix!**

Last Updated: January 13, 2026
