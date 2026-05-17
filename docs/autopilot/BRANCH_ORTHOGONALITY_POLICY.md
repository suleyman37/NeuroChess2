# Branch Orthogonality Policy

A long run can produce useful branches that are still painful the next morning if they all touched the same files. Branch orthogonality keeps product branches reviewable by checking planned writes before starting new work.

## Merge Risk

Multiple `READY_TO_REVIEW` branches that edit the same files can turn into merge hell: reviewers must reconstruct intent, resolve conflicts, and decide which branch owns the product direction. This is especially risky when a long run creates backend and frontend branches in parallel.

## File Locks

Every product branch should declare planned write paths from Shadow Plan before work begins. The Global File Mutability Lock records active planned and actual writes per branch. A new mission checks its planned writes against active locks before creating a branch.

## Decisions

- `CONTINUE`: no overlap.
- `REJECT_MISSION`: overlap is unnecessary or low value.
- `STACK_ON_PREVIOUS_BRANCH`: overlap is intentional and explicitly depends on a safe previous branch.
- `QUARANTINE_REQUIRED`: overlap touches sensitive/red-tier files or branch state is unclear.

Product code remains off `road-to-V2`; overlapping work must never be merged directly to the base branch by automation.
