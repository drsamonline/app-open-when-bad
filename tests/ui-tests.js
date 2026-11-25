#!/usr/bin/env node
/* ui-tests — the Open-When-It-Is-Bad page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The engine has its own suite, including the countable done-means. This one proves the page is
 * wired to it: the crisis block is the first thing and carries the numbers, the script opens on
 * step one with no input, the plan opens in ONE click, four contacts appear with tel: links, the
 * plan survives a reload unchanged, an unreadable plan is reported on the front screen, and a
 * failed save blocks the close.
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0;
var failed = [];
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function build(seed) {
  var html = fs.readFileSync(PAGE, "utf8");
  var dom = new JSDOM(html, { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "nightwatch-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

var dom = build(null);
var w = dom.window;
var d = w.document;
var $ = function (id) { return d.getElementById(id); };

ok("the engine loaded into the page", !!w.NightwatchCore);

/* -------------------------------------------------- the crisis block, first */

var main = d.querySelector("main");
eq("the crisis block is the first thing in main", main.firstElementChild.id, "crisis");
ok("it states it is not a crisis service", /not a crisis service/.test($("crisisLine").textContent), $("crisisLine").textContent);
ok("it says it cannot tell whether you are in danger", /cannot tell whether you are in danger/.test($("crisisLine").textContent));
ok("the crisis numbers are shown", /14416/.test($("crisisNumbers").textContent) && /112/.test($("crisisNumbers").textContent),
  $("crisisNumbers").textContent);
ok("each crisis number is dialable", Array.prototype.every.call(d.querySelectorAll("#crisisNumbers a"), function (a) {
  return a.getAttribute("href").indexOf("tel:") === 0;
}));
ok("each is labelled as bundled", /bundled/.test($("crisisNumbers").textContent));

/* ---------------------------------------------------------- the script */

ok("the script opens on step one", /Sit down/.test($("stepTitle").textContent), $("stepTitle").textContent);
eq("the counter reads 1 of 9", $("counter").textContent, "1 of 9");
eq("back is disabled on the first step", $("prev").disabled, true);
ok("the script card has no input at all",
  d.querySelectorAll("#scriptCard input, #scriptCard textarea, #scriptCard select").length === 0);

$("next").click();
ok("next moves to step two", /Breathe out/.test($("stepTitle").textContent), $("stepTitle").textContent);
eq("the counter follows", $("counter").textContent, "2 of 9");
$("prev").click();
eq("back returns to step one", $("counter").textContent, "1 of 9");

/* ------------------------------------------------------------ the plan */

$("openPlanBtn").click();
ok("an empty plan says so rather than showing a blank plan", /no plan on this device yet/i.test($("planBody").textContent),
  $("planBody").textContent);

$("editBtn").click();
eq("the editor opens", $("editorCard").hidden, false);
eq("three sections are offered", d.querySelectorAll("#sections h2").length, 3);

function addStep(id, text) {
  $(id).value = text;
  var btns = d.querySelectorAll("#sections button");
  /* the Add button follows its input inside the same wrapper */
  var input = $(id);
  var wrap = input.parentNode;
  var add = Array.prototype.filter.call(wrap.querySelectorAll("button"), function (b) { return b.textContent === "Add"; })[0];
  add.click();
}
addStep("add-signs", "I stop answering messages and start sleeping in the day");
addStep("add-helps", "Call Aai, even if I do not want to talk");
addStep("add-say", "I am not doing well and I need company, not advice");

$("cLabel").value = "Asha (sister)"; $("cNumber").value = "+91 98765 43210"; $("addContact").click();
$("cLabel").value = "Ravi (friend)"; $("cNumber").value = "+91 98765 43211"; $("addContact").click();
$("cLabel").value = "Aai"; $("cNumber").value = "+91 98765 43212"; $("addContact").click();
$("cLabel").value = "Dr Kulkarni"; $("cNumber").value = "call the clinic landline"; $("addContact").click();

eq("four contacts are in the editor", d.querySelectorAll("#contactList .contact").length, 4);
ok("an unvalidatable number is kept as typed", /call the clinic landline/.test($("contactList").textContent),
  $("contactList").textContent);
