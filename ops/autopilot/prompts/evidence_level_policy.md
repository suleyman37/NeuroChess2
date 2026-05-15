# Evidence Level Policy

## Level 0 - No ChatGPT

Use when checks pass, paths are exact, no alarms exist, and the task is green/docs-only.

## Level 1 - Supervisor Digest

Use by default when a supervisor call is needed. Send only the compact digest.

## Level 2 - Targeted Evidence

Future use only in A4A. Intended for one specific missing proof such as a failing
test excerpt, screenshot, route audit snippet, or rejected prompt reason.

## Level 3 - Full Evidence Pack

Future use only in A4A. Intended for red-tier or repeated-failure review.

## A4A Boundary

A4A implements the Level 0/1 policy and builder only. It does not implement
REQUEST_MORE, Gemini, retro every 5 missions, or autonomous product execution.
