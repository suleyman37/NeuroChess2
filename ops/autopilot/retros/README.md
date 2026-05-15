# Autopilot Retros

## Purpose

Retros capture what the AgentOS loop has actually proven, what remains unproven, and the smallest useful hardening step to add next.

## Cadence

Run a retro every 5 promoted missions, or earlier when a new automation capability is proven for the first time.

## Rule

Each retro may recommend at most one hardening improvement. Keep the improvement small enough to validate in one controlled mission.

## Evidence Required

Each retro should reference:
- mission ids or commit hashes;
- checks that passed or failed;
- Prompt Firewall or critic results when relevant;
- artifact paths when useful;
- final git status.

## Scope

Retro improvements must stay automation-focused unless a product mission is explicitly planned and separately gated. Do not smuggle product scope into retro follow-ups.
