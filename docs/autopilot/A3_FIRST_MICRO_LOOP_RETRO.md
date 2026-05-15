# A3 - First Micro-Loop Retro

## 1. What A2 Proved

- ChatGPT Web can provide a valid nonce-bound MICRO_PROMPT.
- Prompt Firewall can validate it.
- Codex can execute exactly one docs-only mission.
- Codex can create one allowed file.
- Checks can pass.
- Codex can commit/push safely.
- Codex can stop instead of continuing.

## 2. What A2 Did Not Prove

- no multi-step autonomy yet;
- no UI mission yet;
- no backend read-only mission yet;
- no red-tier mission yet;
- no Practice implementation;
- no due_at/Daily Plan/training mutation;
- no Gemini visual judge;
- no local GPU critic active in the decision loop;
- no retro every 5 missions yet.

## 3. Risks Observed

- browser bridge is functional but still UI-fragile;
- ChatGPT Web may change UI/selectors;
- too-large prompts remain a risk;
- no REQUEST_MORE mechanism yet;
- evidence packs may become too large;
- no automatic retro loop yet;
- product risk remains around Practice/due_at/training_items.

## 4. Next Automation Hardening Recommendation

Recommended next automation mission:
A4_SUPERVISOR_DIGEST_REQUEST_MORE_AND_RETRO_EVERY_5

A4 should add:
- compact Supervisor Digest by default;
- REQUEST_MORE protocol;
- Full Evidence Pack only when needed;
- Retro every 5 missions;
- one improvement max per retro;
- no product mission execution.

## 5. Not Recommended Yet

Defer:
- R3I implementation;
- multi-step autonomous product loop;
- red-tier Practice work;
- Gemini integration;
- PC2 critic integration into promotion decisions;
- long scheduler autonomous runs.

## 6. GO / NO-GO

GO:
- A4 automation hardening docs/scripts.

NO-GO:
- R3I product implementation before A4 or a dedicated R3I contract.
- More than one autonomous product mission at a time.
- Any red-tier auto-push.
