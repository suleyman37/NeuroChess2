# Strict Chessboard Fidelity Gate

A visual board stage can be atmospheric, but the chessboard is not decoration.
The player must be able to read the position immediately, without trusting
labels, smoke-test measurements, or the surrounding HUD.

Hard rules:

- the board must read as a true 8x8 chess grid;
- square dimensions must appear uniform;
- the board must be top-down or near top-down;
- perspective must not harm chess reading;
- pieces must be immediately readable;
- decorative artifacts must not enter the playing surface;
- board overlays must have clear pedagogical meaning;
- the board must remain readable at 1366, 1440, and 1920 when available;
- the board must remain understandable without debug labels.

If any hard rule fails, the result is `BLOCK_CHESS_FIDELITY`. A Gemini
`PASS_VISUAL`, autonomous `AUTO_PASS_DESIGN`, or browser-smoke layout pass is
then overridden. Browser geometry can prove that a board is centered; it cannot
prove that the position is product-grade readable.

This gate is stricter than earlier DEV-only prototype gates. A prototype may
still be useful while failing this gate, but it cannot be treated as
product-grade NeuroChess direction.
