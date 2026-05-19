# Decision Packet Protocol

Tracked files:

- `ops/autopilot/decision_packet.schema.json`
- `ops/autopilot/normalize_external_decision_packet.ps1`

Decision Packets are the only format NeuroRelay passes from external or local reasoning into Mission Auction.

Required fields:

- source
- packet_type
- confidence
- recommended_action
- do_not_do
- candidate_mission
- evidence_used
- open_risks
- token_saving_notes

Valid sources:

- `chatgpt_web`
- `gemini`
- `local_fallback`
- `mission_doctor`

Normalizer behavior:

- accepts raw text or structured JSON;
- extracts or constructs a packet;
- rejects vague praise;
- rejects missing action;
- rejects bypass, credential, CAPTCHA, 2FA, consent, or road-push actions;
- rejects candidates that allow forbidden paths;
- redacts private URLs and secret-shaped strings.

Invalid external responses become `INVALID_PACKET`; the loop continues through local fallback.
