# Strategic Pulse Review

## 1. Purpose

Strategic Pulse Review asks whether the current direction still serves NeuroChess. It is not a normal mission retro and it is not a product task.

The core question is:

```text
Given recent results, does the current direction still serve NeuroChess?
```

## 2. Axes

Each pulse reviews four axes:
- Product Progress
- Automation Friction
- Risk Exposure
- Strategic Coherence

## 3. Decisions

A pulse returns exactly one decision:
- `CONTINUE`
- `NARROW`
- `SPLIT`
- `PIVOT`
- `HARDEN`
- `RETURN_TO_PRODUCT`
- `QUARANTINE`
- `STOP`

The most important escape hatch is `RETURN_TO_PRODUCT`. Automation exists to serve NeuroChess, not to become the product.

## 4. Triggers

Normal Pulse:
- every 3 successful micro-missions.

Deep Pulse:
- every 9 successful micro-missions.

Emergency Pulse:
- 2 consecutive failures;
- Prompt Firewall rejects twice;
- REQUEST_MORE repeats more than allowed;
- ChatGPT bridge instability;
- task exceeds timebox;
- diff too large;
- scope larger than expected;
- unexpected red-tier risk;
- road-to-V2 safety issue;
- inconsistent checks.

## 5. Relationship To Product Direction

Strategic Pulse can recommend product work when the automation safety stack is strong enough. It can also recommend hardening when friction or risk is too high.

A pulse does not execute the next mission. It records a strategic decision and one next best move.
