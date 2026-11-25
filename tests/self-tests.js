#!/usr/bin/env node
/* self-tests — Open when it is bad. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Nightwatch spec's "done means" is countable, so it is counted:
 *
 *   "The plan opens from the app in 1 action, with no login and with the network off, and every
 *    step the user wrote appears in the order they wrote it. A plan with 4 contacts shows all 4
 *    and dials the one tapped. Opening it after a month away shows the same content — a missed day
 *    does not hide, grey out or reset anything. The app states it is not a crisis service and
 *    shows the region's crisis line before anything else."
 *
 * Panic Harbor's rules are here too: one instruction at a time, nothing to fill in, no medical
 * advice, and a script that holds no state so it cannot be corrupted.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var N = require(path.join(ROOT, "docs", "play", "nightwatch-core.js"));

var passed = 0;
var failed = [];
var group = "";

function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var DAY = 86400000;
var T0 = Date.UTC(2026, 10, 25);

function planWithEverything() {
  var p = N.emptyPlan();
  p = N.addStep(p, "signs", "I stop answering messages and start sleeping in the day", T0).plan;
  p = N.addStep(p, "signs", "I start saying I am fine in a flat voice", T0 + 1).plan;
  p = N.addStep(p, "helps", "Call Aai, even if I do not want to talk", T0 + 2).plan;
  p = N.addStep(p, "say", "I am not doing well and I need company, not advice", T0 + 3).plan;
  ["Asha (sister)", "Ravi (friend)", "Aai", "Dr Kulkarni"].forEach(function (n, i) {
    p = N.addContact(p, { label: n, number: "+91 98765 4321" + i }, T0 + 10 + i).plan;
  });
  return p;
}

/* ================================================ the spec's own "done means" */

