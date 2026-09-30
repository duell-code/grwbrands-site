// Hero film — a wide, captioned banner built from the HTML scenes in index.html.
// Six chapters play in a loop: the chapter bar shows progress and jumps on click,
// the caption on the left builds up phrase by phrase, and a button pauses it. The
// clock stops when the banner is off-screen or the tab is hidden. With reduced
// motion it does not autoplay; each chapter shows its final frame and full caption.
(() => {
  const film = document.querySelector("[data-film]");
  if (!film) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const caption = film.querySelector(".film-caption");
  const chapter = film.querySelector(".film-chapter");
  const chapterNum = film.querySelector(".film-num");
  const chapterLabel = film.querySelector(".film-label");
  const chapterBar = film.querySelector(".film-chapters");
  const toggle = film.querySelector(".film-toggle");
  const chaps = [...film.querySelectorAll(".chap")];
  const scenes = [...film.querySelectorAll(".scene")].map((el) => ({
    el,
    label: el.dataset.label || "",
    dur: Number(el.dataset.dur) || 5000,
    caps: [...el.querySelectorAll(".caps li")].map((li) => ({
      t: Number(li.dataset.t) || 0,
      html: li.innerHTML.trim(),
    })),
  }));

  const globe = makeGlobe(film.querySelector(".globe"));

  let index = 0;
  let elapsed = 0;
  let capIndex = -1;
  let last = 0;
  let raf = 0;
  let onScreen = true;
  let userPaused = reduce.matches;

  // Caption markup comes from our own .caps lists: plain text plus <b> for accent words.
  // Each new phrase is appended to the ones already shown; only its words animate in.
  const appendPhrase = (html, animate) => {
    const box = document.createElement("div");
    box.innerHTML = html;
    let i = 0;
    box.childNodes.forEach((node) => {
      const strong = node.nodeName === "B";
      node.textContent.split(/\s+/).filter(Boolean).forEach((word) => {
        const el = document.createElement(strong ? "b" : "span");
        el.textContent = word;
        if (animate) el.style.setProperty("--i", i++);
        else el.style.animation = "none";
        caption.append(el, " ");
      });
    });
  };

  const playing = () => !userPaused && onScreen && !document.hidden;

  const update = () => {
    const sc = scenes[index];
    if (!reduce.matches) {
      while (capIndex + 1 < sc.caps.length && elapsed >= sc.caps[capIndex + 1].t) {
        capIndex += 1;
        appendPhrase(sc.caps[capIndex].html, true);
      }
    }
    if (chaps[index]) chaps[index].style.setProperty("--p", Math.min(elapsed / sc.dur, 1));
  };

  const centreChapter = () => {
    const c = chaps[index];
    if (!c || chapterBar.scrollWidth <= chapterBar.clientWidth) return;
    chapterBar.scrollTo({
      left: c.offsetLeft - (chapterBar.clientWidth - c.offsetWidth) / 2,
      behavior: reduce.matches ? "auto" : "smooth",
    });
  };

  const show = (i) => {
    scenes[index].el.classList.remove("is-active");
    index = (i + scenes.length) % scenes.length;
    elapsed = 0;
    capIndex = -1;
    const sc = scenes[index];
    void sc.el.offsetWidth; // let the removal register so the scene's animations restart
    sc.el.classList.add("is-active");

    caption.textContent = "";
    if (reduce.matches) appendPhrase(sc.caps.map((c) => c.html).join(" "), false);
    chapterNum.textContent = String(index + 1).padStart(2, "0");
    chapterLabel.textContent = sc.label;
    chapter.classList.remove("swap");
    void chapter.offsetWidth;
    chapter.classList.add("swap");

    chaps.forEach((c, j) => {
      c.style.setProperty("--p", j < index ? 1 : 0);
      if (j === index) c.setAttribute("aria-current", "true");
      else c.removeAttribute("aria-current");
    });
    centreChapter();
    if (globe && sc.el.contains(globe.canvas)) globe.draw(reduce.matches ? 4000 : 0);
    update();
  };

  const frame = (now) => {
    raf = 0;
    if (!playing()) return;
    elapsed += last ? Math.min(now - last, 64) : 0;
    last = now;
    if (elapsed >= scenes[index].dur) {
      show(index + 1);
    } else {
      update();
      if (globe && scenes[index].el.contains(globe.canvas)) globe.draw(elapsed);
    }
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    const on = playing();
    // Only a user pause freezes the scene animations. Off-screen we just stop the
    // clock, so a banner that loads below the fold still shows a finished frame.
    film.classList.toggle("is-paused", userPaused);
    film.dataset.state = userPaused ? "paused" : "playing";
    toggle.setAttribute("aria-label", userPaused ? "Play animation" : "Pause animation");
    if (on && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!on && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  toggle.addEventListener("click", () => {
    userPaused = !userPaused;
    sync();
  });

  chaps.forEach((chap, j) =>
    chap.addEventListener("click", () => {
      if (!reduce.matches) userPaused = false;
      show(j);
      sync();
    })
  );

  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    },
    { threshold: 0.15 }
  ).observe(film);

  document.addEventListener("visibilitychange", sync);
  reduce.addEventListener?.("change", () => {
    userPaused = reduce.matches;
    show(index);
    sync();
  });

  show(0);
  sync();

  // -------------------------------------------------------------------------
  // Chapter 6: a dotted globe with routes from the United States outwards.
  // -------------------------------------------------------------------------
  function makeGlobe(canvas) {
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext("2d");
    const RAD = Math.PI / 180;
    const TAU = Math.PI * 2;

    const vec = (lat, lon) => [
      Math.cos(lat * RAD) * Math.sin(lon * RAD),
      Math.sin(lat * RAD),
      Math.cos(lat * RAD) * Math.cos(lon * RAD),
    ];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const slerp = (a, b, t) => {
      const d = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
      const s = Math.sin(d);
      if (s < 1e-6) return a;
      const p = Math.sin((1 - t) * d) / s;
      const q = Math.sin(t * d) / s;
      return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
    };

    // Evenly spread dots over the sphere (Fibonacci lattice).
    const dots = [];
    const N = 900;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      dots.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
    }

    const home = vec(39, -98); // United States
    const routes = [
      [51.5, -0.1], // London
      [59.3, 18.1], // Stockholm
      [25.2, 55.3], // Dubai
      [-23.5, -46.6], // São Paulo
      [1.35, 103.8], // Singapore
      [-33.9, 151.2], // Sydney
    ].map(([lat, lon]) => {
      const v = vec(lat, lon);
      return { v, lift: Math.min(0.3, 0.08 + Math.acos(dot(home, v)) * 0.09) };
    });

    const draw = (ms) => {
      const css = canvas.clientWidth;
      if (!css) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(css * dpr);
      if (canvas.width !== W) {
        canvas.width = W;
        canvas.height = W;
      }
      const R = W * 0.4;
      const c = W / 2;
      const lon0 = (-62 + ms * 0.006) * RAD; // the view drifts slowly east
      const tilt = 16 * RAD; // seen from slightly north of the equator
      const cr = Math.cos(-lon0);
      const sr = Math.sin(-lon0);
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const project = (v, k = 1) => {
        const x = v[0] * k;
        const y = v[1] * k;
        const z = v[2] * k;
        const x1 = x * cr + z * sr;
        const z1 = -x * sr + z * cr;
        return [c + x1 * R, c - (y * ct - z1 * st) * R, y * st + z1 * ct];
      };

      ctx.clearRect(0, 0, W, W);

      const halo = ctx.createRadialGradient(c, c, R * 0.7, c, c, R * 1.3);
      halo.addColorStop(0, "rgba(224,115,93,0)");
      halo.addColorStop(0.55, "rgba(224,115,93,0.10)");
      halo.addColorStop(1, "rgba(224,115,93,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, W);

      const body = ctx.createRadialGradient(c - R * 0.35, c - R * 0.45, R * 0.1, c, c, R);
      body.addColorStop(0, "#212126");
      body.addColorStop(1, "#0d0d10");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(c, c, R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = dpr;
      ctx.stroke();

      ctx.fillStyle = "#d4d4d8";
      for (const p of dots) {
        const [x, y, z] = project(p);
        if (z <= 0.02) continue;
        ctx.globalAlpha = 0.16 + z * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, (0.5 + z * 0.75) * dpr, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.lineCap = "round";
      ctx.lineWidth = 1.3 * dpr;
      routes.forEach((route, i) => {
        const t = Math.min(1, Math.max(0, (ms - 700 - i * 320) / 1500));
        if (t <= 0) return;
        const e = 1 - Math.pow(1 - t, 3);
        const steps = 60;
        let prev = null;
        for (let s = 0; s <= steps; s++) {
          const u = (s / steps) * e;
          const pt = project(slerp(home, route.v, u), 1 + route.lift * Math.sin(Math.PI * u));
          if (prev) {
            ctx.strokeStyle = pt[2] > 0 ? "rgba(224,115,93,0.9)" : "rgba(224,115,93,0.14)";
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(pt[0], pt[1]);
            ctx.stroke();
          }
          prev = pt;
        }
        if (prev && prev[2] > 0) {
          ctx.fillStyle = t < 1 ? "#ffffff" : "#e0735d";
          ctx.beginPath();
          ctx.arc(prev[0], prev[1], (t < 1 ? 1.8 : 2.4) * dpr, 0, TAU);
          ctx.fill();
        }
      });

      const h = project(home);
      if (h[2] > 0) {
        const k = (ms % 1800) / 1800;
        ctx.strokeStyle = `rgba(224,115,93,${0.8 * (1 - k)})`;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.arc(h[0], h[1], (3 + k * 12) * dpr, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = "#e0735d";
        ctx.beginPath();
        ctx.arc(h[0], h[1], 3.2 * dpr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(h[0], h[1], 1.3 * dpr, 0, TAU);
        ctx.fill();
      }
    };

    return { canvas, draw };
  }
})();
