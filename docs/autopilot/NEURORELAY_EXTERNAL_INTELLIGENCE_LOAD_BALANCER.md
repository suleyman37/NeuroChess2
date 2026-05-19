# NeuroRelay External Intelligence Load Balancer

NeuroRelay is the A20AO intelligence-routing layer above the A20AN autonomous conductor.

Purpose:

- make Codex the executor, verifier, and integrator;
- use ChatGPT Web as optional strategic supervisor when available;
- use Gemini as optional visual perception critic when visual evidence exists;
- keep local fallback deterministic and always available;
- compress context before any external or Codex-facing handoff;
- pass Codex short patch contracts instead of giant mission prompts.

Tracked entrypoint:

- `ops/autopilot/run_neurorelay_loop.ps1`

Core flow:

1. Build a context capsule.
2. Normalize local or external output into Decision Packets.
3. Run Mission Auction.
4. Build one Codex Patch Contract.
5. Run Mission Doctor.
6. Update Protocol Memory.
7. Continue or park blocked lanes without user intervention.

Live lanes:

- ChatGPT Web: optional, strategic supervisor.
- Gemini: optional, visual critic when screenshots or visual evidence exist.
- Local fallback: mandatory and always available.

If ChatGPT Web or Gemini is unavailable, NeuroRelay records the lane as parked and continues offline. It must not ask READY, wait for auth, ask for private URLs, ask for passwords, or block the loop.
