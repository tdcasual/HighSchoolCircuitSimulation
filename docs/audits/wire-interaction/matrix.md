# Wire Interaction Audit Matrix

## Dimensions

- Device: `mouse`, `touch`, `pen`
- Transform: `scale 0.5/1/2/4` + `pan center/edge`
- Stage: `start`, `preview`, `release`, `re-drag endpoint`
- Target: `terminal`, `wire-endpoint`, `wire-segment`, `grid`
- Transition: `single->pinch->single`, `pen->mouse`, `long-press->resume wiring`

## Execution Order

1. P0 candidates: zoom-sensitive snap, misconnect on release, stuck drag state
2. P1 candidates: hit-area mismatch, pointer-type threshold drift, highlight/desync
3. P2/P3 candidates: low-frequency cleanup issues and edge transitions

## Matrix Checklist

| Slice ID | Device | Transform | Stage | Target | Transition | Status | Notes |
|---|---|---|---|---|---|---|---|
| M-001 | mouse | scale=1, pan=center | start | terminal | n/a | todo | baseline desktop |
| M-002 | mouse | scale=2, pan=edge | preview | terminal | n/a | todo | zoom-in threshold |
| M-003 | touch | scale=1, pan=center | release | wire-endpoint | single->pinch->single | todo | pinch recovery |
| M-004 | touch | scale=0.5, pan=edge | preview | grid | long-press->resume wiring | todo | long-press conflict |
| M-005 | pen | scale=1, pan=center | re-drag endpoint | terminal | pen->mouse | todo | cross-pointer consistency |
| M-006 | pen | scale=4, pan=edge | preview | wire-endpoint | n/a | todo | high zoom precision |
