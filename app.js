(() => {
  "use strict";

  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  const stageQuery = window.matchMedia("(min-width: 960px) and (min-height: 540px)");
  const $ = (id) => document.getElementById(id);

  const stage = $("deck");
  const deckFrame = $("deck-frame");
  const tocDialog = $("toc-dialog");
  const dialogNav = $("dialog-nav");
  const lightbox = $("lightbox");
  const prevButton = $("prev-button");
  const nextButton = $("next-button");

  const chapters = {
    "0": { index: "Opening", name: "D-Robotics Frontier #02", short: "Opening" },
    "1": { index: "01", name: "Results first", short: "01 Results" },
    "2": { index: "02", name: "The problem", short: "02 Problem" },
    "3": { index: "03", name: "Method", short: "03 Method" },
    "4": { index: "04", name: "Evidence", short: "04 Evidence" },
    "5": { index: "05", name: "Wrap-up", short: "05 Wrap-up" }
  };

  let current = 0;
  let isStage = stageQuery.matches;

  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const titleOf = (i) => slides[i].dataset.title || "";
  const notesOf = (i) => (slides[i].querySelector(".notes")?.textContent || "").trim();

  function indexFromHash() {
    const m = location.hash.match(/slide-(\d{1,2})/i);
    return m ? clamp(Number(m[1]) - 1, 0, total - 1) : 0;
  }

  /* ---------------------------------------------------------------- layout */
  function fit() {
    if (isStage) {
      const r = stage.getBoundingClientRect();
      const full = document.documentElement.classList.contains("is-fullscreen") || document.documentElement.classList.contains("is-clean");
      const px = full ? 0 : (r.width < 1300 ? 16 : 28);
      const py = full ? 0 : 12;
      const s = Math.min((r.width - px) / 1200, (r.height - py) / 675, full ? 4 : 1.8);
      deckFrame.style.setProperty("--deck-scale", Math.max(0.3, s).toFixed(4));
    } else {
      document.querySelectorAll(".slide-shell").forEach((shell) => {
        shell.style.setProperty("--doc-scale", (shell.clientWidth / 1200).toFixed(4));
      });
    }
  }

  /* ---------------------------------------------------------------- media */
  function slideVideos(i) { return Array.from(slides[i].querySelectorAll("video")); }

  function activateMedia(i) {
    slideVideos(i).forEach((v) => {
      const mode = v.dataset.autoplay;
      if (mode === "loop") {
        v.muted = true;
        try { v.currentTime = 0; } catch (e) { /* not loaded yet */ }
        v.play().catch(() => {});
      } else if (mode === "sound") {
        const activated = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
        if (activated && v.currentTime === 0) v.play().catch(() => {});
      }
    });
  }
  function pauseMedia(i) { slideVideos(i).forEach((v) => { if (!v.paused) v.pause(); }); }

  function togglePrimaryVideo() {
    const vids = slideVideos(current);
    if (!vids.length) return false;
    const main = vids.find((v) => v.dataset.autoplay === "sound") || null;
    if (main) { if (main.paused) main.play().catch(() => {}); else main.pause(); return true; }
    const anyPlaying = vids.some((v) => !v.paused);
    vids.forEach((v) => { if (anyPlaying) v.pause(); else v.play().catch(() => {}); });
    return true;
  }

  function initDemo() {
    document.querySelectorAll("[data-demo]").forEach((box) => {
      const v = box.querySelector("video");
      const btn = box.querySelector("[data-play]");
      btn.addEventListener("click", () => { v.muted = false; v.play().catch(() => {}); btn.blur(); });
      v.addEventListener("play", () => { box.classList.add("is-started"); v.controls = true; });
      v.addEventListener("ended", () => { box.classList.remove("is-started"); v.controls = false; });
    });
  }


  /* ---------------------------------------------------------------- motion (see "Motion system" in styles.css) */
  const MOTION_OK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CASCADE = ".pill, .data-table tr, .num-list > li, .dot-list > li, .rssm-row, .zero, .qr, .vcap";
  const UNIT = [
    ".eyebrow", "h1", "h2", ".lede", ".cover-kicker", ".cover-q", ".cover-rule", ".cover-who", ".cover-with", ".cover-foot",
    ".about-copy > p", ".about-visual", ".frontier .more", ".session-band",
    ".vtile", ".zoomable", ".fig figcaption", ".f3-legend", ".wm-scale",
    ".card", ".see-right .cap", ".real-side > .label", ".real-side > .stat-num", ".real-side > .stat-label", ".foot-note",
    ".chart-card", ".paper-link", ".thanks-word", ".thanks-qa", ".thanks-bottom", ".play-overlay .pg", ".play-overlay .pt",
    CASCADE
  ].join(",");
  const BACKDROP = ".cover-photo, .thanks-glow, .fullbleed video, .brand-mark";
  const HEAD = ".cover-kicker, .cover-title, .cover-q, .cover-rule, .cover-who, .cover-with";
  const DUR = { rise: 600, title: 720, slide: 540, fade: 500, lift: 580, mask: 800, punch: 620, draw: 650, pop: 620, kenburns: 1800 };
  const COUNTERS = ".stat-num, .zero .v, h2 .hl";
  let counterTimers = [];

  function kindOf(el) {
    if (el.matches("h1, h2, .thanks-word")) return "title";
    if (el.matches(".cover-rule")) return "draw";
    if (el.matches(".play-overlay .pg")) return "pop";
    if (el.matches(".vtile, .zoomable, .about-visual")) return "mask";
    if (el.matches("[data-punch]")) return "punch";
    if (el.matches(".eyebrow, tr, .rssm-row, .num-list > li, .dot-list > li")) return "slide";
    if (el.matches(".pill, .zero, .qr")) return "lift";
    if (el.matches(".vcap, figcaption, .foot-note, .cap, .wm-scale, .cover-foot, .paper-link, .play-overlay .pt, .f3-legend")) return "fade";
    return "rise";
  }
  function cue(el, kind, delay, dur) {
    el.dataset.dk = kind;
    el.style.setProperty("--dk-delay", `${Math.round(delay)}ms`);
    el.style.setProperty("--dk-dur", `${dur || DUR[kind]}ms`);
  }
  function choreograph(slide) {
    const all = Array.from(slide.querySelectorAll(UNIT));
    const pool = new Set(all);
    const inPool = (el) => { for (let p = el.parentElement; p && p !== slide; p = p.parentElement) if (pool.has(p)) return true; return false; };
    const units = all.filter((el) => el.matches(CASCADE) || !inPool(el));
    const head = [], body = [], punch = [];
    units.forEach((el) => {
      if (el.matches("[data-punch]")) punch.push(el);
      else if (el.closest(".slide-head") || el.matches(HEAD) || (el.matches(".eyebrow, h1, h2, .lede") && !el.closest(".body"))) head.push(el);
      else body.push(el);
    });
    head.forEach((el, i) => cue(el, kindOf(el), 60 + i * 80));
    const start = head.length ? 60 + head.length * 80 + 20 : 120;
    const step = body.length > 1 ? Math.max(30, Math.min(75, 900 / (body.length - 1))) : 0;
    body.forEach((el, i) => cue(el, kindOf(el), start + i * step));
    const end = body.length ? start + (body.length - 1) * step + 300 : start;
    punch.forEach((el, i) => cue(el, "punch", end + 100 + i * 120));
    slide.querySelectorAll(BACKDROP).forEach((el) => {
      if (el.matches(".cover-photo")) cue(el, "kenburns", 0);
      else cue(el, "fade", 0, el.matches(".thanks-glow") ? 1400 : 700);
    });
    const delayOf = (el) => { const u = el.closest("[data-dk]"); return u ? parseFloat(u.style.getPropertyValue("--dk-delay")) || 0 : 0; };
    slide.querySelectorAll(COUNTERS).forEach((el) => {
      const m = el.textContent.trim().match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/);
      if (!m || Number(m[2]) === 0 || /[<>≥≤]/.test(m[1])) return;   // thresholds are not measurements: no count-up
      el.dataset.final = el.textContent;
      el.dataset.countDelay = String(delayOf(el) + 120);
    });
    const chart = slide.querySelector(".chart-card");
    if (chart) {
      const d = delayOf(chart);
      chart.querySelectorAll(".bar, .val").forEach((n) => {
        const bd = d + 220 + Number(n.dataset.k) * 42;
        if (n.classList.contains("bar")) n.style.setProperty("--bd", `${bd}ms`);
        else n.style.setProperty("--vd", `${bd + 520}ms`);
      });
      chart.querySelectorAll(".grid, .axis").forEach((n) => n.style.setProperty("--gd", `${d + 120}ms`));
    }
    const word = slide.querySelector(".thanks-word");
    if (word) word.style.setProperty("--dot-delay", `${delayOf(word) + 760}ms`);
  }

  function stopCounters() {
    counterTimers.forEach((t) => { clearTimeout(t.timeout); cancelAnimationFrame(t.raf); t.el.textContent = t.el.dataset.final; });
    counterTimers = [];
  }
  function runCounters(slide) {
    slide.querySelectorAll("[data-final]").forEach((el) => {
      const m = el.dataset.final.trim().match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/);
      const to = Number(m[2]);
      const dec = (m[2].split(".")[1] || "").length;
      const fmt = (v) => `${m[1]}${v.toFixed(dec)}${m[3]}`;
      el.textContent = fmt(0);
      const t = { el, raf: 0, timeout: 0 };
      t.timeout = setTimeout(() => {
        const t0 = performance.now(), dur = 1000;
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = p < 1 ? fmt(to * e) : el.dataset.final;
          if (p < 1) t.raf = requestAnimationFrame(step);
        };
        t.raf = requestAnimationFrame(step);
      }, Number(el.dataset.countDelay) || 0);
      counterTimers.push(t);
    });
  }
  function enter(i, animate) {
    const s = slides[i];
    stopCounters();
    s.classList.remove("is-animating");
    if (!(animate && MOTION_OK && isStage)) return;
    void s.offsetWidth;            // restart the CSS animations
    s.classList.add("is-animating");
    runCounters(s);
  }

  /* ---------------------------------------------------------------- navigation */
  function updateChrome() {
    const s = slides[current];
    const meta = chapters[s.dataset.chapter] || chapters["0"];
    const bar = document.querySelector(".topbar-chapter");
    if ($("chapter-index").textContent !== meta.index) {
      bar.classList.remove("is-swapping"); void bar.offsetWidth; bar.classList.add("is-swapping");
    }
    $("chapter-index").textContent = meta.index;
    $("chapter-name").textContent = meta.name;
    $("foot-chapter").textContent = meta.short;
    $("foot-title").textContent = titleOf(current);
    $("page-current").textContent = pad(current + 1);
    $("top-progress-fill").style.transform = `scaleX(${(current + 1) / total})`;
    prevButton.disabled = current === 0;
    nextButton.disabled = current === total - 1;
    document.title = `${titleOf(current)} · WM-LOCO · D-Robotics Frontier #02`;
    dialogNav.querySelectorAll(".dialog-link").forEach((a) => {
      const on = Number(a.dataset.goto) - 1 === current;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    renderNotes();
  }

  function syncSlides() {
    slides.forEach((s, i) => {
      const on = i === current;
      s.classList.toggle("is-active", on);
      if (isStage) { s.setAttribute("aria-hidden", on ? "false" : "true"); s.inert = !on; }
      else { s.removeAttribute("aria-hidden"); s.inert = false; }
    });
  }

  function goTo(index, { push = true, scroll = true } = {}) {
    const target = clamp(index, 0, total - 1);
    const previous = current;
    if (target !== current) { pauseMedia(current); slides[current].classList.remove("is-animating"); }
    current = target;
    syncSlides();
    updateChrome();
    if (push) history.replaceState(null, "", `#slide-${pad(current + 1)}`);
    if (target !== previous) enter(target, target !== previous - 1);
    if (isStage) activateMedia(current);
    else if (scroll) slides[current].closest(".slide-shell").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  /* ---------------------------------------------------------------- contents + lightbox */
  function buildToc() {
    const frag = document.createDocumentFragment();
    Object.keys(chapters).forEach((key) => {
      const group = slides.filter((s) => s.dataset.chapter === key);
      if (!group.length) return;
      const sec = document.createElement("section");
      sec.className = "dialog-group";
      const h = document.createElement("h3");
      h.textContent = key === "0" ? "Opening" : `${chapters[key].index} ${chapters[key].name}`;
      sec.appendChild(h);
      group.forEach((s) => {
        const i = slides.indexOf(s);
        const a = document.createElement("a");
        a.className = "dialog-link";
        a.href = `#slide-${pad(i + 1)}`;
        a.dataset.goto = String(i + 1);
        const n = document.createElement("span"); n.textContent = pad(i + 1);
        const t = document.createElement("b"); t.style.fontWeight = "inherit"; t.textContent = titleOf(i);
        a.append(n, t);
        a.addEventListener("click", (e) => { e.preventDefault(); tocDialog.close(); goTo(i); });
        sec.appendChild(a);
      });
      frag.appendChild(sec);
    });
    dialogNav.replaceChildren(frag);
  }
  function openToc() {
    if (tocDialog.open) return;
    tocDialog.showModal();
    $("toc-button").setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("modal-open");
    const cur = dialogNav.querySelector(".is-current");
    if (cur) requestAnimationFrame(() => { cur.focus({ preventScroll: true }); cur.scrollIntoView({ block: "center" }); });
  }
  tocDialog.addEventListener("close", () => {
    $("toc-button").setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("modal-open");
  });
  tocDialog.addEventListener("click", (e) => { if (e.target === tocDialog) tocDialog.close(); });

  function openLightbox(btn) {
    const img = btn.querySelector("img");
    $("lightbox-image").src = img.currentSrc || img.src;
    $("lightbox-image").alt = img.alt || "";
    $("lightbox-caption").textContent = btn.dataset.caption || img.alt || "";
    lightbox.showModal();
    document.documentElement.classList.add("modal-open");
  }
  lightbox.addEventListener("close", () => { document.documentElement.classList.remove("modal-open"); $("lightbox-image").removeAttribute("src"); });
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox || e.target.closest(".lightbox-figure")) lightbox.close(); });

  /* ---------------------------------------------------------------- fullscreen */
  async function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) { /* blocked by the host page */ }
  }
  document.addEventListener("fullscreenchange", () => {
    const on = Boolean(document.fullscreenElement);
    document.documentElement.classList.toggle("is-fullscreen", on);
    $("fullscreen-button").setAttribute("aria-pressed", String(on));
    $("fullscreen-label").textContent = on ? "Exit" : "Full screen";
    requestAnimationFrame(fit);
  });

  /* ---------------------------------------------------------------- results chart */
  function buildChart() {
    const card = document.querySelector("[data-chart]");
    if (!card) return;
    const svg = card.querySelector("svg");
    const tip = card.querySelector(".chart-tip");
    const table = card.querySelector(".chart-table");
    const cats = ["Stairs", "Gaps", "Stepping stones", "Balance beam"];
    const series = [
      { name: "PPO", color: "var(--s-ppo)", v: [89.9, 0.0, 0.0, 0.0] },
      { name: "GLAD", color: "var(--s-glad)", v: [81.4, 91.9, 49.4, 63.2] },
      { name: "CReF", color: "var(--s-cref)", v: [83.7, 57.3, 92.3, 77.0] },
      { name: "WM-LOCO", color: "var(--s-wm)", v: [94.0, 96.0, 96.9, 92.1] }
    ];
    const W = 640, H = 380, L = 40, R = 6, T = 22, B = 34;
    const ph = H - T - B, pw = W - L - R;
    const y = (val) => T + ph * (1 - val / 100);
    const NS = "http://www.w3.org/2000/svg";
    const el = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    };
    [0, 25, 50, 75, 100].forEach((t) => {
      el("line", { x1: L, x2: W - R, y1: y(t), y2: y(t), class: t === 0 ? "base" : "grid" });
      el("text", { x: L - 8, y: y(t) + 3.5, "text-anchor": "end", class: "axis" }, t);
    });
    el("text", { x: L - 8, y: T - 10, "text-anchor": "end", class: "axis" }, "%");
    const gw = pw / cats.length, bw = 26, gap = 3;
    const inner = series.length * bw + (series.length - 1) * gap;
    cats.forEach((c, ci) => {
      const gx = L + ci * gw + (gw - inner) / 2;
      el("text", { x: L + ci * gw + gw / 2, y: H - 10, "text-anchor": "middle", class: "cat" }, c);
      series.forEach((s, si) => {
        const val = s.v[ci];
        const x = gx + si * (bw + gap);
        const h = Math.max(ph * val / 100, 0);
        const top = y(val);
        let bar;
        if (h > 0.5) {
          const r = Math.min(4, h);
          bar = el("path", {
            d: `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z`,
            fill: s.color, class: "bar"
          });
        } else {
          bar = el("rect", { x, y: y(0) - 1.5, width: bw, height: 1.5, fill: s.color, class: "bar" });
        }
        bar.dataset.k = String(ci * series.length + si);
        const lab = el("text", { x: x + bw / 2, y: top - 5, "text-anchor": "middle", class: "val" }, val.toFixed(1));
        lab.dataset.k = bar.dataset.k;
        const hit = el("rect", { x: x - 1, y: T, width: bw + 2, height: ph, class: "hit" });
        hit.addEventListener("mouseenter", () => {
          svg.classList.add("is-hover"); bar.classList.add("is-on");
          tip.innerHTML = `${c} · <b>${s.name}</b> ${val.toFixed(1)}%`;
          const sb = svg.getBoundingClientRect(), cb = card.getBoundingClientRect();
          const k = sb.width / W;
          const scale = cb.width / card.offsetWidth || 1;
          tip.style.left = `${((sb.left - cb.left) + (x + bw / 2) * k) / scale}px`;
          tip.style.top = `${((sb.top - cb.top) + top * k) / scale}px`;
          tip.hidden = false;
        });
        hit.addEventListener("mouseleave", () => { svg.classList.remove("is-hover"); bar.classList.remove("is-on"); tip.hidden = true; });
      });
    });
    const toggle = card.querySelector(".view-toggle");
    toggle.addEventListener("click", () => {
      const showTable = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(showTable));
      toggle.textContent = showTable ? "Chart view" : "Table view";
      svg.style.display = showTable ? "none" : "";
      table.hidden = !showTable;
    });
  }

  /* ---------------------------------------------------------------- presenter view (separate window)
     Share the main window; keep this one for yourself: current slide, next slide, notes, timers.
     The window is an about:blank popup written from here, so it shares this page's origin and stylesheet. */
  const PUBLIC = document.documentElement.hasAttribute("data-public");
  const PV_CSS = `
    html,body{height:100%;overflow:hidden!important;margin:0}
    body{background:#0d0b0a!important;color:#f3eee4;font:15px/1.6 -apple-system,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif}
    .pv{height:100vh;display:grid;grid-template-rows:auto 1fr}
    .pv-top{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#1b1713;border-bottom:1px solid rgba(242,238,229,.14)}
    .pv-n{font:700 22px/1 Menlo,Consolas,monospace;color:#f04e23}
    .pv-title{flex:1;min-width:0;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pv-top button{font:12px/1 -apple-system,sans-serif;color:#f3eee4;background:transparent;border:1px solid rgba(242,238,229,.25);padding:6px 10px;cursor:pointer}
    .pv-top button:hover{border-color:#f04e23;color:#ff8b62}
    .pv-clock{display:flex;gap:14px;align-items:baseline;font:400 12px/1 Menlo,Consolas,monospace;color:#aca397}
    .pv-clock b{font-size:20px;color:#f3eee4;font-weight:400}
    .pv-clock .over b{color:#ff6a3d}
    .pv-main{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;padding:14px 16px;min-height:0}
    .pv-left{display:grid;grid-template-rows:auto auto;gap:12px;align-content:start;min-height:0;overflow:hidden}
    .pv-lab{font:400 10px/1 Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#aca397;margin:0 0 6px}
    .pv-frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#000;outline:1px solid rgba(242,238,229,.16)}
    .pv-frame.cur{outline:2px solid #f04e23}
    .pv-next{width:52%;cursor:pointer}
    .pv-canvas{position:absolute;left:0;top:0;width:1200px;height:675px;transform-origin:0 0}
    .pv-canvas .slide{position:absolute!important;inset:0!important;display:block!important;width:1200px;height:675px}
    .pv-end{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#746c5e;font-size:14px}
    .pv-notes{min-height:0;overflow:auto;padding:4px 6px 30px 2px}
    .pv-notes .cue{font:400 13px/1.5 Menlo,Consolas,monospace;color:#ffb393;white-space:pre-wrap;margin:0 0 12px}
    .pv-notes .en,.pv-notes .zh,.pv-notes .other{white-space:pre-wrap;margin:0 0 4px;font-size:1em}
    .pv-notes .zh{color:#e9dfd0;border-top:1px solid rgba(242,238,229,.14);padding-top:12px;margin-top:12px}
    body.only-en .pv-notes .zh, body.only-zh .pv-notes .en{display:none}
    body.only-zh .pv-notes .zh{border-top:0;padding-top:0;margin-top:0}
    body.big .pv-notes{font-size:19px}
    .pv-hint{font-size:11px;color:#746c5e;margin-top:10px}`;
  let pvWin = null, pvTimer = 0, pvStart = 0, pvSlideStart = 0;

  function cueSeconds(i) {
    const m = notesOf(i).match(/^\[(\d+):(\d{2})\]/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  }
  function mirror(i) {
    const s = slides[i].cloneNode(true);
    s.removeAttribute("id");
    s.classList.remove("is-animating");
    s.classList.add("is-active");
    s.removeAttribute("aria-hidden");
    s.inert = true;
    s.querySelectorAll(".notes").forEach((n) => n.remove());
    s.querySelectorAll("[data-final]").forEach((n) => { n.textContent = n.dataset.final; });
    s.querySelectorAll("video").forEach((v) => {
      const img = document.createElement("img");
      img.src = v.getAttribute("poster") || "";
      img.style.cssText = `width:100%;height:100%;object-fit:${getComputedStyle(v).objectFit || "cover"};display:block`;
      v.replaceWith(img);
    });
    s.querySelectorAll(".play-overlay").forEach((b) => b.remove());
    return s;
  }
  function openNotes() {
    if (PUBLIC) return;
    if (pvWin && !pvWin.closed) { pvWin.focus(); renderNotes(); return; }
    pvWin = window.open("", "wmloco-presenter", "width=1400,height=860");
    if (!pvWin) return;
    const d = pvWin.document;
    d.open();
    d.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Presenter view · WM-LOCO</title>
      <base href="${location.href.replace(/#.*$/, "")}"><link rel="stylesheet" href="styles.css"><style>${PV_CSS}</style></head><body>
      <div class="pv">
        <div class="pv-top"><span class="pv-n" id="pv-n"></span><span class="pv-title" id="pv-title"></span>
          <span class="pv-clock"><span>talk <b id="pv-total">00:00</b></span><span id="pv-slide-box">slide <b id="pv-slide">0:00</b> <span id="pv-budget"></span></span><span>now <b id="pv-now"></b></span></span>
          <button id="pv-prev">←</button><button id="pv-next-b">→</button><button id="pv-lang" title="EN + 中文 / EN / 中文">EN+中</button><button id="pv-size">A±</button><button id="pv-reset" title="Reset timers">⟲</button></div>
        <div class="pv-main">
          <div class="pv-left">
            <div><p class="pv-lab">Now · the shared window shows this</p><div class="pv-frame cur" id="pv-cur"></div></div>
            <div><p class="pv-lab">Next</p><div class="pv-frame pv-next" id="pv-nx"></div><p class="pv-hint">← → / PageUp PageDown / clicker work in both windows · Space plays the slide video · click "Next" to advance · H in the slide window hides its bars</p></div>
          </div>
          <div class="pv-notes" id="pv-notes"></div>
        </div>
      </div></body></html>`);
    d.close();
    d.getElementById("pv-prev").onclick = prev;
    d.getElementById("pv-next-b").onclick = next;
    d.getElementById("pv-nx").onclick = next;
    d.getElementById("pv-size").onclick = () => d.body.classList.toggle("big");
    d.getElementById("pv-reset").onclick = () => { pvStart = pvSlideStart = Date.now(); pvTick(); };
    const modes = [["", "EN+中"], ["only-en", "EN"], ["only-zh", "中文"]];
    let mode = 0;
    d.getElementById("pv-lang").onclick = (e) => {
      d.body.classList.remove("only-en", "only-zh");
      mode = (mode + 1) % modes.length;
      if (modes[mode][0]) d.body.classList.add(modes[mode][0]);
      e.currentTarget.textContent = modes[mode][1];
    };
    d.addEventListener("keydown", onKeydown, true);
    pvWin.addEventListener("resize", pvFit);
    pvStart = pvSlideStart = Date.now();
    clearInterval(pvTimer);
    pvTimer = setInterval(pvTick, 500);
    renderNotes();
    setTimeout(pvFit, 300);
  }
  function pvFit() {
    if (!pvWin || pvWin.closed) return;
    pvWin.document.querySelectorAll(".pv-frame").forEach((f) => {
      const c = f.querySelector(".pv-canvas");
      if (c) c.style.transform = `scale(${(f.clientWidth / 1200).toFixed(4)})`;
    });
  }
  function pvTick() {
    if (!pvWin || pvWin.closed) { clearInterval(pvTimer); return; }
    const d = pvWin.document;
    if (!d.getElementById("pv-total")) return;
    const fmt = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
    const t = Math.floor((Date.now() - pvStart) / 1000);
    const st = Math.floor((Date.now() - pvSlideStart) / 1000);
    d.getElementById("pv-total").textContent = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    d.getElementById("pv-slide").textContent = fmt(st);
    const budget = cueSeconds(current);
    d.getElementById("pv-budget").textContent = budget ? `/ ${fmt(budget)}` : "";
    d.getElementById("pv-slide-box").classList.toggle("over", budget > 0 && st > budget);
    const now = new Date();
    d.getElementById("pv-now").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  function renderNotes() {
    if (!pvWin || pvWin.closed) return;
    const d = pvWin.document;
    if (!d.getElementById("pv-notes")) return;
    pvSlideStart = Date.now();
    d.getElementById("pv-n").textContent = `${pad(current + 1)}/${total}`;
    d.getElementById("pv-title").textContent = titleOf(current);
    const put = (id, i) => {
      const f = d.getElementById(id);
      f.replaceChildren();
      if (i >= total) { const e = d.createElement("div"); e.className = "pv-end"; e.textContent = "End of deck"; f.appendChild(e); return; }
      const c = d.createElement("div");
      c.className = "pv-canvas";
      c.appendChild(d.importNode(mirror(i), true));
      f.appendChild(c);
    };
    put("pv-cur", current);
    put("pv-nx", current + 1);
    const box = d.getElementById("pv-notes");
    box.replaceChildren();
    const paras = [];
    (notesOf(current) || "(no notes)").split(/\n\s*\n/).forEach((para) => {
      const lines = para.split("\n");
      const cue = [];
      while (lines.length && /^\[/.test(lines[0])) cue.push(lines.shift());   // [m:ss] / [HOST …] cue lines
      if (cue.length) paras.push(cue.join("\n"));
      if (lines.length) paras.push(lines.join("\n"));
    });
    paras.forEach((para) => {
      const p = d.createElement("p");
      p.className = /^EN\b/.test(para) ? "en" : /^中文/.test(para) ? "zh" : /^\[/.test(para) ? "cue" : "other";
      p.textContent = para.replace(/^(EN|中文)[^:：]*[:：]\s*/, "");
      box.appendChild(p);
    });
    box.scrollTop = 0;
    pvFit();
    pvTick();
  }
  function toggleClean() {
    document.documentElement.classList.toggle("is-clean");
    requestAnimationFrame(fit);
  }

  /* ---------------------------------------------------------------- keys */
  function onKeydown(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (tocDialog.open || lightbox.open) return;
    const t = e.target;
    if (t instanceof Element && t.closest("input, textarea, select, [contenteditable='true']")) return;
    switch (e.key) {
      case "ArrowRight": case "PageDown": case "ArrowDown":
        e.preventDefault(); e.stopPropagation(); next(); break;
      case "ArrowLeft": case "PageUp": case "ArrowUp":
        e.preventDefault(); e.stopPropagation(); prev(); break;
      case "Home": e.preventDefault(); goTo(0); break;
      case "End": e.preventDefault(); goTo(total - 1); break;
      case " ":
        if (t instanceof Element && t.closest("a, .view-toggle, .zoomable, .tool-button")) return;
        e.preventDefault(); e.stopPropagation();
        if (!togglePrimaryVideo()) next();
        break;
      case "m": case "M": e.preventDefault(); openToc(); break;
      case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
      case "s": case "S": e.preventDefault(); openNotes(); break;
      case "h": case "H": e.preventDefault(); toggleClean(); break;
      default: break;
    }
  }

  /* ---------------------------------------------------------------- init */
  function onModeChange() {
    isStage = stageQuery.matches;
    slides.forEach((s, i) => { if (i !== current) pauseMedia(i); });
    syncSlides();
    requestAnimationFrame(() => { fit(); if (!isStage) slides[current].closest(".slide-shell").scrollIntoView({ block: "center" }); });
  }

  function init() {
    slides.forEach((s) => {
      s.tabIndex = -1;
      if (!s.parentElement.classList.contains("slide-shell")) {
        const shell = document.createElement("div");
        shell.className = "slide-shell";
        s.parentElement.insertBefore(shell, s);
        shell.appendChild(s);
      }
    });
    $("page-total").textContent = pad(total);
    buildToc();
    buildChart();
    initDemo();
    if (MOTION_OK) slides.forEach(choreograph);
    current = indexFromHash();
    syncSlides();
    updateChrome();
    fit();
    enter(current, true);
    if (isStage) activateMedia(current);

    document.addEventListener("keydown", onKeydown, true);
    window.addEventListener("resize", fit);
    window.addEventListener("hashchange", () => { const i = indexFromHash(); if (i !== current) goTo(i, { push: false }); });
    if (stageQuery.addEventListener) stageQuery.addEventListener("change", onModeChange);
    prevButton.addEventListener("click", prev);
    nextButton.addEventListener("click", next);
    $("toc-button").addEventListener("click", openToc);
    $("toc-close").addEventListener("click", () => tocDialog.close());
    $("lightbox-close").addEventListener("click", () => lightbox.close());
    $("fullscreen-button").addEventListener("click", toggleFullscreen);
    if (!document.fullscreenEnabled) $("fullscreen-button").hidden = true;
    $("notes-button").addEventListener("click", openNotes);
    $("notes-open").addEventListener("click", () => { tocDialog.close(); openNotes(); });
    $("print-button").addEventListener("click", () => { tocDialog.close(); setTimeout(() => window.print(), 80); });
    document.querySelectorAll("[data-goto]").forEach((a) => {
      if (a.classList.contains("dialog-link")) return;
      a.addEventListener("click", (e) => { e.preventDefault(); goTo(Number(a.dataset.goto) - 1); });
    });
    document.querySelectorAll(".zoomable").forEach((b) => b.addEventListener("click", () => openLightbox(b)));
    document.addEventListener("visibilitychange", () => { if (document.hidden) pauseMedia(current); });
    window.addEventListener("beforeunload", () => { if (pvWin && !pvWin.closed) pvWin.close(); });
    if (!isStage) {
      // document mode: track the slide in view
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio > 0.6) {
            const i = slides.indexOf(en.target.querySelector(".slide"));
            if (i >= 0 && i !== current) { current = i; updateChrome(); history.replaceState(null, "", `#slide-${pad(i + 1)}`); }
          }
        });
      }, { threshold: [0.6] });
      document.querySelectorAll(".slide-shell").forEach((sh) => io.observe(sh));
    }
  }

  init();
})();
