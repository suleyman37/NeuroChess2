# ChatGPT Chrome Profile Locks

The ChatGPT Web bridge uses a dedicated Chrome profile:

```text
C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile
```

That profile must not be open manually while the bridge controls it. Use a
normal Chrome profile for manual ChatGPT discussion, and reserve the supervisor
profile for automation.

Chrome can keep a profile locked even after the visible window is closed. The
usual cause is a background `chrome.exe` process whose command line still
contains the supervisor profile path.

## Check Only

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/close_chatgpt_profile_processes.ps1
```

This reports only. It does not stop any process.

## Close Only The Supervisor Profile

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/close_chatgpt_profile_processes.ps1 -ForceClose
```

This stops only `chrome.exe` processes whose command line contains the exact
supervisor profile path. It must not kill all Chrome processes.

## Bridge Behavior

Before live send, `ask_chatgpt_web.ps1` checks the profile lock using CIM
`Win32_Process` command line inspection.

If the profile is locked:

- it does not launch Playwright/Chrome;
- it does not send anything to ChatGPT;
- it writes a STOP-style report;
- it tells the operator to close the profile or run the helper command.

To let the bridge close matching processes itself, pass the explicit flag:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/ask_chatgpt_web.ps1 -Live -CloseProfileProcesses
```

## Rerun A1

1. Run the cleanup helper with `-ForceClose`.
2. Re-run the A1 live bridge smoke.
3. A2 remains blocked until A1 receives a nonce-bound STOP response and extracts
   `LIVE_BRIDGE_SMOKE_TEST_OK`.