ok("and marked as entered by the person", /as entered by you/.test($("contactList").textContent));
ok("the app says it did not change it", /was not changed|did not change it/.test($("status").textContent), $("status").textContent);

/* one action to open it */
$("openPlanBtn").click();
eq("the plan view appears", $("planViewCard").hidden, false);
ok("the steps are shown in the order written",
  $("planBody").textContent.indexOf("I stop answering messages") < $("planBody").textContent.indexOf("Call Aai"));
ok("the say line is shown", /I am not doing well/.test($("planBody").textContent));
eq("all four contacts are shown", d.querySelectorAll("#planBody .contact").length, 4);
ok("the contacts are dialable", Array.prototype.every.call(d.querySelectorAll("#planBody .contact a"), function (a) {
  return a.getAttribute("href").indexOf("tel:") === 0;
}));
ok("the number is displayed as typed", /\+91 98765 43210/.test($("planBody").textContent));

/* --------------------------------------------------------------- reload */

var saved = w.localStorage.getItem("nightwatch:plan");
ok("the plan was written to the device", !!saved);
var dom2 = build({ "nightwatch:plan": saved });
var d2 = dom2.window.document;
d2.getElementById("openPlanBtn").click();
eq("the reload keeps all four contacts", d2.querySelectorAll("#planBody .contact").length, 4);
ok("and the same steps", /I stop answering messages/.test(d2.getElementById("planBody").textContent));
ok("nothing is greyed out or expired after a reload",
  !/(expired|greyed|due for review|streak)/i.test(d2.getElementById("planBody").textContent));

/* ------------------------------------------------------------- the card */

$("cardBtn").click();
ok("the printed card is written", /Wrote open-when-it-is-bad-\d{4}-\d\d-\d\d\.txt/.test($("planNote").textContent),
  $("planNote").textContent);

/* ------------------------------------ a corrupt plan, reported on the front */

var dom3 = build({ "nightwatch:plan": "{ broken plan" });
var d3 = dom3.window.document;
ok("a corrupt plan is reported on the front screen", /cannot be read/.test(d3.getElementById("status").textContent),
  d3.getElementById("status").textContent);
ok("it says it was NOT replaced with an empty one", /NOT replaced with an empty one/.test(d3.getElementById("status").textContent));
ok("it mentions the printed card", /printed card/.test(d3.getElementById("status").textContent));
ok("it offers an export of the unreadable plan",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the unreadable plan/.test(b.textContent); }));
ok("it does not open an empty plan as a plan",
  (function () { d3.getElementById("openPlanBtn").click(); return /no plan on this device yet/i.test(d3.getElementById("planBody").textContent); })(),
  d3.getElementById("planBody").textContent);
ok("the corrupt file is not overwritten", /broken plan/.test(dom3.window.localStorage.getItem("nightwatch:plan")),
  dom3.window.localStorage.getItem("nightwatch:plan"));

/* --------------------------------------- a failed save says so and blocks */

var dom4 = build(null);
var w4 = dom4.window;
var d4 = dom4.window.document;
/* A full quota, from the page's point of view: every write throws. jsdom's storage is
 * proxy-backed, so the whole object is replaced rather than a method on it. */
Object.defineProperty(w4, "localStorage", {
  configurable: true,
  get: function () {
    return {
      getItem: function () { return null; },
      setItem: function () { var e = new Error("quota"); e.name = "QuotaExceededError"; throw e; },
      removeItem: function () {},
      clear: function () {}
    };
  }
});
d4.getElementById("cLabel").value = "Asha";
d4.getElementById("cNumber").value = "+91 98765 43210";
d4.getElementById("addContact").click();
ok("a failed save says NOT SAVED at once", /NOT SAVED:/.test(d4.getElementById("status").textContent),
  d4.getElementById("status").textContent);
ok("it names the cause", /storage is full/.test(d4.getElementById("status").textContent));
ok("it tells the person not to close the page", /Do not close this page/.test(d4.getElementById("status").textContent));
var blocked = false;
var ev = new w4.Event("beforeunload", { cancelable: true });
w4.dispatchEvent(ev);
blocked = ev.defaultPrevented;
ok("the close is blocked while the change is unsaved", blocked);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
dom.window.close(); dom2.window.close(); dom3.window.close(); dom4.window.close();
