(function () {
  "use strict";

  var UNIT;
  try {
    UNIT = JSON.parse(document.getElementById("unit-data").textContent);
  } catch (e) {
    document.body.innerHTML = '<p style="padding:24px">שגיאה בטעינת היחידה. נא לפנות למורה.</p>';
    return;
  }

  var GIRLS = UNIT.audience === "girls", BOYS = UNIT.audience === "boys";
  function G(mixed, girls, boys) { return GIRLS ? girls : (BOYS && boys ? boys : mixed); }

  var GRADED = { mcq: 1, tf: 1, fill: 1 };
  var CHECKS = { mcq: 1, tf: 1, fill: 1, open: 1 };
  var MAX_TRIES = 2;
  var RATES = ["😀 הבנתי היטב", "🙂 הבנתי חלקית", G("😕 אני צריך/ה עזרה", "😕 אני צריכה עזרה", "😕 אני צריך עזרה")];
  var TEACHER = /[?&]view=teacher(?:&|$)/.test(location.search);
  var KEY = "lu:" + UNIT.id + ":v1" + (TEACHER ? ":teacher" : "");

  var state = load() || fresh();
  function fresh() {
    return { name: "", startedAt: null, finishedAt: null, screen: 0, answers: {}, exit: {}, selfRating: null };
  }
  function load() {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {  }
  }
  function ans(k) { return state.answers[k] || (state.answers[k] = { wrong: [], done: false, correct: false, firstTry: false, value: null }); }

  var N = UNIT.sections.length;
  var S_EXIT = N + 1, S_SUMMARY = N + 2, S_ENRICH = N + 3;
  var hasEnrich = !!(UNIT.enrichment && UNIT.enrichment.items && UNIT.enrichment.items.length);

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      if (a === "text") n.textContent = attrs[a];
      else if (a === "html") n.innerHTML = attrs[a];
      else if (a === "class") n.className = attrs[a];
      else if (a.slice(0, 2) === "on") n.addEventListener(a.slice(2), attrs[a]);
      else n.setAttribute(a, attrs[a]);
    }
    (kids || []).forEach(function (k) { if (k) n.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return n;
  }
  function norm(s) {
    return String(s || "")
      .replace(/[֑-ׇ]/g, "")           // niqqud & cantillation
      .replace(/[׳'`"״”“]/g, "")
      .replace(/\s*\/\s*/g, "/")               // "3 / 4" == "3/4"
      .replace(/[−–—]/g, "-")
      .replace(/[.,;:!?()]/g, " ")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  function minutesBetween(a, b) { return Math.max(1, Math.round((b - a) / 60000)); }
  function fmtTime(t) {
    try { return new Date(t).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }); }
    catch (e) { return new Date(t).toString(); }
  }

  var root = document.getElementById("root");
  var header = el("header", { class: "top" });
  var hInner = el("div", { class: "inner" });
  var titleEl = el("p", { class: "unit-title", text: UNIT.title });
  var bar = el("span");
  var progLabel = el("div", { class: "progress-label" });
  hInner.appendChild(titleEl);
  hInner.appendChild(el("div", { class: "progress", "aria-hidden": "true" }, [bar]));
  hInner.appendChild(progLabel);
  header.appendChild(hInner);
  var main = el("main", { class: "wrap", id: "main", tabindex: "-1" });
  var nav = el("nav", { class: "bottom" });
  var navInner = el("div", { class: "inner" });
  nav.appendChild(navInner);
  var live = el("div", { class: "sr", "aria-live": "polite" });
  root.appendChild(header); root.appendChild(main); root.appendChild(nav); root.appendChild(live);

  function go(i) {
    state.screen = i; save(); render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  function render() {
    main.innerHTML = ""; navInner.innerHTML = "";
    if (TEACHER) return renderTeacher();
    var s = state.screen;
    var pct = s === 0 ? 0 : Math.min(100, Math.round((Math.min(s, S_EXIT) / S_EXIT) * 100));
    bar.style.width = pct + "%";
    if (s === 0) progLabel.textContent = "פתיחה";
    else if (s <= N) progLabel.textContent = "חלק " + s + " מתוך " + N;
    else if (s === S_EXIT) progLabel.textContent = "כרטיס יציאה";
    else if (s === S_SUMMARY) progLabel.textContent = "סיכום";
    else progLabel.textContent = "משימת העשרה";

    if (s === 0) renderIntro();
    else if (s <= N) renderSection(s - 1);
    else if (s === S_EXIT) renderExit();
    else if (s === S_SUMMARY) renderSummary();
    else renderEnrichment();

    main.appendChild(el("div", { class: "footer-links" }, [
      el("button", { type: "button", text: "התחלה מחדש", onclick: function () {
        if (confirm("למחוק את כל התשובות ולהתחיל מההתחלה?")) { state = fresh(); save(); go(0); }
      } })
    ]));
  }

  function renderIntro() {
    var i = UNIT.intro || {};
    main.appendChild(el("h1", { text: UNIT.title }));
    var metaBits = [UNIT.subject, UNIT.grade ? "כיתה " + UNIT.grade : "", UNIT.minutes ? "כ-" + UNIT.minutes + " דקות" : ""].filter(Boolean);
    main.appendChild(el("p", { class: "meta", text: metaBits.join(" · ") }));
    if (i.html) main.appendChild(el("div", { class: "card", html: i.html }));
    if (i.goals && i.goals.length) {
      var ul = el("ul", { class: "goals" });
      i.goals.forEach(function (g) { ul.appendChild(el("li", { text: g })); });
      main.appendChild(el("div", { class: "card" }, [el("h3", { text: "בסוף השיעור תוכלו:" }), ul]));
    }
    var steps = (i.instructions && i.instructions.length) ? i.instructions : [
      "עברו על החלקים לפי הסדר. בכל חלק יש הסבר קצר ושאלות.",
      G("אם טעיתם – תקבלו רמז ותוכלו לנסות שוב.", "אם טעיתן – תקבלו רמז ותוכלו לנסות שוב."),
      "בסוף ממלאים כרטיס יציאה ומקבלים מסך סיכום."
    ];
    var ol = el("ol");
    steps.forEach(function (t) { ol.appendChild(el("li", { text: t })); });
    main.appendChild(el("div", { class: "card" }, [el("h3", { text: "איך עובדים:" }), ol]));

    var input = null;
    if (UNIT.askName !== false) {
      input = el("input", { type: "text", id: "nm", autocomplete: "off", value: state.name || "" });
      main.appendChild(el("div", { class: "card" }, [
        el("label", { for: "nm" }, [el("strong", { text: "השם שלך" })]),
        el("p", { class: "meta", text: "השם יופיע רק במסך הסיכום ונשמר רק במכשיר הזה." }),
        input
      ]));
    }
    var startBtn = el("button", { class: "btn", type: "button", text: state.startedAt ? "להמשיך" : "מתחילים", onclick: function () {
      if (input) state.name = input.value.trim();
      if (!state.startedAt) state.startedAt = Date.now();
      go(state.startedAt && state.screen > 0 ? state.screen : 1);
    } });
    function upd() { startBtn.disabled = !!input && input.value.trim().length < 2; }
    if (input) input.addEventListener("input", upd);
    upd();
    navInner.appendChild(el("span", { class: "gate-note", text: input ? G("כתבו את שמכם כדי להתחיל", "כתבו את שמכן כדי להתחיל") : "" }));
    navInner.appendChild(startBtn);
    if (input && startBtn.disabled) setTimeout(function () { input.focus(); }, 0);
  }

  var KIND = { text: "הסבר", tip: "טיפ", image: "איור", video: "סרטון", link: "קישור" };
  function renderItems(items, prefix, container, onChange, base) {
    var qn = 0, n = {};
    items.forEach(function (it, idx) {
      var k = prefix + "-" + idx, node;
      if (CHECKS[it.type]) { qn++; node = renderCheck(it, k, qn, onChange); }
      else node = renderBlock(it);
      if (base && node) {
        var isQ = !!CHECKS[it.type], c = isQ ? qn : (n[it.type] = (n[it.type] || 0) + 1);
        node.setAttribute("data-el", base.id + "." + (isQ ? "q" : it.type.charAt(0)) + c);
        node.insertBefore(el("div", { class: "t-label", text: base.he + " · " + (isQ ? "שאלה" : KIND[it.type] || "פריט") + " " + c }), node.firstChild);
      }
      container.appendChild(node);
    });
  }

  function renderBlock(b) {
    switch (b.type) {
      case "text": return el("div", { class: "card", html: b.html || "" });
      case "tip": return el("div", { class: "card tip", html: b.html || "" });
      case "image": {
        var f = el("figure");
        f.appendChild(el("img", { src: b.src, alt: b.alt || "", loading: "lazy" }));
        var cap = [b.caption, b.credit ? "מקור: " + b.credit : ""].filter(Boolean).join(" · ");
        if (cap) f.appendChild(el("figcaption", { text: cap }));
        return el("div", { class: "card" }, [f]);
      }
      case "video": {
        var v = el("div", { class: "video" }, [el("iframe", {
          src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(b.youtube) + (b.start ? "?start=" + (+b.start) : ""),
          title: b.caption || "סרטון", allow: "encrypted-media; picture-in-picture", allowfullscreen: "", loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin"
        })]);
        var c = el("div", { class: "card" }, [v]);
        if (b.caption) c.appendChild(el("p", { class: "meta", text: b.caption, style: "margin-top:8px" }));
        return c;
      }
      case "link": {
        return el("div", { class: "card" }, [el("a", { class: "ext-link", href: b.url, target: "_blank", rel: "noopener" }, [
          el("span", { text: "🔗" }),
          el("span", {}, [el("div", { class: "lbl", text: b.label || b.url }), b.source ? el("div", { class: "src", text: b.source }) : null])
        ])]);
      }
      default:
        if (window.console) console.warn("Unknown block type", b.type);
        return el("div");
    }
  }

  function renderCheck(q, k, qn, onChange) {
    var a = ans(k);
    var card = el("div", { class: "card check" });
    card.appendChild(el("div", { class: "q-label", text: "שאלה " + qn }));
    card.appendChild(el("div", { class: "prompt", text: q.prompt }));
    var fb = el("div", { class: "fb", role: "status" });

    function show(kind, text) {
      fb.className = "fb show " + kind; fb.innerHTML = "";
      text.forEach(function (t, i) { if (t) fb.appendChild(el(i === 0 ? "strong" : "div", { text: t })); });
      live.textContent = text.filter(Boolean).join(". ");
    }

    if (q.type === "mcq" || q.type === "tf") {
      var opts = q.type === "tf" ? ["נכון", "לא נכון"] : q.options;
      var correctIdx = q.type === "tf" ? (q.answer ? 0 : 1) : q.answer;
      var box = el("div", { class: "opts" });
      var btns = opts.map(function (o, i) {
        var b = el("button", { class: "opt", type: "button", text: o, dir: "auto" });
        b.addEventListener("click", function () { choose(i); });
        box.appendChild(b); return b;
      });
      function paint() {
        btns.forEach(function (b, i) {
          b.classList.toggle("wrong", a.wrong.indexOf(i) >= 0);
          b.classList.toggle("right", a.done && i === correctIdx);
          b.disabled = a.done || a.wrong.indexOf(i) >= 0;
        });
      }
      function choose(i) {
        if (a.done) return;
        if (i === correctIdx) {
          a.correct = true; a.done = true; a.firstTry = a.wrong.length === 0;
          show("ok", [a.firstTry ? "נכון! 🎉" : "נכון, יפה שניסית שוב!", q.explain]);
        } else {
          a.wrong.push(i);
          var per = q.feedback && q.feedback[String(i)];
          if (a.wrong.length >= MAX_TRIES) {
            a.done = true;
            show("neutral", ["התשובה הנכונה: " + opts[correctIdx] + " ✔", q.explain]);
          } else {
            show("hint", ["עוד לא. נסו שוב.", per || null, q.hint ? "רמז: " + q.hint : null]);
          }
        }
        paint(); save(); onChange();
      }
      card.appendChild(box);
      paint();
      if (a.done) show(a.correct ? "ok" : "neutral", [a.correct ? "נכון!" : "התשובה הנכונה: " + opts[correctIdx] + " ✔", q.explain]);
    }

    else if (q.type === "fill") {
      var inp = el("input", { type: "text", autocomplete: "off", value: a.value || "", "aria-label": q.prompt, dir: "auto" });
      var btn = el("button", { class: "btn small", type: "button", text: "בדיקה" });
      function check() {
        if (a.done || !inp.value.trim()) return;
        a.value = inp.value.trim();
        var ok = (q.accept || []).some(function (x) { return norm(x) === norm(a.value); });
        if (ok) {
          a.correct = true; a.done = true; a.firstTry = a.wrong.length === 0;
          show("ok", ["נכון! 🎉", q.explain]);
        } else {
          a.wrong.push(a.value);
          if (a.wrong.length >= MAX_TRIES) {
            a.done = true;
            show("neutral", ["התשובה הנכונה: " + q.accept[0], q.explain]);
          } else show("hint", ["עוד לא. נסו שוב.", q.hint ? "רמז: " + q.hint : null]);
        }
        inp.disabled = btn.disabled = a.done; save(); onChange();
      }
      btn.addEventListener("click", check);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
      card.appendChild(inp);
      card.appendChild(el("div", { class: "row" }, [btn]));
      inp.disabled = btn.disabled = a.done;
      if (a.done) show(a.correct ? "ok" : "neutral", [a.correct ? "נכון!" : "התשובה הנכונה: " + q.accept[0], q.explain]);
    }

    else if (q.type === "open") {
      var ta = el("textarea", { "aria-label": q.prompt, placeholder: G("כתבו כאן את התשובה שלכם", "כתבו כאן את התשובה שלכן"), dir: "auto" });
      ta.value = a.value || "";
      var reveal = el("button", { class: "btn small", type: "button", text: q.model ? "שמירה והצגת תשובה לדוגמה" : "שמירה" });
      function upd() { reveal.disabled = a.done || ta.value.trim().length < 5; }
      ta.addEventListener("input", function () { a.value = ta.value; save(); upd(); });
      reveal.addEventListener("click", function () {
        a.value = ta.value.trim(); a.done = true; ta.disabled = true; upd();
        show("neutral", q.model ? ["תשובה לדוגמה – השוו לתשובה שלכם:", q.model] : ["נשמר ✔"]);
        save(); onChange();
      });
      card.appendChild(ta);
      if (q.hint) card.appendChild(el("p", { class: "meta", text: "רמז: " + q.hint, style: "margin-top:8px" }));
      card.appendChild(el("div", { class: "row" }, [reveal]));
      ta.disabled = a.done; upd();
      if (a.done) show("neutral", q.model ? ["תשובה לדוגמה – השוו לתשובה שלכם:", q.model] : ["נשמר ✔"]);
    }

    card.appendChild(fb);
    return card;
  }

  function allDone(items, prefix) {
    return items.every(function (it, idx) { return !CHECKS[it.type] || ans(prefix + "-" + idx).done; });
  }

  function renderSection(i) {
    var sec = UNIT.sections[i], prefix = "s" + i;
    main.appendChild(el("h2", { text: sec.title }));
    if (sec.minutes) main.appendChild(el("p", { class: "meta", text: "זמן משוער: " + sec.minutes + " דקות" }));
    var nextBtn = el("button", { class: "btn", type: "button", text: i === N - 1 ? "לכרטיס היציאה" : "הבא" });
    var note = el("span", { class: "gate-note" });
    function gate() {
      var ok = allDone(sec.items, prefix);
      nextBtn.disabled = !ok;
      note.textContent = ok ? "" : "ענו על כל השאלות כדי להמשיך";
    }
    renderItems(sec.items, prefix, main, gate);
    nextBtn.addEventListener("click", function () { go(i + 2); });
    navInner.appendChild(el("button", { class: "btn ghost", type: "button", text: "הקודם", onclick: function () { go(i); } }));
    navInner.appendChild(note);
    navInner.appendChild(nextBtn);
    gate();
  }

  function renderExit() {
    var ex = UNIT.exit || {};
    main.appendChild(el("h2", { text: "כרטיס יציאה" }));
    main.appendChild(el("p", { class: "meta", text: "כמה שאלות קצרות לסיום. התשובות יופיעו במסך הסיכום." }));
    var finish = el("button", { class: "btn", type: "button", text: "סיום והצגת סיכום" });
    var note = el("span", { class: "gate-note" });
    var prompts = ex.prompts || [];
    var tas = prompts.map(function (p, i) {
      var ta = el("textarea", { "aria-label": p });
      ta.value = state.exit[i] || "";
      ta.addEventListener("input", function () { state.exit[i] = ta.value; save(); gate(); });
      main.appendChild(el("div", { class: "card" }, [el("div", { class: "prompt", text: p, style: "font-weight:700;margin-bottom:10px" }), ta]));
      return ta;
    });
    var rateBox = null;
    if (ex.selfRating !== false) {
      var labels = RATES;
      rateBox = el("div", { class: "opts self-rate" });
      labels.forEach(function (l, i) {
        var b = el("button", { class: "opt" + (state.selfRating === i ? " right" : ""), type: "button", text: l });
        b.addEventListener("click", function () { state.selfRating = i; save(); render(); });
        rateBox.appendChild(b);
      });
      main.appendChild(el("div", { class: "card" }, [el("div", { text: "איך הרגשתי עם החומר?", style: "font-weight:700;margin-bottom:10px" }), rateBox]));
    }
    function gate() {
      var ok = tas.every(function (t) { return t.value.trim().length >= 3; }) && (ex.selfRating === false || state.selfRating !== null);
      finish.disabled = !ok;
      note.textContent = ok ? "" : "ענו על כל השאלות כדי לסיים";
    }
    finish.addEventListener("click", function () { if (!state.finishedAt) state.finishedAt = Date.now(); go(S_SUMMARY); });
    navInner.appendChild(el("button", { class: "btn ghost", type: "button", text: "הקודם", onclick: function () { go(N); } }));
    navInner.appendChild(note);
    navInner.appendChild(finish);
    gate();
  }

  function scoreFor(items, prefix) {
    var total = 0, first = 0, eventually = 0;
    items.forEach(function (it, idx) {
      if (!GRADED[it.type]) return;
      total++; var a = ans(prefix + "-" + idx);
      if (a.firstTry) first++;
      if (a.correct) eventually++;
    });
    return { total: total, first: first, eventually: eventually };
  }

  function summaryText() {
    var lines = [UNIT.title, "שם: " + (state.name || "-"), "סיום: " + fmtTime(state.finishedAt || Date.now())];
    var tot = { total: 0, first: 0 };
    UNIT.sections.forEach(function (s, i) {
      var r = scoreFor(s.items, "s" + i); tot.total += r.total; tot.first += r.first;
      if (r.total) lines.push(s.title + ": " + r.first + "/" + r.total + " בניסיון ראשון");
    });
    lines.push("סה״כ: " + tot.first + "/" + tot.total);
    (UNIT.exit && UNIT.exit.prompts || []).forEach(function (p, i) { lines.push(p + " — " + (state.exit[i] || "")); });
    if (state.selfRating !== null) lines.push("הרגשה: " + RATES[state.selfRating]);
    return lines.join("\n");
  }

  function renderSummary() {
    var tot = { total: 0, first: 0, eventually: 0 };
    var rows = UNIT.sections.map(function (s, i) {
      var r = scoreFor(s.items, "s" + i);
      tot.total += r.total; tot.first += r.first; tot.eventually += r.eventually;
      return el("tr", {}, [el("td", { text: s.title }), el("td", { text: r.total ? r.first + " / " + r.total : "—" })]);
    });
    main.appendChild(el("h1", { text: "כל הכבוד, סיימת! 🎉" }));
    var card = el("div", { class: "card summary" });
    card.appendChild(el("p", { class: "meta", text: (state.name ? state.name + " · " : "") + fmtTime(state.finishedAt || Date.now()) +
      (state.startedAt && state.finishedAt ? " · " + minutesBetween(state.startedAt, state.finishedAt) + " דקות" : "") }));
    card.appendChild(el("div", { class: "big-score", text: tot.first + " / " + tot.total }));
    card.appendChild(el("p", { class: "meta", text: "תשובות נכונות בניסיון הראשון" }));
    var table = el("table", {}, [el("tr", {}, [el("th", { text: "חלק" }), el("th", { text: "ניסיון ראשון" })])].concat(rows));
    card.appendChild(table);
    var prompts = (UNIT.exit && UNIT.exit.prompts) || [];
    if (prompts.length) {
      card.appendChild(el("h3", { text: "כרטיס יציאה" }));
      prompts.forEach(function (p, i) {
        card.appendChild(el("p", {}, [el("strong", { text: p }), el("br"), document.createTextNode(state.exit[i] || "")]));
      });
    }
    if (state.selfRating !== null) card.appendChild(el("p", {}, [el("strong", { text: "איך הרגשתי: " }), document.createTextNode(RATES[state.selfRating])]));
    if (state.enrichDone) card.appendChild(el("p", { text: "⭐ השלמת גם את משימת ההעשרה" }));
    main.appendChild(card);

    main.appendChild(el("div", { class: "card tip", html: "" }, [document.createTextNode(UNIT.summaryInstruction || "צלמו את המסך או לחצו על \"העתקת הסיכום כטקסט\", ושלחו למורה.")]));
    var copyBtn = el("button", { class: "btn ghost small", type: "button", text: "העתקת הסיכום כטקסט" });
    copyBtn.addEventListener("click", function () {
      var t = summaryText();
      function done() { copyBtn.textContent = "הועתק ✔"; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
      function fallback() {
        var ta = el("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (e) {} document.body.removeChild(ta);
      }
    });
    main.appendChild(el("div", { class: "row" }, [copyBtn]));
    try { renderSend(); } catch (e) {  }

    navInner.appendChild(el("button", { class: "btn ghost", type: "button", text: "הקודם", onclick: function () { go(S_EXIT); } }));
    navInner.appendChild(el("span", { class: "gate-note" }));
    if (hasEnrich) navInner.appendChild(el("button", { class: "btn", type: "button", text: state.enrichDone ? "חזרה להעשרה" : "נשאר לי זמן ⭐", onclick: function () { go(S_ENRICH); } }));
  }

  function classCode() {
    var m = /[?&]k=([A-Z2-7]{10})(?:&|$)/.exec(location.search);
    return m ? m[1] : null;
  }
  function apiBase() {
    var m = document.querySelector('meta[name="kc-api"]');
    var v = m && m.getAttribute("content");
    return v && /^https:\/\//.test(v) ? v.replace(/\/+$/, "") : null;
  }
  function sendPayload(nickname) {
    var results = [];
    function collect(items, prefix) {
      items.forEach(function (it, idx) {
        if (!CHECKS[it.type]) return;
        var k = prefix + "-" + idx, a = ans(k);
        results.push({ k: k, t: it.type, c: !!a.correct, f: !!a.firstTry, v: a.value == null ? "" : String(a.value).slice(0, 1000) });
      });
    }
    UNIT.sections.forEach(function (s, i) { collect(s.items, "s" + i); });
    if (hasEnrich) collect(UNIT.enrichment.items, "e");
    var exit = ((UNIT.exit && UNIT.exit.prompts) || []).map(function (p, i) { return { p: p, a: String(state.exit[i] || "").slice(0, 1000) }; });
    return { code: classCode(), unit: UNIT.id, nickname: nickname, results: results, exit: exit };
  }
  function renderSend() {
    var code = classCode(), api = apiBase();
    if (!code || !api || !window.fetch) return;
    var card = el("div", { class: "card" });
    card.appendChild(el("h3", { text: "שליחה למורה" }));
    card.appendChild(el("p", { class: "meta", text: G("מה נשלח: הכינוי שתכתבו, התשובות והציון ביחידה הזו – רק למורה של הכיתה. השם שכתבתם בהתחלה לא נשלח.",
      "מה נשלח: הכינוי שתכתבי, התשובות והציון ביחידה הזו – רק למורה של הכיתה. השם שכתבת בהתחלה לא נשלח.",
      "מה נשלח: הכינוי שתכתוב, התשובות והציון ביחידה הזו – רק למורה של הכיתה. השם שכתבת בהתחלה לא נשלח.") }));
    var label = el("label", { for: "nick", text: "כינוי (לא שם מלא!)" });
    var input = el("input", { type: "text", id: "nick", maxlength: "30", autocomplete: "off", value: state.nick || "" });
    var btn = el("button", { class: "btn", type: "button", text: state.sentAt ? "שליחה שוב" : "שליחה" });
    var msg = el("p", { class: "meta", text: state.sentAt ? "נשלח ✔ " + fmtTime(state.sentAt) : "" });
    function upd() { btn.disabled = input.value.trim().length < 2; }
    input.addEventListener("input", function () { state.nick = input.value; save(); upd(); });
    btn.addEventListener("click", function () {
      btn.disabled = true; msg.textContent = "שולח…";
      fetch(api + "/api/exit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sendPayload(input.value.trim())) })
        .then(function (r) {
          if (r.status === 201) { state.sentAt = Date.now(); save(); msg.textContent = "נשלח ✔ " + fmtTime(state.sentAt); btn.textContent = "שליחה שוב"; }
          else if (r.status === 403) msg.textContent = "הכיתה הזו עדיין לא פתוחה לשליחה. אפשר להעתיק את הסיכום ולשלוח למורה בדרך אחרת.";
          else if (r.status === 429 || r.status === 503) msg.textContent = "יש עכשיו עומס. נסו שוב בעוד כמה דקות, או העתיקו את הסיכום ושלחו למורה.";
          else msg.textContent = "השליחה לא הצליחה. אפשר לנסות שוב, או להעתיק את הסיכום ולשלוח למורה.";
        }, function () { msg.textContent = "אין חיבור. אפשר לנסות שוב, או להעתיק את הסיכום ולשלוח למורה."; })
        .then(upd);
    });
    card.appendChild(label); card.appendChild(input);
    card.appendChild(el("div", { class: "row" }, [btn])); card.appendChild(msg);
    main.appendChild(card);
    upd();
  }

  function renderTeacher() {
    bar.style.width = "100%";
    progLabel.textContent = "תצוגה למורה";
    main.appendChild(el("p", { class: "t-banner", text: "תצוגה למורה: כל היחידה בעמוד אחד. התוויות הצהובות מופיעות רק כאן, לא אצל התלמידים." }));
    UNIT.sections.forEach(function (sec, i) {
      var box = el("section", { "data-el": "s" + (i + 1) });
      box.appendChild(el("div", { class: "t-label", text: "חלק " + (i + 1) }));
      box.appendChild(el("h2", { text: sec.title }));
      renderItems(sec.items, "s" + i, box, function () {}, { he: "חלק " + (i + 1), id: "s" + (i + 1) });
      main.appendChild(box);
    });
    var ex = el("section", { "data-el": "exit" });
    ex.appendChild(el("h2", { text: "כרטיס יציאה" }));
    ((UNIT.exit && UNIT.exit.prompts) || []).forEach(function (p, j) {
      ex.appendChild(el("div", { class: "card", "data-el": "exit.q" + (j + 1) }, [el("div", { class: "t-label", text: "כרטיס יציאה · שאלה " + (j + 1) }), el("div", { text: p })]));
    });
    main.appendChild(ex);
    if (hasEnrich) {
      var en = el("section", { "data-el": "e" });
      en.appendChild(el("h2", { text: "⭐ " + (UNIT.enrichment.title || "משימת העשרה") }));
      renderItems(UNIT.enrichment.items, "e", en, function () {}, { he: "העשרה", id: "e" });
      main.appendChild(en);
    }
  }

  function renderEnrichment() {
    if (!hasEnrich) { go(S_SUMMARY); return; }
    var en = UNIT.enrichment;
    main.appendChild(el("h2", { text: "⭐ " + (en.title || "משימת העשרה") }));
    main.appendChild(el("p", { class: "meta", text: G("למי שסיים/ה מוקדם. לא חובה.", "למי שסיימה מוקדם. לא חובה.", "למי שסיים מוקדם. לא חובה.") }));
    var back = el("button", { class: "btn", type: "button", text: "חזרה לסיכום" });
    function gate() { if (allDone(en.items, "e")) { state.enrichDone = true; save(); } }
    renderItems(en.items, "e", main, gate);
    back.addEventListener("click", function () { go(S_SUMMARY); });
    navInner.appendChild(el("span", { class: "gate-note" }));
    navInner.appendChild(back);
  }

  if (state.screen > S_ENRICH || (state.screen === S_ENRICH && !hasEnrich)) state.screen = 0;
  if (state.screen > 0 && !state.startedAt) state.screen = 0;
  render();
})();
