# Render Monitoring Setup (amayan-savings backend)

This backend now exposes monitoring-friendly signals:

- Health endpoint: `/health`
- Readiness endpoint: `/health/ready`
- Structured JSON logs for every request (`http_request_start`, `http_request_end`)
- Structured transaction logs (`transaction_event`) for transfer/deposit-related operations
- `x-request-id` propagation (returned in response headers)
- Process crash visibility (`unhandled_rejection`, `uncaught_exception`)

## 1) Configure Render Health Check

In Render service settings:

- **Health Check Path:** `/health/ready`
- **Auto Deploy:** enabled (recommended)

`/health/ready` verifies Firestore connectivity and returns `503` if not ready.

## 2) Add Monitoring Alerts in Render

Recommended alerts:

- **Deploy failed**
- **Service unavailable / health check failing**
- **High error rate** (if available on your Render plan)
- **Instance restarts / crashes**

## 3) Use Request IDs for Traceability

Every request now gets a request id:

- Incoming `x-request-id` is reused if provided.
- Otherwise server generates one.
- Response includes `x-request-id` header.

When debugging user issues, capture `x-request-id` and search Render logs by that id.

## 4) Log Events You Can Filter in Render

Structured events include:

- `server_started`
- `http_request_start`
- `http_request_end`
- `transaction_event`
- `readiness_check_failed`
- `unhandled_rejection`
- `uncaught_exception`

`transaction_event` is emitted for key money flows like:

- wallet transfer
- deposit create/verify
- referral reward transfer
- override reward transfer
- passive income transfer
- profit/capital share transfer
- add payback/capital share entries

In Render Logs, filter for `"event":"transaction_event"` to view only financial activity.

Each log line includes:

- `service`, `env`, `ts`
- `requestId` (when request-scoped)
- `path`, `statusCode`, `durationMs` (request completion)

## 5) Optional: External Monitoring

If you connect Render logs to a log platform (Datadog, Better Stack, etc.), create dashboards for:

- p95/p99 request latency (`durationMs`)
- 5xx count by route (`path`, `statusCode`)
- top slow endpoints
- crash events (`uncaught_exception`, `unhandled_rejection`)

## 6) Quick Verification

After deploy, verify:

- `GET /health` returns `200` with uptime metadata
- `GET /health/ready` returns `200` and `firestore: "ok"`
- Render logs show JSON entries for request start/end
