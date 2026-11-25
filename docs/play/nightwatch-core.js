/* nightwatch-core — the engine behind Open-When-Bad.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: be useful in the worst moment, with the fewest possible steps, and need nothing.
 * Both specs are that job:
 *
 *   the script   one instruction at a time, large, with nothing to fill in. It holds no
 *                state, so it cannot be corrupted and it opens on the first step.
 *   the plan     written once in a calm moment — warning signs, what helps, who to call,
 *                what to say — and opened by one action, offline, with no login. It is
 *                read back exactly as written, in the order it was written, however long
 *                it has been since it was last opened.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO: it does not assess risk, triage, diagnose, or
 * decide whether anyone is in danger, and it does not stand in for a crisis line. It says
 * so on the first screen, above everything else. Nothing here needs the network, an
 * account or a password.
 *
 * Pure functions: no DOM, no network, no storage. The page does the wiring.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NightwatchCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";

  /* Stated before anything else, and never softened. */
  var NOT_A_SERVICE = "This is not a crisis service, and it cannot tell whether you are in danger. If you are in danger now, call emergency services or a crisis line.";

  /* Bundled numbers are labelled as bundled and told to be checked. A number the app
   * cannot validate is never presented as verified, and a number the person types is
   * stored exactly as typed and marked "as entered by you". */
  var BUNDLED_LINES = [
    { region: "India", label: "Tele-MANAS (government mental-health helpline)", number: "14416", note: "bundled — check it is current for your state" },
    { region: "India", label: "Emergency services", number: "112", note: "bundled — check it is current for your state" }
  ];

  /* Panic Harbor: ONE instruction at a time, large. No medical advice, no diagnosis, no
   * input to get wrong. */
  var PANIC_STEPS = [
    { title: "Sit down, and put both feet on the floor.", note: "Nothing else yet. Just this." },
    { title: "Breathe out longer than you breathe in.", note: "In for four, out for six. Four times. That is all." },
    { title: "Name five things you can see.", note: "Out loud if you can. Slow." },
    { title: "Name four things you can touch.", note: "The chair, your sleeve, the floor, the air on your hand." },
    { title: "Name three things you can hear.", note: "Near ones, then far ones." },
    { title: "Name two things you can smell.", note: "If nothing comes, that is fine \u2014 say \u201cnothing yet\u201d." },
    { title: "Name one thing you can taste.", note: "Or take a sip of water." },
    { title: "Drink some water, slowly.", note: "Cold if you have it." },
    { title: "Now look at the plan you wrote.", note: "It is one button away, and it is yours." }
  ];

  /* --------------------------------------------------------------- the plan */

  var KINDS = [
    { id: "signs", label: "Warning signs", hint: "What you notice first, in your own words." },
    { id: "helps", label: "What helps", hint: "Things that have worked before, however small." },
    { id: "say", label: "What to say", hint: "A sentence you can read out when you cannot find words." }
  ];

  function kindById(id) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].id === id) return KINDS[i];
    return null;
  }

  function emptyPlan() {
    return { signs: [], helps: [], say: [], contacts: [], writtenAt: 0, updatedAt: 0 };
  }

  /* A step with no text is refused. Nothing is stored that a person cannot read back. */
  function addStep(plan, kindId, text, now) {
    var kind = kindById(kindId);
    if (!kind) return { ok: false, field: "kind", reason: "there is no section called \u201c" + kindId + "\u201d" };
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!t) return { ok: false, field: "text", reason: "a step with no text is refused: an empty line in a plan is worse than no line" };
    var next = clone(plan);
    next[kindId] = next[kindId].concat([{ text: t, at: now || 0 }]);
    next.updatedAt = now || 0;
    if (!next.writtenAt) next.writtenAt = now || 0;
    return { ok: true, plan: next, step: next[kindId][next[kindId].length - 1], says: "Added to " + kind.label + "." };
  }

  function removeStep(plan, kindId, index) {
    var kind = kindById(kindId);
    if (!kind) return { ok: false, reason: "there is no section called \u201c" + kindId + "\u201d" };
    var next = clone(plan);
    if (index < 0 || index >= next[kindId].length) return { ok: false, reason: "there is no step " + (index + 1) + " in " + kind.label };
    next[kindId].splice(index, 1);
    return { ok: true, plan: next };
  }

  /* A contact is stored EXACTLY as typed. The app does not add a country code, strip a
   * dash or "fix" a number it cannot validate — it marks it as the person's own. */
  function addContact(plan, contact, now) {
    var label = String((contact && contact.label) || "").replace(/\s+/g, " ").trim();
    var number = String((contact && contact.number) || "").trim();
    if (!label) return { ok: false, field: "label", reason: "a contact with no name is refused: in the worst moment a number with no name is not a contact" };
    if (!number) return { ok: false, field: "number", reason: "a contact with no number is refused" };
    var next = clone(plan);
    var looksDialable = /^[+0-9][0-9\s().-]{4,}$/.test(number);
    next.contacts = next.contacts.concat([{
      label: label,
      number: number,
      asEntered: true,
      looksDialable: looksDialable,
      note: looksDialable ? "as entered by you" : "as entered by you \u2014 this does not look like a phone number, and it was not changed",
      at: now || 0
    }]);
    next.updatedAt = now || 0;
    if (!next.writtenAt) next.writtenAt = now || 0;
    return {
      ok: true, plan: next, contact: next.contacts[next.contacts.length - 1],
      says: looksDialable
        ? "Saved as you entered it."
        : "Saved exactly as you entered it. It does not look like a phone number, and the app did not change it."
    };
  }

  /* Dialling needs a href. Only whitespace, brackets and dashes are stripped — nothing is
   * reordered, and nothing is added. */
  function telHref(number) {
    var n = String(number || "").replace(/[\s().-]/g, "");
    return n ? "tel:" + n : "";
  }

  /* The plan as it is shown. There is NO time in this output: no streak, no "last opened",
   * no review-due field, nothing that could grey out or reset after a month away. */
  function planView(plan) {
    var p = plan || emptyPlan();
    return {
      signs: p.signs.map(function (s) { return s.text; }),
      helps: p.helps.map(function (s) { return s.text; }),
      say: p.say.map(function (s) { return s.text; }),
      contacts: p.contacts.map(function (c) {
        return { label: c.label, number: c.number, href: telHref(c.number), asEntered: true, looksDialable: !!c.looksDialable, note: c.note };
      }),
      counts: {
        signs: p.signs.length, helps: p.helps.length, say: p.say.length, contacts: p.contacts.length
      },
      empty: !(p.signs.length || p.helps.length || p.say.length || p.contacts.length)
    };
  }

  /* One action, one boolean. There is no login, no PIN gate, no "are you sure". */
  function openPlan(plan) {
    var view = planView(plan);
    if (view.empty) {
      return { ok: false, reason: "there is no plan on this device yet. Write one in a calm moment \u2014 the script above works without it.", view: view };
    }
    return { ok: true, view: view, says: "Your plan, exactly as you wrote it." };
  }

  /* ------------------------------------------------------------- the script */

  function scriptStep(index) {
    var i = Math.max(0, Math.min(PANIC_STEPS.length - 1, Number(index) || 0));
    return {
      index: i,
      total: PANIC_STEPS.length,
      step: PANIC_STEPS[i],
      isFirst: i === 0,
      isLast: i === PANIC_STEPS.length - 1
    };
  }

  /* ------------------------------------------------------------- the card */

  function printableCard(plan, meta) {
    var v = planView(plan);
    var lines = ["OPEN WHEN IT IS BAD", ""];
    lines.push(NOT_A_SERVICE);
    lines.push("");
    lines.push("Crisis lines");
    BUNDLED_LINES.forEach(function (b) { lines.push("- " + b.label + ": " + b.number + " (" + b.note + ")"); });
    v.contacts.forEach(function (c) { lines.push("- " + c.label + ": " + c.number + " (" + c.note + ")"); });
    [["Warning signs", v.signs], ["What helps", v.helps], ["What to say", v.say]].forEach(function (pair) {
      if (!pair[1].length) return;
      lines.push("");
      lines.push(pair[0]);
      pair[1].forEach(function (t, i) { lines.push("  " + (i + 1) + ". " + t); });
    });
    lines.push("");
    lines.push("First aid, one step at a time");
    PANIC_STEPS.forEach(function (s, i) { lines.push("  " + (i + 1) + ". " + s.title); });
    if (meta && meta.when) { lines.push(""); lines.push("Printed " + meta.when + ". This card is a copy: if the app is gone, this is still yours."); }
    return lines.join("\n");
  }

  /* --------------------------------------------------------------- storage */

  function clone(p) {
    var src = p || emptyPlan();
    return {
      signs: (src.signs || []).map(function (s) { return { text: s.text, at: s.at || 0 }; }),
      helps: (src.helps || []).map(function (s) { return { text: s.text, at: s.at || 0 }; }),
      say: (src.say || []).map(function (s) { return { text: s.text, at: s.at || 0 }; }),
      contacts: (src.contacts || []).map(function (c) {
        return { label: c.label, number: c.number, asEntered: true, looksDialable: !!c.looksDialable, note: c.note, at: c.at || 0 };
      }),
      writtenAt: src.writtenAt || 0,
      updatedAt: src.updatedAt || 0
    };
  }

  function serializePlan(plan) {
    return JSON.stringify({
      version: VERSION,
      writtenAt: (plan && plan.writtenAt) || 0,
      updatedAt: (plan && plan.updatedAt) || 0,
      signs: (plan && plan.signs) || [],
      helps: (plan && plan.helps) || [],
      say: (plan && plan.say) || [],
      contacts: (plan && plan.contacts) || []
    }, null, 2);
  }

  /* An unreadable plan is REPORTED and offered for export. The app never opens an empty
   * plan in its place: an empty plan would look like a plan, which is the dangerous
   * failure this app has to avoid. */
  function parsePlan(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "no plan has been saved on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return {
        ok: false,
        reason: "The saved plan cannot be read. It was NOT replaced with an empty one. Export it to keep it, and if you have a printed card, that card still works.",
        raw: raw
      };
    }
    if (!data || typeof data !== "object") {
      return { ok: false, reason: "The saved plan is not a plan. It was not replaced with an empty one; export it to keep it.", raw: raw };
    }
    var out = emptyPlan();
    ["signs", "helps", "say"].forEach(function (k) {
      (Array.isArray(data[k]) ? data[k] : []).forEach(function (s) {
        if (s && typeof s.text === "string" && s.text.trim()) out[k].push({ text: s.text, at: Number(s.at) || 0 });
      });
    });
    (Array.isArray(data.contacts) ? data.contacts : []).forEach(function (c) {
      if (!c || !c.label || !c.number) return;
      out.contacts.push({
        label: String(c.label), number: String(c.number), asEntered: true,
        looksDialable: c.looksDialable !== false,
        note: c.note || "as entered by you", at: Number(c.at) || 0
      });
    });
    out.writtenAt = Number(data.writtenAt) || 0;
    out.updatedAt = Number(data.updatedAt) || 0;
    return { ok: true, plan: out, raw: raw };
  }

  /* ---------------------------------------------------------------- export */

  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "text/plain;charset=utf-8";
    if (what === "card") { name = "open-when-it-is-bad-" + stamp(meta.when) + ".txt"; body = printableCard(payload.plan, meta); }
    else if (what === "raw") { name = "open-when-it-is-bad-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    NOT_A_SERVICE: NOT_A_SERVICE,
    BUNDLED_LINES: BUNDLED_LINES,
    PANIC_STEPS: PANIC_STEPS,
    KINDS: KINDS,
    kindById: kindById,
    emptyPlan: emptyPlan,
    addStep: addStep,
    removeStep: removeStep,
    addContact: addContact,
    telHref: telHref,
    planView: planView,
    openPlan: openPlan,
    scriptStep: scriptStep,
    printableCard: printableCard,
    serializePlan: serializePlan,
    parsePlan: parsePlan,
    exportFile: exportFile
  };
});
