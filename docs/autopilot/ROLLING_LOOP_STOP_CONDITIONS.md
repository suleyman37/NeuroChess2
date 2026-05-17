# Rolling Loop Stop Conditions

The Rolling Loop Controller stops before execution when a deterministic gate
fails.

Stop reasons include Mission Contract mismatch, Shadow Plan mismatch, Prompt
Firewall or NC-MP/2 lint failure, Product Gate failure, repeated low-value
signals, repeated mission hash, no forward progress, Goldilocks rejection,
red-tier scope, Night Mode scope rejection, quarantine phase, rollover due,
bridge failure, or an empty mission queue.

Repeat-hash and no-progress stops are local loop protections. They prevent the
system from spending time on duplicate work or sterile proposals.

Rollover is also dry-run only in A18. The controller may emit
`ROLLOVER_REQUIRED`, but it does not create or switch any live project session.

Skills remain procedures, not permissions. They cannot override Control Plane
stop conditions.
