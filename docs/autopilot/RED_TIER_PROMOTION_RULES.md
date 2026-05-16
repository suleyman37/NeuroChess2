# Red-Tier Promotion Rules

## 1. Default

Red-tier promotion to `road-to-V2` is blocked by default.

The standard branch promotion script must refuse:
- branches beginning with `quarantine/`;
- branches beginning with `auto/red-`;
- any red-tier branch without a later dedicated approval path.

## 2. Required Before Any Future Promotion

A future red-tier promotion mission must prove:
- quarantine branch was used;
- no direct work happened on `road-to-V2`;
- evidence pack is complete;
- DB snapshot before and after are present;
- DB mutation report is present;
- route inventory is present when routes are touched;
- side-effect inventory is present;
- rollback plan is present;
- checks pass;
- supervisor or human review explicitly approves promotion.

## 3. Hard Prohibitions

Red-tier promotion must never:
- create merge commits automatically;
- force push;
- use `git add -A`;
- push directly from a red-tier path to `road-to-V2`;
- promote with missing evidence;
- promote with unresolved side-effect risk.

## 4. Future Dedicated Mission

If a red-tier branch ever needs promotion, create a separate mission for that promotion only. The promotion mission must verify evidence, review, rollback, and exact file scope before any merge.
