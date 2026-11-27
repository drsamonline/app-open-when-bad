# Open when it is bad

One grounding step at a time, and the plan you wrote in a calm moment — **one action away, offline,
with no login and nothing to remember.**

> **This is not a crisis service, and it cannot tell whether you are in danger.** If you are in
> danger now, call emergency services (112 in India) or a crisis line you trust — Tele-MANAS is on
> 14416. Build the plan with a therapist or someone you trust if you can.

- **Demo (the app itself):** https://drsamonline.github.io/app-open-when-bad/play/index.html
- **Landing page:** https://drsamonline.github.io/app-open-when-bad/
- **Release:** https://github.com/drsamonline/app-open-when-bad/releases/tag/app-latest
- **Plan row:** #11 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-nightwatch` (lead), `app-panic-harbor`
- **Licence:** PolyForm Noncommercial 1.0.0
- **Sponsor:** [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) — free, offline, no account

## Status

| | |
|---|---|
| **Built** | Nine-step script with no input at all; plan of warning signs / what helps / what to say / who to call; one-action open with no login or network; contacts as typed and dialable; printable card; crisis block first and not collapsible; failed save blocks the close; corrupt plan reported, never replaced by an empty one. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | Anything that watches, scores, reminds or assesses — no streak, no reminder, no risk score. No optional PIN either: it was allowed by the spec and left out on purpose, because the moment the plan is needed is the moment a password will not be remembered. |
| **Untested** | Real phones and real browsers — the `tel:` links and the install prompt are not exercised by jsdom. And the thing that actually matters: whether the plan helps anyone. That is not a software question, and this README will not pretend an assertion proves it. |

## The Nightwatch spec's "done means", counted

> "The plan opens from the app in 1 action, with no login and with the network off, and every step
> the user wrote appears in the order they wrote it. A plan with 4 contacts shows all 4 and dials the
> one tapped. Opening it after a month away shows the same content — a missed day does not hide,
> grey out or reset anything. The app states it is not a crisis service and shows the region's crisis
> line before anything else."

| The spec says | The test |
|---|---|
| one action, no login, network off | `openPlan(plan)` is one call; the page is one button; no password/PIN/auth field exists; no `fetch` anywhere; CSP `connect-src 'none'` |
| every step in the order written | the signs come back in the order they were added, asserted by string comparison |
| four contacts, all shown, the tapped one dials | all four present, each with a `tel:` href, numbers displayed exactly as typed |
| a month away changes nothing | the view is byte-identical later; the view's key set is pinned so nothing time-like can be added; an old plan reads exactly like a new one |
| not a crisis service, crisis line first | the statement is asserted, and the crisis block is the first element in `main`, before the script and before the plan button |
| one instruction at a time, nothing to fill in | every step carries exactly `{title, note}` and nothing else; the script card contains no input; the first step is on screen at load |

## Two specs, one job

Nightwatch is *the plan you open when it is bad*; Panic Harbor is *the script you follow when it is
bad*. Both are the same job — **be useful in the worst moment, needing nothing** — so one app: the
script is the first thing on screen and holds no state, and the plan sits one action behind it.

## What it will not do, and why each one matters

- **Assess, triage, diagnose or decide whether anyone is in danger.** It says so above everything.
- **Stand in for a crisis line.** The numbers come first and are labelled as bundled so you check them.
- **Correct a number you typed.** It is stored as entered and marked "as entered by you".
- **Hide, grey out or reset anything after time away.** No streak, no expiry, no "review due".
- **Need the network, an account or a password.**
- **Give medical advice.** One grounding step at a time, nothing else.

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | A step with no text refused; a contact with no name or number refused; an unvalidatable number kept as typed and flagged. |
| **No network** | Nothing changes; nothing on the path needs a request. |
| **Storage full or unavailable** | **NOT SAVED** immediately, and the page blocks the close — a plan that looks saved and is not is the dangerous failure. |
| **Corrupt saved state** | Reported on the front screen, offered for export, never replaced by an empty plan; and the person is told the printed card still works. |

## The bug the tests caught, and it was the dangerous kind

The first version of the page set a cheerful status line **after** saving — so when the save failed,
`persist()` set "NOT SAVED" and the very next line overwrote it with "Saved as you entered it." The
dirty flag and the `beforeunload` guard were still correct, but the message a person would actually
read was a lie. The handler now only shows the cheerful line when the write succeeded.

That is the failure mode this app exists to avoid, and it was caught by simulating a full quota in
jsdom (replacing `window.localStorage` with a throwing stub) rather than by reading the code.

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 97 assertions, including the done-means
node tests/ui-tests.js        # the page in jsdom — 42 assertions (needs the dev-only jsdom)
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 25/11/2026. **Two of the six survived the first time** — a plan that
expires after a month, and a script step that carries an input field — so the suite was tightened
(the view's key set is now pinned; every step must have exactly `{title, note}`) and both then went
red. The four that failed immediately: steps out of order (2 failures), contacts "corrected" (3), a
corrupt plan becoming an empty one (4), and the app claiming to be a crisis service (5).

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — crisis block first, then the script, then the plan
docs/play/app.js           DOM wiring: the script, the plan, contacts, the card, the save guard
docs/play/nightwatch-core.js  the engine — the plan, the script, tel: links, corrupt handling
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (97)
tests/ui-tests.js          page suite (42, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **No optional PIN**, though the spec allowed one. A lockout on the one screen that must never lock is worse than the privacy it buys.
- **The script holds no state**, so a corrupt plan cannot block it and a full disk cannot stop it.
- **The crisis numbers are labelled, not asserted.** Two bundled starting points, both marked "check it is current", and every typed number marked as the person's own.
- **The card is plain text**, not a PDF: it must print from any machine, and it must be readable when nothing else works.
- **No reminders.** A notification that fails is worse than no notification: it teaches the person the app will be there, and then it is not.

## What is not built, and why

**Anything that watches.** No streak, no reminder, no risk score, no "we noticed you have not opened
this". Every one of those is a way for the app to fail at the moment it is needed, and each would
require the app to hold an opinion about the person's state — which is exactly what the spec forbids
and what this app must not do.

**A clinician in the room.** The plan is written with a therapist if the person has one. The app can
hold the plan; it cannot be the relationship that makes the plan work.
