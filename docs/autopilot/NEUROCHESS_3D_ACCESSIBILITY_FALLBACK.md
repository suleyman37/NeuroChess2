# NeuroChess 3D Accessibility And Fallback

3D must be optional from a learning standpoint. Critical information cannot be
encoded only in a 3D effect.

Required fallback modes:

- reduced motion;
- disable postprocessing;
- high contrast mode;
- 2D-only board fallback;
- low-quality 3D mode;
- keyboard-first navigation;
- stable focus outline;
- no critical information carried only by particles, color, depth, or motion.

If the 3D renderer fails:

- the chessboard remains usable;
- the primary action remains visible;
- the learning state remains understandable;
- a screenshot captures the fallback;
- the branch does not count as visually strong until fallback proof exists.

Accessibility is not an afterthought. It is how the system proves the 3D serves
the chess decision rather than replacing it.
