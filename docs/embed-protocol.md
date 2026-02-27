# HSCS Embed Protocol

## Channel

- `channel`: `HSCS_EMBED_V1`
- `apiVersion`: `1`
- Transport: `window.postMessage`

## Message Shapes

### Host -> Viewer (request)

```json
{
  "channel": "HSCS_EMBED_V1",
  "apiVersion": 1,
  "type": "request",
  "id": "hscs_1700000000000_1",
  "method": "run",
  "payload": {}
}
```

### Viewer -> Host (response)

```json
{
  "channel": "HSCS_EMBED_V1",
  "apiVersion": 1,
  "type": "response",
  "id": "hscs_1700000000000_1",
  "method": "run",
  "ok": true,
  "payload": {
    "isRunning": true
  }
}
```

Error response:

```json
{
  "channel": "HSCS_EMBED_V1",
  "apiVersion": 1,
  "type": "response",
  "id": "hscs_1700000000000_1",
  "method": "loadCircuit",
  "ok": false,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "loadCircuit payload.circuit is required",
    "details": null
  }
}
```

### Viewer -> Host (event)

```json
{
  "channel": "HSCS_EMBED_V1",
  "apiVersion": 1,
  "type": "event",
  "method": "ready",
  "payload": {
    "state": {
      "mode": "classroom"
    }
  }
}
```

## Methods

- `ping`
- `getState`
- `setOptions`
- `setClassroomMode`
- `setReadonly`
- `run`
- `stop`
- `clearCircuit`
- `loadCircuit`
- `exportCircuit`

## Security Recommendations

- Host should pass `targetOrigin` (parent origin) and avoid `*`.
- Viewer should configure `allowedOrigins` when possible.
- Host should reject messages from origins other than embed runtime origin.
