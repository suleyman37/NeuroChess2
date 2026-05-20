# Gemini Upload Adapters

A20BE adds a no-user-intervention second pass for Gemini Web visual upload.

The lane is allowed to use only the isolated Gemini browser profile and CDP port
9223. It does not call Gemini API, OpenAI API, paid services, or billing flows.

## Adapter Order

1. Native file input: find `input[type=file]`, attach one isolated screenshot,
   then verify an attachment preview or visible upload state.
2. Attachment button plus file chooser: click only a visible upload/image/attach
   control and use Playwright's file chooser.
3. Drag/drop: only when a clear current drop zone is visible.
4. Clipboard paste: only when safe clipboard restoration and visible attachment
   proof are available.
5. Text-only fallback: if no upload path works, Gemini remains text-only and no
   visual Decision Packet is claimed.

The prompt is never sent until attachment confirmation is present.

## Evidence Rules

Primary visual evidence must be a single isolated screenshot. Contact sheets,
pairwise sheets, mosaics, thumbnails, and multi-up images are rejected for the
primary visual packet.

Every real verdict writes external-only artifacts under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_web_lane\A20BE_gemini_upload_second_pass_20260518`

These artifacts are not committed.

## Statuses

- `GEMINI_VISUAL_PACKET_READY`: screenshot attached, prompt sent, JSON visual
  packet normalized.
- `GEMINI_AVAILABLE_TEXT_ONLY_UPLOAD_UNAVAILABLE_DIAGNOSED`: Gemini is usable
  for text but all safe upload adapters failed with diagnostics.
- `GEMINI_AUTH_OR_ACCOUNT_ACTION_REQUIRED_PARKED`: page or account state needs
  manual action; Codex parks the lane and continues offline.
- `GEMINI_UPLOAD_SECOND_PASS_PARTIAL`: bounded probe produced usable evidence
  but not enough for visual-ready status.