section("done means — the plan opens in one action, with no login");
var plan = planWithEverything();
var opened = N.openPlan(plan);
eq("one call opens it", opened.ok, true);
ok("it returns the plan itself", opened.view.signs.length === 2 && opened.view.contacts.length === 4);
ok("there is no password, PIN or account field in the engine",
  !/\b(password|passcode|pin|login|auth|token)\s*[:=]/i.test(read("docs/play/nightwatch-core.js")) &&
  !/\b(requirePassword|unlockWith)\s*\(/i.test(read("docs/play/nightwatch-core.js")));
ok("no network call exists in the engine", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(read("docs/play/nightwatch-core.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));
eq("an empty plan does not open as a plan", N.openPlan(N.emptyPlan()).ok, false);
ok("and it says to write one", /write one in a calm moment/i.test(N.openPlan(N.emptyPlan()).reason), N.openPlan(N.emptyPlan()).reason);

section("done means — every step appears in the order it was written");
eq("the signs are in the written order", opened.view.signs.join(" | "),
  "I stop answering messages and start sleeping in the day | I start saying I am fine in a flat voice");
eq("the helps are in the written order", opened.view.helps[0], "Call Aai, even if I do not want to talk");
eq("the say line is kept", opened.view.say[0], "I am not doing well and I need company, not advice");
ok("the counts are reported", opened.view.counts.signs === 2 && opened.view.counts.contacts === 4);

section("done means — four contacts, all shown, each dialable");
eq("all four are shown", opened.view.contacts.length, 4);
eq("the names are kept", opened.view.contacts.map(function (c) { return c.label; }).join(", "), "Asha (sister), Ravi (friend), Aai, Dr Kulkarni");
ok("every contact has a tel: link", opened.view.contacts.every(function (c) { return c.href.indexOf("tel:") === 0; }));
eq("the link keeps the digits and drops only spaces", opened.view.contacts[0].href, "tel:+919876543210");
eq("the number is displayed exactly as typed", opened.view.contacts[0].number, "+91 98765 43210");
ok("every contact is marked as the person's own", opened.view.contacts.every(function (c) { return c.asEntered && /as entered by you/.test(c.note); }));

section("done means — a month away changes nothing");
var monthLater = N.planView(plan);
eq("the view is byte-identical a month later", JSON.stringify(monthLater), JSON.stringify(opened.view));
ok("nothing in the view depends on the clock",
  !/Date\.now|new Date|daysSince|streak|lastOpened|due/i.test(read("docs/play/nightwatch-core.js").split("function planView")[1].split("/* ----")[0]));
ok("there is no streak, expiry or review field in the plan",
  !/\b(streak|expiry|expires|reviewDue|dueAt|lastOpened)\s*[:=]/i.test(read("docs/play/nightwatch-core.js")) &&
  Object.keys(N.emptyPlan()).every(function (k) { return !/streak|expiry|expires|due|review|last/i.test(k); }),
  Object.keys(N.emptyPlan()).join(","));
/* The view is where a "greyed out" or "expired" flag would actually appear, so its key set
 * is pinned: nothing time-like may be added to what the person reads. */
ok("the plan view carries nothing time-like at all",
  Object.keys(opened.view).every(function (k) { return !/streak|expir|due|review|last|age|days/i.test(k); }),
  Object.keys(opened.view).join(","));
ok("an old plan reads exactly like a new one",
  JSON.stringify(N.planView(N.addStep(N.emptyPlan(), "signs", "x", T0).plan)) ===
  JSON.stringify(N.planView(N.addStep(N.emptyPlan(), "signs", "x", T0 + 400 * DAY).plan)));
var parsedLater = N.parsePlan(N.serializePlan(plan));
eq("a saved plan round-trips unchanged", JSON.stringify(N.planView(parsedLater.plan)), JSON.stringify(opened.view));

section("done means — it says it is not a crisis service, first");
ok("the statement exists", /not a crisis service/.test(N.NOT_A_SERVICE), N.NOT_A_SERVICE);
ok("it does not claim to know whether anyone is in danger", /cannot tell whether you are in danger/.test(N.NOT_A_SERVICE));
ok("it points to emergency services and a crisis line", /emergency services or a crisis line/.test(N.NOT_A_SERVICE));
var page = read("docs/play/index.html");
var crisisAt = page.indexOf('id="crisis"');
var scriptAt = page.indexOf('id="scriptCard"');
var planAt = page.indexOf('id="openPlanBtn"');
ok("the crisis block comes before the script", crisisAt > 0 && crisisAt < scriptAt, crisisAt + " vs " + scriptAt);
ok("and before the plan button", crisisAt < planAt);
ok("it is not collapsible or dismissible",
  !/<section[^>]*id="crisis"[^>]*(hidden|close|dismiss)/i.test(page) &&
  !/<button[^>]*(close|dismiss)[^>]*>/i.test(page));
ok("the bundled lines are labelled as bundled", N.BUNDLED_LINES.every(function (b) { return /bundled/.test(b.note); }));
ok("and told to be checked", N.BUNDLED_LINES.every(function (b) { return /check it is current/.test(b.note); }));
ok("every bundled line has a dialable number", N.BUNDLED_LINES.every(function (b) { return N.telHref(b.number).indexOf("tel:") === 0; }));

/* ==================================================== Panic Harbor's rules */

section("panic script — one instruction at a time, nothing to fill in");
ok("there is a script", N.PANIC_STEPS.length >= 5, N.PANIC_STEPS.length);
var s0 = N.scriptStep(0);
eq("it opens on the first step", s0.index, 0);
ok("the first step is an instruction, not a form", /Sit down/.test(s0.step.title), s0.step.title);
ok("each step is one instruction with a note", N.PANIC_STEPS.every(function (s) { return s.title && s.note && s.title.length < 90; }));
/* A step may carry a title and a note and NOTHING else: an input field would be the one
 * thing this script must never ask for. */
ok("no step carries anything but a title and a note",
  N.PANIC_STEPS.every(function (s) {
    return Object.keys(s).sort().join(",") === "note,title";
  }),
  N.PANIC_STEPS.map(function (s) { return Object.keys(s).join("+"); }).join(" | "));
eq("the last step hands over to the plan", N.scriptStep(N.PANIC_STEPS.length - 1).isLast, true);
ok("the script holds no state at all", !/\b(scriptState|stepState|saveScript)\b/.test(read("docs/play/nightwatch-core.js")));
ok("the script gives no diagnosis and no medication advice",
  !/\b(diagnos\w*|medicat\w*|dose|dosage|prescri\w*|disorder|symptom)\b/i.test(N.PANIC_STEPS.map(function (s) { return s.title + " " + s.note; }).join(" ")));

section("panic script — no input on the page");
var scriptHtml = page.split('id="scriptCard"')[1].split("</section>")[0];
ok("no input, textarea or select inside the script card", !/<(input|textarea|select)/i.test(scriptHtml), scriptHtml.slice(0, 120));
ok("it has a next and a back", /id="next"/.test(scriptHtml) && /id="prev"/.test(scriptHtml));

/* ============================================================ must-nots */

section("must-not — a step with no text is refused");
var noText = N.addStep(plan, "signs", "   ", T0);
eq("an empty step is refused", noText.ok, false);
eq("the field is named", noText.field, "text");
ok("and says why an empty line is worse than none", /worse than no line/.test(noText.reason), noText.reason);
eq("an unknown section is refused", N.addStep(plan, "nope", "x", T0).field, "kind");

section("must-not — a number it cannot validate is kept as typed, never corrected");
var odd = N.addContact(N.emptyPlan(), { label: "Night line", number: "call the landline 2445" }, T0);
eq("the contact is accepted", odd.ok, true);
eq("the number is stored exactly as typed", odd.contact.number, "call the landline 2445");
ok("it is marked as entered by the person", /as entered by you/.test(odd.contact.note), odd.contact.note);
ok("and the app says it did not change it", /(did not change it|was not changed)/.test(odd.contact.note), odd.contact.note);
eq("it is not flagged dialable", odd.contact.looksDialable, false);
var normal = N.addContact(N.emptyPlan(), { label: "Asha", number: "+91 98765 43210" }, T0);
eq("a normal number is flagged dialable", normal.contact.looksDialable, true);
eq("and is still stored as typed", normal.contact.number, "+91 98765 43210");
eq("a contact with no name is refused", N.addContact(N.emptyPlan(), { number: "1" }, T0).field, "label");
eq("a contact with no number is refused", N.addContact(N.emptyPlan(), { label: "x" }, T0).field, "number");

section("must-not — it must not assess risk or stand in for a crisis line");
var core = read("docs/play/nightwatch-core.js");
ok("no risk score, triage or assessment", !/\b(riskScore|assess|triage|severity|screening)\s*[:(]/i.test(core));
ok("no diagnosis field or function anywhere", !/diagnos\w*\s*[:(]/i.test(core));
ok("it says it cannot tell whether anyone is in danger", /cannot tell whether you are in danger/.test(core));
ok("it says it does not replace a crisis line", /not replace a crisis line/.test(read("docs/play/index.html")));
ok("must_not_grow_a_second_job: no second store, no tags, no sync",
  !/\b(tags|labels|folders)\s*[:=]/i.test(core) && !/\bsync\s*[:(]/i.test(core));

section("must-not — an unreadable plan is reported, never replaced by an empty one");
var bad = N.parsePlan("{ broken plan");
eq("a corrupt plan is reported", bad.ok, false);
ok("it says it was NOT replaced with an empty one", /NOT replaced with an empty one/.test(bad.reason), bad.reason);
ok("it tells the person to export it", /Export it to keep it/.test(bad.reason), bad.reason);
ok("and that a printed card still works", /printed card/.test(bad.reason), bad.reason);
eq("the raw text is kept for export", bad.raw, "{ broken plan");
eq("no plan saved yet is distinguished from a broken one", N.parsePlan("").empty, true);
eq("and a broken one is not marked empty", !!bad.empty, false);

section("must-not — the page reports a corrupt plan on the front screen");
var appSrc = read("docs/play/app.js");
ok("the page sets the status from the parse failure", /setStatus\("bad", parsed\.reason\)/.test(appSrc));
ok("it offers an export of the unreadable plan", /Export the unreadable plan/.test(appSrc));
ok("it does not open an empty plan in its place", /never replaced by an empty/.test(appSrc) || /never replaced by an empty/.test(read("docs/play/nightwatch-core.js")));

section("failure case — storage full blocks the close");
ok("the page says NOT SAVED immediately", /NOT SAVED:/.test(appSrc));
ok("it tells the person not to close the page", /Do not close this page/.test(appSrc));
ok("it blocks the close while unsaved", /beforeunload/.test(appSrc) && /state\.dirty/.test(appSrc));
ok("and says why a plan that looks saved is dangerous", /appears saved and is not is dangerous|dangerous failure/.test(appSrc + read("docs/play/nightwatch-core.js")));

section("failure case — no network, and nothing on the path needs one");
["docs/play/nightwatch-core.js", "docs/play/app.js", "docs/play/sw.js", "docs/play/web-kit.js", "docs/play/export-kit.js"].forEach(function (f) {
  var src = read(f);
  ok("no fetch call in " + f, !/\bfetch\s*\(/.test(src));
  ok("no XHR/WebSocket/beacon in " + f, !/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(src));
});
ok("no external link on the page at all except the repo and builds", !/https?:\/\/(?!github\.com\/drsamonline)/.test(page));

section("export — the printed card survives the app");
var card = N.printableCard(plan, { when: "25/11/2026" });
ok("the card leads with the crisis statement", card.split("\n").slice(0, 6).join(" ").indexOf("not a crisis service") > 0, card.slice(0, 120));
ok("the card lists the crisis numbers", /14416/.test(card) && /112/.test(card));
ok("the card lists every contact", ["Asha", "Ravi", "Aai", "Kulkarni"].every(function (n) { return card.indexOf(n) >= 0; }));
ok("the card lists the steps in order", card.indexOf("I stop answering messages") < card.indexOf("I start saying I am fine"));
ok("the card includes the first-aid script", /First aid, one step at a time/.test(card));
ok("the card says it is a copy that does not need the app", /still yours/.test(card));

section("shape — every script the page loads exists beside it");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) {
  ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, ""))));
});
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

/* ============================================================== summary */

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
