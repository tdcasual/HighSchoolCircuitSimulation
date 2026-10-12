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

Leaving readonly without the `unfreeze` capability:

```json
{
  "channel": "HSCS_EMBED_V1",
  "apiVersion": 1,
  "type": "error",
  "id": "req-1",
  "error": {
    "code": "CAPABILITY_DENIED",
    "message": "unfreeze capability is required"
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

- Host SDK defaults `parentOrigin` to `window.location.origin` and never `*`.
- Empty allowlists or `*` disable the bridge: no `message` listener and no `postMessage`.
- Leaving readonly requires `?capabilities=unfreeze`. Failure code is `CAPABILITY_DENIED`.
- Host should reject messages from origins other than embed runtime origin.
