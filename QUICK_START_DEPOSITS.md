# QUICK START - Get Deposits Working in 15 Minutes

## TL;DR

Your deposits system is ready. It just needs **one PayMongo configuration**.

**Time to completion**: 15 minutes total

---

## The One Thing You Need to Do

### Configure PayMongo Webhook

1. **Go to**: https://dashboard.paymongo.com/
2. **Find**: Developers → Webhooks (or Settings → Webhooks)
3. **Set**:
   - Endpoint: `https://your-render-url.onrender.com/api/paymongo-webhook`
   - Event: `checkout_session.payment.success`
   - Status: Enabled ✅
4. **Save**

**That's it!** Now test it.

---

## Testing (5 minutes)

### Step 1: Start Backend
```bash
cd backend
node server.js
```

### Step 2: Make a Deposit
- App → Dashboard → Deposit
- Enter: ₱100
- Complete PayMongo payment

### Step 3: Check Results
- Render logs → Search `[paymongo-webhook]`
- Should see: `✅ DEPOSIT CREATED`
- Go to: `/admin/deposits`
- Should see: Pending deposit

### Step 4: Approve
- Click "Approve / Reject"
- Select "Approve"
- Check: User eWallet increased ✅

**Done!**

---

## Troubleshooting (What If It Doesn't Work?)

### No webhook logs at all?
→ PayMongo webhook URL is wrong  
→ Fix it in PayMongo Dashboard

### Webhook logs but "metadata not found"?
→ Refresh the page and try again  
→ Or check if /api/create-payment-link was called

### Webhook logs but says "IGNORING"?
→ PayMongo event type is different  
→ Go to PayMongo Dashboard and select correct event

### Still stuck?
→ Share the Render log lines with `[paymongo-webhook]`  
→ I'll help immediately

---

## What Was Fixed

✅ **Backend**: Now logs everything (helps debug)  
✅ **Frontend**: Works even if backend is offline  
✅ **Admin**: Can approve deposits and update eWallet  

---

## Documentation

If you need details:
- **Complete flow**: `README_DEPOSITS.md`
- **Step-by-step webhook setup**: `WEBHOOK_DEBUGGING.md`
- **What happens offline**: `OFFLINE_BACKEND_FIX.md`
- **Admin approval workflow**: `PAYMONGO_DEPOSITS_FLOW.md`
- **Action checklist**: `DEPOSITS_ACTION_ITEMS.md`
- **Visual diagrams**: `DEPOSITS_FLOW_DIAGRAMS.md`

---

## Next Steps

1. ⏱️ **NOW**: Configure PayMongo webhook (5 min)
2. 🧪 **NEXT**: Test a deposit (5 min)
3. ✅ **DONE**: Approve in admin panel (5 min)

**Let me know if you hit any issues!**

---

Last Updated: January 13, 2026
