---
name: simulation-display-protocol
description: Makes any build (website, web app, PWA, iOS, Android, Windows/macOS desktop, CLI, API, browser extension) runnable, viewable, and hands-on testable by the founder, with an evidence pack and a feedback loop. Use whenever the founder needs to see, try, or approve what was built.
---

# Simulation and Display Protocol

**Version 1.0 · 2026-10-24 · Engine-agnostic (Claude Code, Antigravity, Cursor, Codex, or any agent) · Companion to the AI-Assisted Development Playbook v2.1**

**Purpose.** The founder must be able to see how the product looks and behaves, try it with his own hands on the real target, and say what to change — at every milestone, without reading code. This protocol tells the building agent how to make that happen for each kind of deliverable.

**How to use it.** Put this file in the repository root (or install it as a skill). Reference it from the agent instruction file (`AGENTS.md`, `CLAUDE.md`, or the engine's rules). The agent reads it when it starts a project, when it reaches a milestone, and whenever the founder asks to see something. It produces `PREVIEW.md`, one-command preview scripts, an evidence pack per milestone, and a test script — all described below.

---

## 1. What the founder gets at every milestone

| Deliverable | What it is | Why |
|---|---|---|
| **One command** | A single command, documented in `PREVIEW.md`, that runs the product on the founder's machine from a clean checkout | He can try it himself without setup archaeology |
| **A real-target path** | A link, test build, or install step to try it on the actual target (phone, desktop OS, browser) | Emulators and screenshots are not the product |
| **An evidence pack** | Screenshots, short recordings, traces, and reports captured by the agent from the actual build | He can review without running anything, from any device |
| **A test script** | Numbered journeys with demo accounts, data, and expected results | Hands-on testing is structured, not random clicking |
| **A feedback path** | A fixed format for his notes, which the agent turns into units with acceptance criteria | Feedback becomes work, not chat history |

---

## 2. Principles

1. **Detect the host and the targets first.** Record the founder's host OS and version, available runtimes and SDKs, and what the host cannot do (for example, a Windows host cannot run the iOS Simulator or build macOS apps). Read the target platforms and devices from `PRODUCT.md`/`CONSTRAINTS.md`; if absent, use the default matrix in Section 4 and record the assumption.
2. **One command from a clean checkout.** Preview scripts install, seed, build, and launch. They are idempotent, fail loudly with a clear message, and run on the founder's host shell (PowerShell on Windows; do not assume bash-only tooling).
3. **The agent verifies first; the founder confirms.** Before calling the founder, the agent runs the core journeys itself with its browser/device tooling or an automation framework, captures evidence, and fixes what it finds. The founder's time goes to judgment — look, feel, flow, fitness for purpose — not to finding crashes.
4. **Iterate in dev mode, accept in release mode.** Hot-reload builds are for iteration. Milestone acceptance uses a release (production-like) build, because minification, signing, caching, and permissions differ.
5. **Synthetic, realistic data.** Seed scripts create demo personas for each role (e.g., admin, member, guest), realistic volumes, and edge cases: empty states, very long names and text, missing images, many items, slow and failing network. Never use real personal data or production credentials.
6. **Every build identifies itself.** Version, commit, and build mode are visible in the UI (an About screen, footer badge, or settings page), in `--version` for CLIs, and in API health output. Feedback must map to an exact build.
7. **Show the states, not just the happy path.** Capture loading, empty, error, offline, permission-denied, first-run/onboarding, long-content, dark mode, and large-text states for every core screen.
8. **Cover the matrix that matters.** Test the platforms, viewports, OS versions, and input methods the product targets — and on both mobile platforms at every milestone if both are targets. "Works on iOS" does not mean "works on Android."
9. **Private by default.** Preview links, tunnels, and test builds are access-controlled and time-boxed. Nothing in a preview build contains secrets.
10. **Reproducible evidence.** Every screenshot and recording names the build, device/viewport, and journey step; automation traces and exact commands are kept so any finding can be replayed.
11. **Quality is visible.** Accessibility and performance results ship with the visuals (Section 6).
12. **Never fake it.** Mockups are labeled as mockups; stubbed features are labeled as stubbed; evidence comes only from the actual build. A screenshot of a hardcoded screen presented as a working feature is a defect.

---

## 3. The preview ladder

| Level | What it is | Used for |
|---|---|---|
| **L0 — Design** | Wireframes, a clickable mock, or a component gallery (e.g., Storybook) showing components in all their states | Agreeing on look and structure before logic exists |
| **L1 — Local live** | Dev server, emulator, or dev build with hot reload on the founder's machine | Day-to-day iteration |
| **L2 — Agent evidence** | Automated journeys run by the agent with screenshots, recordings, traces, and reports | Every unit with a UI; the default review artifact |
| **L3 — Hands-on shareable** | Protected preview deployment, authenticated tunnel, or test build installed on the founder's real device | Milestone review |
| **L4 — Acceptance** | Release build, clean install, real target devices/OS, production-like configuration | Release candidates |

**Minimum per moment:** each UI unit → L2 · each milestone → L2 + L3 · each release candidate → L4 with the full matrix.

---

## 4. Default target matrix (use when the product does not specify one)

| Type | Default matrix |
|---|---|
| Web / PWA | Viewports 320, 375, 768, 1024, 1280, 1536 px wide · latest Chrome, Safari (WebKit), Firefox, Edge · light/dark · 200% zoom · keyboard-only |
| iOS | Smallest and largest current iPhone sizes, one iPad if supported · current iOS and one major version back · Dynamic Type at largest size · VoiceOver |
| Android | Small phone, large phone, one tablet/foldable if supported · current Android and the minimum supported API level · font scale large · TalkBack · gesture and 3-button navigation |
| Windows desktop | Windows 11 (and 10 if supported) · display scaling 100, 125, 150, 200% · light/dark · keyboard navigation · clean install and uninstall |
| macOS desktop | Current macOS and one back · Apple silicon (and Intel if supported) · light/dark · VoiceOver |
| CLI | Windows (PowerShell), macOS and Linux shells · narrow terminal (80 columns) · no-color mode |

---
## 5. Per-type playbooks

Each type follows the same four parts: **Run it** (L1) · **Agent evidence** (L2) · **Founder hands-on** (L3/L4) · **Watch for**. Use the engine's own browser or device tools when it has them (Section 10); otherwise use the automation frameworks named here.

### 5.1 Website and web app

- **Run it:** a `preview` script that installs dependencies, seeds data, and starts the dev server on a fixed port with the URL printed. For acceptance, the same script with a `--release` flag builds and serves the production bundle locally.
- **Agent evidence:** drive every core journey with a browser automation framework (e.g., Playwright) or the engine's browser tool; capture a full-page screenshot per step at each matrix viewport, a short video per journey, and an automation trace for any failure; run automated accessibility checks (e.g., axe-core) and a performance audit (Core Web Vitals: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1); collect console errors and failed network requests — any error is a finding.
- **Founder hands-on:** a protected per-branch **preview deployment** (most web hosts offer these; turn on password or account protection), or an **authenticated tunnel** to the local server (Section 11). To try it on his phone on the same Wi-Fi, bind the dev server to the local network address and print a QR code with the URL.
- **Watch for:** horizontal scrolling on any viewport; layouts that only work at the developer's window size; hover-only interactions on touch devices; missing loading and error states; forms that lose input on validation errors.

### 5.2 Progressive Web App (PWA)

Everything in 5.1, plus:

- **Run it:** service workers require a secure context — HTTPS, or `localhost` on the same machine. Testing install and offline behavior on a phone therefore needs an HTTPS preview deployment or an HTTPS tunnel, not the plain LAN address.
- **Agent evidence:** inspect the web app manifest and service worker (browser devtools Application panel); capture the install prompt or menu item; test offline mode (devtools offline toggle) on each core screen; verify the update flow (new service worker → user sees an update prompt or a clean refresh). Chrome no longer requires a service worker with a `fetch` handler to install from the browser menu (since Chrome 108 mobile / 112 desktop), but its automatic install prompt still does, and offline support needs one anyway; manifest `name`/`short_name`, `icons`, `start_url`, and `display` remain the expected fields.
- **Founder hands-on:** install it on Android (Chrome → Install app) and iOS (Safari → Share → Add to Home Screen) and use it from the home-screen icon, including once in airplane mode.
- **Watch for:** iOS differences in standalone PWAs (push notifications only for home-screen-installed web apps on supported iOS versions; storage eviction; no install prompt); stale cached builds after deploys — the build badge (Principle 6) shows which version is running.

### 5.3 iOS and iPadOS apps

- **Constraint:** the iOS Simulator and native iOS builds require macOS with Xcode. A Windows or Linux host cannot run them locally.
- **On a macOS host:**
  - **Run it:** Xcode or `xcrun simctl` to boot simulators from the matrix and install the build.
  - **Agent evidence:** UI tests (XCUITest, or a cross-platform flow runner such as Maestro or Appium) capturing screenshots per step on each simulator; simulator screen recordings; snapshot tests for components (e.g., SnapshotTesting).
- **On a Windows or Linux host** (cross-platform frameworks such as React Native/Expo or Flutter make this workable; fully native Swift does not):
  - **Quick look:** a framework companion app on a physical iPhone (e.g., Expo Go) where the project's native modules allow it.
  - **Development builds on a real device:** a cloud build service (e.g., EAS Build) produces a signed build installable on registered devices. Requires a paid Apple Developer Program membership.
  - **Cloud simulators:** a remote iOS Simulator streamed to the browser removes the Mac requirement for viewing — Expo's EAS Simulator does this, but as of September 2026 it is a limited-access preview from a waitlist. Browser-streamed simulator services exist as alternatives; verify current availability and pricing before relying on one.
  - **CI on macOS runners:** build and run UI tests with screenshots in CI, and attach the images to the evidence pack.
- **Founder hands-on (L3/L4):** **TestFlight**. Internal testers (members of the App Store Connect team) get builds without review; external testers (up to 10,000, by email or public link) require Beta App Review; builds expire after 90 days. Release candidates are always tested from TestFlight on a real device, never only in a simulator.
- **Watch for:** safe areas (notch, Dynamic Island, home indicator); Dynamic Type at large sizes; VoiceOver labels; permission prompts (camera, location, notifications) and the denied path; keyboard covering inputs; behavior after backgrounding and relaunch.

### 5.4 Android apps

- **Run it:** the Android Emulator on any host OS. On Windows, enable CPU virtualization in BIOS/UEFI and use **Windows Hypervisor Platform (WHPX)** — Google's recommended hypervisor, compatible with Hyper-V. The older Android Emulator hypervisor driver (AEHD) is being sunset on **2026-12-31**; Intel HAXM is no longer used. Verify with `emulator -accel-check`. Do not run the emulator inside another VM. Install builds with `adb install`; physical devices work over USB or wireless debugging.
- **Agent evidence:** UI flows (Espresso, Compose UI tests, or Maestro/Appium) with screenshots per step on each matrix device; `adb exec-out screencap -p` for ad hoc screenshots and `adb shell screenrecord` for short recordings; snapshot tests for components (e.g., Paparazzi).
- **Founder hands-on:** an APK/AAB install on his phone, or a test track — Play Console internal testing, or a distribution service such as Firebase App Distribution — so updates arrive automatically.
- **Watch for:** back-button and gesture-navigation behavior; process death and state restoration; large font scale; TalkBack; runtime permissions; minimum-API devices that are much slower than the developer's emulator.

### 5.5 Cross-platform mobile (React Native/Expo, Flutter, and similar)

Follow both 5.3 and 5.4 at every milestone. Use the framework's web target only for quick layout checks — it is not evidence that the native app works. Keep one shared journey script (e.g., Maestro flows) so the same steps produce comparable screenshots on both platforms.

### 5.6 Windows desktop (.exe, MSI, MSIX)

- **Run it:** a dev launch script, plus a packaging script producing the installer the user will actually receive.
- **Agent evidence:** UI automation for core journeys with screenshots (WinAppDriver/UI Automation for native apps; Playwright for Electron, Section 5.8); screenshots at 100, 125, 150, and 200% display scaling and in light/dark mode; installer and uninstaller runs captured.
- **Founder hands-on:** install the packaged build — not the dev build — in a **clean environment**. Windows Sandbox gives a disposable, fresh Windows each launch, but it is available only on Windows Pro, Enterprise, and Education editions, **not Home**; on Home, use a virtual machine or a separate local user account. Disable Sandbox networking when testing untrusted builds.
- **Watch for:** SmartScreen warnings on unsigned builds (code signing is required for trust; plan it before release); missing runtime dependencies on a clean machine; per-monitor DPI blur; files written outside user-writable locations; uninstall leaving files or registry entries behind; auto-update integrity.

### 5.7 macOS desktop

- **Constraint:** building, signing, and notarizing macOS apps requires macOS (locally or on macOS CI runners).
- **Run it / evidence:** run from Xcode or the framework CLI; UI tests with screenshots; capture light/dark mode and the menu bar and window behaviors.
- **Founder hands-on:** a notarized build (notarization is required for distribution outside the Mac App Store). On a Windows-only setup, rely on CI-produced screenshots and recordings plus a remote or borrowed Mac for L4 acceptance.
- **Watch for:** Gatekeeper prompts; sandbox entitlements; keyboard shortcuts following macOS conventions; VoiceOver.

### 5.8 Cross-platform desktop (Electron, Tauri, and similar)

- **Run it:** the framework's dev command for iteration; packaged builds per target OS for acceptance (each OS's package is built on that OS or its CI runner).
- **Agent evidence:** Playwright can automate Electron apps; Tauri provides WebDriver-based testing through its driver (check current platform support). Capture the same journeys on every target OS.
- **Founder hands-on:** install the packaged build for his OS in a clean environment (5.6).
- **Watch for:** the platform rules in 5.6 and 5.7 still apply — signing, notarization, DPI, native menus, file associations, and update channels.

