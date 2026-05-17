# Safe Process And Port Registry

The process and port registry prevents "clean Git, dirty machine" surprises without unsafe cleanup.

## Registered PIDs Only

Automation must register processes it starts. The checker inspects registered PIDs only. It does not scan for every `node`, `python`, or `chrome` process and does not terminate anything.

Runtime process registry:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\process_registry.jsonl
```

## Ports

The default configured ports are:

- `3000`
- `5173`
- `8000`
- `8080`

Missions may add ports to the runtime policy. The checker reports occupied configured ports and, when safe, the owning PID/name. It never kills the owner.

## Future Cleanup

`cleanup_policy` may say `terminate_if_registered`, but A20B remains report-only. Any terminating cleanup needs a dedicated future mission and must still avoid global process kills.
