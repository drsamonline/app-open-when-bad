# Changelog

All notable changes to Open when it is bad are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 25/11/2026

### Added
- A nine-step grounding script that opens on step one, large, with **nothing to fill in**. It holds
  no state at all, so it cannot be corrupted and it cannot be blocked by a failed save.
- A plan written once in a calm moment: warning signs, what helps, what to say, who to call.
- **One action** opens it: no login, no PIN, no account, no network. The engine's `openPlan` is a
  single call and the page's is a single button.
- Every step comes back in the order it was written, and the plan view contains nothing time-like —
  no streak, no "last opened", no expiry — so a month away changes nothing.
- Contacts are stored exactly as typed, marked "as entered by you", and each is a `tel:` link. A
  number the app cannot validate is kept and flagged, never corrected.
- A printable card (.txt) that carries the crisis statement, the numbers, every contact, every step
  and the whole first-aid script — a copy that does not need the app.
- The crisis block sits first on the page, is not collapsible, and carries the "not a crisis
  service" statement in the app's own words.
- Refusals: a step with no text, a contact with no name or no number, a section that does not exist.
- Corruption handling: an unreadable plan is reported on the front screen, offered for export, and
  never replaced by an empty plan; the person is told the printed card still works.
- A failed save says **NOT SAVED** immediately and blocks the close (`beforeunload`), because a plan
  that looks saved and is not is dangerous.
- PWA shell, CI (97 engine assertions + 42 in jsdom + page smoke), and the app-builder pipeline
  pinned to the canonical SHA for the EXE/APK/Linux release.

### Not built
- Any monitoring, reminder, streak, risk score or assessment. All of those would be a way for the
  app to fail the person at the moment it is needed.
- An optional PIN: it was allowed by the spec and deliberately left out. The one moment the plan is
  needed is the moment a password will not be remembered.