### 5.9 Command-line tools

- **Run it:** an install-from-source script and a packaged install (package manager or single binary).
- **Agent evidence:** a recorded terminal session per core command (a terminal recorder such as asciinema, or a plain text transcript with the commands and output); golden-output snapshot tests; `--help` and error messages reviewed for clarity; runs in a clean container or user account.
- **Founder hands-on:** a short script of commands to run with expected output beside each.
- **Watch for:** Windows path and quoting differences; exit codes; behavior when piped (no color, no prompts); helpful errors for missing configuration.

### 5.10 APIs and backends

- **Run it:** a script that starts the service and its dependencies (database, queue) locally with seeded data.
- **Agent evidence:** interactive API documentation generated from the OpenAPI (or equivalent) spec; a request collection (Bruno, Postman, or plain `.http` files) covering every endpoint, including error cases; contract and integration test results; a health/version endpoint response.
- **Founder hands-on:** the interactive docs page with a demo token, plus a small admin or status view if the product has no UI yet — a backend nobody can see is hard to judge.
- **Watch for:** error responses that leak stack traces; missing pagination; authorization differences between roles (test each persona).

### 5.11 Browser extensions

- **Run it:** load the unpacked build into a **separate browser profile** (never the founder's main profile) via the browser's extension developer mode.
- **Agent evidence:** automation with a persistent browser context that loads the extension (Playwright supports this for Chromium); screenshots of the popup, options page, and in-page effects on representative sites.
- **Founder hands-on:** the same separate profile, with the test script.
- **Watch for:** requested permissions (fewer is better and affects store review); behavior on sites with strict content security policies; storage sync across devices.

### 5.12 The invisible parts: email, notifications, background jobs

- **Email:** route all outgoing mail in development and preview to a local mail catcher (e.g., Mailpit) and include screenshots of each email in the evidence pack, on desktop and mobile widths.
- **Push and in-app notifications:** a test-send screen or command that triggers each notification type; screenshots on each target platform.
- **Background jobs and schedules:** a status view or log excerpt showing each job ran, plus a manual trigger for the founder.
- **Watch for:** emails that render only in one client; notifications that arrive with placeholder text; jobs that silently fail.

### 5.13 AI features inside the product

- **Agent evidence:** a gallery of real input/output pairs from the eval set — typical, edge, and adversarial (including prompt-injection attempts) — with the model and version noted; eval pass rates; the fallback behavior when the model is unavailable.
- **Founder hands-on:** a scripted set of prompts to try, plus free exploration; clear labeling in the UI that output is AI-generated.
- **Watch for:** confident wrong answers; personal data in prompts or logs; costs per interaction outside budget.

### 5.14 Anything else

For a type not listed (games, embedded devices, data pipelines, smart-TV apps, voice apps), apply the same structure: find the closest emulator or simulator, define the real-target path, capture evidence of every state, and write the test script. Record the chosen approach in `PREVIEW.md`.

---

## 6. Evidence pack

Produced at every milestone in `docs/previews/<YYYY-MM-DD>-<milestone>/`:

```
docs/previews/2026-11-03-m2-onboarding/
├── SUMMARY.md            # build version + commit + mode, what changed, known issues, how to run
├── TEST-SCRIPT.md        # founder's hands-on script (Section 7)
├── screenshots/          # <journey>-<step>-<device-or-viewport>-<theme>.png
├── recordings/           # <journey>-<device>.mp4|webm — each ≤60 s, one journey per file
├── traces/               # automation traces for any failure, replayable
└── reports/              # accessibility, performance, test results, console/network errors
```

Rules:

- Every image and recording comes from the actual build named in `SUMMARY.md`.
- Screenshots cover every core screen in every state from Principle 7, at every matrix device or viewport.
- Recordings are short and single-purpose; long, unedited sessions are not evidence.
- Seeded data only. Scan images for secrets, tokens, and personal data before saving.
- Keep evidence packs small enough to commit, or store them as CI artifacts and link them from `SUMMARY.md`.

---
## 7. Founder test script (`TEST-SCRIPT.md`)

```markdown
# Test script — [milestone] — build [version] ([commit], [release|dev])

## Setup (≤5 minutes)
How to open it: [link / command / install step]   Device(s): [which]
Demo accounts: admin@demo.test / [password in the password manager entry "demo"] · member@demo.test · guest
Reset demo data: [command or button]

## Journeys
### J1 — [name, e.g., Sign up and finish onboarding]
1. [Action]                         → Expect: [visible result]
2. [Action]                         → Expect: [visible result]
Also try: [an edge case, e.g., a very long company name; go offline at step 2]

### J2 — ...

## What I want your judgment on
- [Specific questions: is the pricing page clear? does the dashboard show the right thing first?]

## Known issues (don't report these)
- [List]
```

Rules: 5–10 journeys per milestone; each step has an observable expected result; include at least one edge case per journey; never put real credentials in the file.

---

## 8. Feedback protocol

The founder can give feedback any way he likes — voice note, annotated screenshot, chat. The agent normalizes each item into this record before doing any work:

```
FB-014 · [journey/step or screen] · build [version]
Did: [what he did]
Expected: [what he expected]
Got: [what happened]                         Evidence: [his screenshot or the agent's reproduction]
Type: bug | visual | copy | flow | feature-request | question
Severity: S1 blocks the journey · S2 wrong but workaround exists · S3 polish
```

Then:

1. **Reproduce it** on the same build and attach the reproduction. If it cannot be reproduced, ask one precise question.
2. **Convert it** into a unit with Given/When/Then acceptance criteria. Bugs get a regression test that fails first. Feature requests that change scope go to the founder as a change request — they are not slipped into the current unit.
3. **Close the loop** in the next evidence pack: each FB item shows the before and after screenshots and the commit that fixed it.

---

## 9. `PREVIEW.md` template (generated at project start, kept current)

```markdown
# Preview — [product]

## Run it on your machine
[One command for Windows PowerShell] · [one command for macOS/Linux if relevant]
Opens: [URL / emulator / app window]   Stop: [how]   Reset data: [command]

## Try it on the real target
[Preview link (protected) / TestFlight / internal test track / installer download]

## What this host can and cannot do
[e.g., Windows host: Android emulator ✓ · iOS Simulator ✗ → TestFlight and CI screenshots instead]

## Demo accounts and data
[Personas, roles, where credentials are kept — never in this file]

## Matrix covered by automated evidence
[Viewports/devices/OS versions]

## Latest evidence pack
[Link to docs/previews/...]
```

---

## 10. Engine bindings (dated snapshot — verify against current docs)

All engines can fall back to running an automation framework (Playwright for web and Electron; platform UI-test tools and Maestro/Appium for mobile) and saving its screenshots, videos, and traces. Use built-in capabilities when present:

| Engine | Built-in preview and evidence capabilities (as of 2026-10-24) |
|---|---|
| **Claude Code** | Desktop app **Browser pane** runs the dev server and shows the running app; **auto-verify** (on by default) has Claude take screenshots, check errors, inspect the DOM, click, and fill forms after edits; server commands live in `.claude/launch.json`. A Chrome extension is available when the task needs the user's signed-in browser. Computer use (separate, research preview) controls the desktop on macOS and Windows. |
| **Google Antigravity** | A browser the agent drives; **walkthrough** artifacts summarize finished work and, for browser tasks, include screenshots and screen recordings. Browser actions are governed by URL permissions (`read_url`, `execute_url`). |
| **Cursor** | Agent **browser use**: navigate, click, fill forms, take screenshots, read page content, on local dev servers and public sites. |
| **OpenAI Codex** | An **in-app browser** where the user can comment directly on pages to instruct the agent (April 2026); **computer use** to see and operate apps, initially on macOS. |
| **Any other engine** | Run the automation framework from the terminal and attach outputs to the evidence pack. |

Whatever the engine, the evidence pack format (Section 6) and the test script (Section 7) stay the same, so the founder reviews every project the same way.

---

## 11. Security and privacy for previews

- **Tunnels are public unless you protect them.** A Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:<port>`) is for testing and development only: the hostname changes every run, there is no uptime guarantee, it allows up to 200 in-flight requests, and it does not support Server-Sent Events. Without `--allowed-mail <founder-email>` anyone with the URL can reach the service; with it, visitors must pass an email one-time PIN. Stop the tunnel when the session ends. Other tunnel services carry the same rule: authenticate, time-box, and never expose admin endpoints or debug ports.
- **Preview deployments** are password- or account-protected and use preview-only credentials and databases — never production ones.
- **Test builds** (TestFlight, internal tracks, installers) use test backends; public TestFlight links are not shared beyond the intended testers.
- **No secrets in builds or evidence.** Client bundles, mobile binaries, screenshots, recordings, and traces are scanned for keys, tokens, and personal data.
- **Untrusted installers run isolated** (Windows Sandbox with networking off where available, or a VM).
- **The agent's browser is not the founder's browser.** Automation uses a separate profile with no personal sign-ins unless the founder explicitly allows it for a specific task.

---

## 12. Host capability matrix

| Capability | Windows host | macOS host | Linux host |
|---|---|---|---|
| Web, PWA, API, CLI previews | ✓ | ✓ | ✓ |
| Android Emulator | ✓ (WHPX; virtualization enabled in BIOS) | ✓ | ✓ (KVM) |
| iOS Simulator / native iOS builds | ✗ → cloud build + TestFlight, cloud simulator (limited availability), or macOS CI | ✓ (Xcode) | ✗ (same as Windows) |
| Windows desktop builds and clean-install tests | ✓ (Windows Sandbox on Pro/Enterprise/Education only; VM on Home) | VM or Windows CI | VM or Windows CI |
| macOS app builds, signing, notarization | ✗ → macOS CI or a remote Mac | ✓ | ✗ → macOS CI |
| Linux desktop packages | WSL or VM | VM | ✓ |

The agent records the founder's host in `PREVIEW.md` and plans every ✗ before the first milestone, not at release time.

---

## 13. Ready for founder review — checklist

```
[ ] PREVIEW.md is current; the one command works from a clean checkout on the founder's host
[ ] Build badge shows version, commit, and mode
[ ] Core journeys pass in automation on the full matrix; zero console errors; zero failed requests
[ ] Evidence pack complete: every core screen × state × matrix point; recordings per journey
[ ] Accessibility checks pass (WCAG 2.2 AA automated baseline) and performance within budget
[ ] Real-target path ready (protected preview link / test build / installer) and verified by the agent
[ ] TEST-SCRIPT.md written with demo accounts, seeded data, expected results, and known issues
[ ] Previous feedback items closed with before/after evidence
[ ] No secrets or personal data in builds, links, or evidence
```

---

## 14. Sources (retrieved 2026-10-24)

- Expo — [Work without a Mac (EAS Simulator)](https://docs.expo.dev/preview/simulators/how-to/work-without-a-mac/); [Build iOS apps on Windows with cloud simulators](https://expo.dev/blog/build-ios-apps-on-windows-with-cloud-simulators.md) (2026-09-14)
- Android Developers — [Configure hardware acceleration for the Android Emulator](https://developer.android.com/studio/run/emulator-acceleration)
- Chrome for Developers — [Revisiting Chrome's installability criteria](https://developer.chrome.com/blog/update-install-criteria)
- Microsoft Learn — [Windows Sandbox overview](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-overview)
- Cloudflare — [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- Luciq (formerly Instabug) — [TestFlight beta testing](https://www.luciq.ai/blog/testflight-beta-testing-setting-effective-tests) (external tester limit, Beta App Review, 90-day expiry; its internal-tester figure conflicts with Apple's current documentation, so it is not used here)
- Claude Code docs — [Desktop: Browser pane and auto-verify](https://code.claude.com/docs/en/desktop.md)
- Antigravity docs — [Walkthrough](https://antigravity.google/docs/walkthrough), [Permissions](https://www.antigravity.google/docs/permissions)
- Cursor — [Browser](https://cursor.com/help/ai-features/browser)
- OpenAI — [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/) (2026-04-16)
- Platform standards (breakpoints, display scaling, VoiceOver/TalkBack, signing and notarization, both-platform testing) follow the technical-standards skill's web, mobile, and desktop references.

*Framework names (Playwright, Maestro, Appium, XCUITest, Espresso, Paparazzi, SnapshotTesting, Storybook, Mailpit, asciinema, Bruno) are examples of a tool class, not requirements; pick what fits the stack and verify current versions before pinning.*
