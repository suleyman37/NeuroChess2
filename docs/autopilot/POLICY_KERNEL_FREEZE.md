# Policy Kernel Freeze

The Policy Kernel is the set of files that define non-negotiable long-run safety. It includes red-tier and quarantine policy, Mission Contract, Shadow Plan, Prompt Firewall, NC-MP/2 linting, Product-Safe Night Mode, Goldilocks, Control Plane state authority, Night Mode phase policy, bridge availability, human verification guard, product intelligence gate, and the internal safety skills.

## Manifest

`ops/autopilot/build_policy_kernel_manifest.ps1` reads `ops/autopilot/long_run_safety_policy.yaml`, hashes each kernel file, and writes a manifest with path, hash, size, modified time, and existence state.

## Freeze Check

`ops/autopilot/check_policy_kernel_freeze.ps1` compares the current manifest to a baseline. Added, missing, or changed kernel files produce:

```json
{
  "kernel_result": "STOP_POLICY_KERNEL_CHANGED",
  "recommended_action": "STOP"
}
```

## Long-Run Rule

During A20.5/A21, the run must stop before changing its own guardrails. No in-flight meta-fix may weaken red-tier rules, Mission Contract, Shadow Plan, Product-Safe Night Mode, Goldilocks, or bridge safety.
