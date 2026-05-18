# Screenshot-To-Patch Loop

This loop turns visual evidence into a bounded patch plan. It prevents visual
missions from becoming endless CSS tweaking.

## Loop

1. Generate screenshots.
2. Build visual evidence packet.
3. Run hard gates.
4. Run the Visual Debate Protocol.
5. Extract the top 10 defects.
6. Split fixes into delete-first, reshape, and add-ambition fixes.
7. Produce three patch plans.
8. Select one patch by Creative Director verdict.
9. Apply patch in a new branch.
10. Regenerate screenshots.
11. Compare delta.
12. Stop if there is no meaningful improvement.

## Rules

- max three generations per visual mission;
- if generation two does not improve, stop;
- do not keep adding elements to fix weak design;
- delete generic noise before adding ambition;
- never compromise board fidelity;
- never add pre-feedback hints;
- record rejected ideas;
- report whether the system behaved intelligently or merely busily.

## Quality Levels

- `GENERATION_0_BASELINE`
- `GENERATION_1_PROMISING`
- `GENERATION_2_STRONG`
- `GENERATION_3_FINAL_CANDIDATE`
- `STAGNATED_STOP`
- `ABANDON_DIRECTION`

## Patch Types

Delete-first fixes remove:

- generic panels;
- debug labels;
- random glow;
- board-adjacent noise;
- unclear secondary CTAs.

Reshape fixes improve:

- composition;
- hierarchy;
- piece identity;
- state legibility;
- product framing.

Add-ambition fixes add:

- meaningful stage identity;
- motion tied to state;
- richer surrounding world;
- post-feedback pedagogy.
