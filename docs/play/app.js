/* app — the Open-When-It-Is-Bad page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the script, the plan, the contact handling and the corrupt-plan rules live in
 * nightwatch-core.js, which the tests exercise directly.
 *
 * Two promises this file keeps on its own:
 *   - if the save fails, the app says so IMMEDIATELY and blocks the close. A plan that looks
 *     saved and is not is the dangerous failure here.
 *   - the crisis block is filled from the engine and sits above everything; the script has no
 *     input on it at all, so it opens on step one with nothing to get wrong.
 */
(function () {
  "use strict";

  var N = window.NightwatchCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_PLAN = "nightwatch:plan";

  var els = {
    status: $("status"),
    crisisLine: $("crisisLine"), crisisNumbers: $("crisisNumbers"),
    stepTitle: $("stepTitle"), stepNote: $("stepNote"), prev: $("prev"), next: $("next"), counter: $("counter"),
    openPlanBtn: $("openPlanBtn"), editBtn: $("editBtn"), cardBtn: $("cardBtn"), planNote: $("planNote"),
    planViewCard: $("planViewCard"), planBody: $("planBody"),
    editorCard: $("editorCard"), sections: $("sections"),
    cLabel: $("cLabel"), cNumber: $("cNumber"), addContact: $("addContact"), contactNote: $("contactNote"), contactList: $("contactList")
  };

  var state = { plan: N.emptyPlan(), step: 0, dirty: false, unreadable: null };

  /* ------------------------------------------------------------- helpers */

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* A plan that appears saved and is not is dangerous: on a failed write the app says so at
   * once, and the page refuses to close while the change is unsaved. */
  function persist() {
    try {
      window.localStorage.setItem(K_PLAN, N.serializePlan(state.plan));
      state.dirty = false;
      return true;
    } catch (e) {
      state.dirty = true;
      setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") +
        ". Your change is on screen only. Do not close this page \u2014 export the card now, so you keep a copy that cannot be lost.");
      return false;
    }
  }

  window.addEventListener("beforeunload", function (e) {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = "Your plan change is not saved. Leaving now loses it.";
    return e.returnValue;
  });

  /* -------------------------------------------------------- crisis block */

  function renderCrisis() {
    els.crisisLine.textContent = N.NOT_A_SERVICE;
    els.crisisNumbers.textContent = "";
    N.BUNDLED_LINES.forEach(function (b) {
      var li = node("li");
      var a = document.createElement("a");
      a.href = N.telHref(b.number);
      a.textContent = b.number;
      li.appendChild(document.createTextNode(b.label + ": "));
      li.appendChild(a);
      li.appendChild(node("span", "note", b.note));
      els.crisisNumbers.appendChild(li);
    });
  }

  /* ------------------------------------------------------------- script */

  function renderStep() {
    var s = N.scriptStep(state.step);
    els.stepTitle.textContent = s.step.title;
    els.stepNote.textContent = s.step.note;
    els.counter.textContent = (s.index + 1) + " of " + s.total;
    els.prev.disabled = s.isFirst;
    els.next.textContent = s.isLast ? "Start again" : "Next step";
  }

  /* --------------------------------------------------------------- plan */

  function renderPlan() {
    var out = N.openPlan(state.plan);
    els.planViewCard.hidden = false;
    els.planBody.textContent = "";
    if (!out.ok) {
      els.planBody.appendChild(node("p", "empty", out.reason));
      return;
    }
    var v = out.view;
    [["Warning signs", v.signs], ["What helps", v.helps], ["What to say", v.say]].forEach(function (pair) {
      if (!pair[1].length) return;
      els.planBody.appendChild(node("h2", null, pair[0]));
      var ul = node("ul", "steps");
      pair[1].forEach(function (t, i) {
        var li = node("li");
        li.appendChild(node("span", "n", String(i + 1)));
        li.appendChild(node("span", "txt", t));
        ul.appendChild(li);
      });
      els.planBody.appendChild(ul);
    });
    if (v.contacts.length) {
      els.planBody.appendChild(node("h2", null, "Who to call"));
      v.contacts.forEach(function (c) {
        var box = node("div", "contact");
        var who = node("div", "who");
        who.appendChild(document.createTextNode(c.label));
        who.appendChild(node("span", "asent", c.note));
        box.appendChild(who);
        var a = document.createElement("a");
        a.href = c.href;
        a.textContent = c.number;
        box.appendChild(a);
        els.planBody.appendChild(box);
      });
    }
    setStatus("ok", out.says);
  }

  function renderEditor() {
    els.sections.textContent = "";
    N.KINDS.forEach(function (k) {
      var wrap = node("div");
      wrap.appendChild(node("h2", null, k.label));
      var ul = node("ul", "steps");
      state.plan[k.id].forEach(function (s, i) {
        var li = node("li");
        li.appendChild(node("span", "n", String(i + 1)));
        li.appendChild(node("span", "txt", s.text));
        var del = node("button", "small", "Remove");
        del.addEventListener("click", function () {
          var out = N.removeStep(state.plan, k.id, i);
          if (!out.ok) { setStatus("bad", out.reason); return; }
          state.plan = out.plan;
          persist();
          renderEditor();
        });
        li.appendChild(del);
        ul.appendChild(li);
      });
      wrap.appendChild(ul);

      var lab = node("label", "fld", k.hint);
      lab.setAttribute("for", "add-" + k.id);
      wrap.appendChild(lab);
      var inp = document.createElement("input");
      inp.type = "text";
      inp.id = "add-" + k.id;
      inp.placeholder = "One short line, in your own words";
      wrap.appendChild(inp);
      var btn = node("button", "small", "Add");
      btn.style.marginTop = "8px";
      btn.addEventListener("click", function () {
        var out = N.addStep(state.plan, k.id, inp.value, Date.now());
        if (!out.ok) { setStatus("bad", out.reason); return; }
        state.plan = out.plan;
        inp.value = "";
        var saved = persist();
        renderEditor();
        /* A failed save is never overwritten by a cheerful line: the warning stays. */
        if (saved) setStatus("ok", out.says);
      });
      wrap.appendChild(btn);
      els.sections.appendChild(wrap);
    });
    renderContacts();
  }

  function renderContacts() {
    els.contactList.textContent = "";
    state.plan.contacts.forEach(function (c) {
      var box = node("div", "contact");
      var who = node("div", "who");
      who.appendChild(document.createTextNode(c.label));
      who.appendChild(node("span", "asent", c.note));
      box.appendChild(who);
      var a = document.createElement("a");
      a.href = N.telHref(c.number);
      a.textContent = c.number;
      box.appendChild(a);
      els.contactList.appendChild(box);
    });
  }

  /* ------------------------------------------------------------- export */

  function writer(name, text, mime) {
    if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
    window.Export.save(name, text, mime);
    return true;
  }

  function printCard() {
    var out = N.exportFile("card", { plan: state.plan }, { when: today() }, writer);
    if (out.ok) {
      els.planNote.textContent = "Wrote " + out.filename + " \u2014 a copy that does not need this app.";
      setStatus("ok", "Card written. Keep it somewhere you would find it.");
    } else {
      setStatus("bad", out.reason + ".");
    }
  }

  /* ---------------------------------------------------------------- wire */

  renderCrisis();
  renderStep();

  els.prev.addEventListener("click", function () {
    if (state.step > 0) { state.step--; renderStep(); }
  });
  els.next.addEventListener("click", function () {
    if (state.step >= N.PANIC_STEPS.length - 1) { state.step = 0; renderStep(); return; }
    state.step++; renderStep();
  });

  els.openPlanBtn.addEventListener("click", renderPlan);
  els.editBtn.addEventListener("click", function () {
    els.editorCard.hidden = false;
    renderEditor();
    if (els.editorCard.scrollIntoView) els.editorCard.scrollIntoView({ block: "start" });
  });
  els.cardBtn.addEventListener("click", printCard);
  els.addContact.addEventListener("click", function () {
    var out = N.addContact(state.plan, { label: els.cLabel.value, number: els.cNumber.value }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.plan = out.plan;
    els.cLabel.value = "";
    els.cNumber.value = "";
    var saved = persist();
    renderEditor();
    /* A failed save is never overwritten by a cheerful line: the warning stays. */
    if (saved) setStatus("ok", out.says);
  });

  /* ------------------------------------------------------------ start up */

  var raw = null;
  try { raw = window.localStorage.getItem(K_PLAN); } catch (e) { raw = null; }
  if (raw) {
    var parsed = N.parsePlan(raw);
    if (parsed.ok) {
      state.plan = parsed.plan;
    } else {
      /* Reported on the FRONT SCREEN, offered for export, and never replaced by an empty
       * plan: an empty plan would look like a plan. */
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable plan");
      keep.addEventListener("click", function () {
        var out = N.exportFile("raw", parsed, { when: today() }, writer);
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.planNote.parentNode.insertBefore(keep, els.planNote);
      var fresh = node("button", "small", "Write a new plan, deliberately");
      fresh.addEventListener("click", function () {
        try { window.localStorage.removeItem(K_PLAN); } catch (e) { /* nothing to remove */ }
        state.plan = N.emptyPlan();
        state.unreadable = null;
        els.editorCard.hidden = false;
        renderEditor();
        setStatus("ok", "Starting a new plan, deliberately. The unreadable file is gone; your printed card, if you have one, is untouched.");
      });
      els.planNote.parentNode.insertBefore(fresh, els.planNote);
    }
  }

  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
