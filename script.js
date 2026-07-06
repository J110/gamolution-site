(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // CHROME
  // ═══════════════════════════════════════════════════════════
  var trail = document.getElementById('cursorTrail');
  var tx = 0, ty = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
  (function loop() {
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    if (trail) trail.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
    requestAnimationFrame(loop);
  })();
  var nav = document.getElementById('nav');
  function navScroll(e) {
    var st = window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0;
    if (!st && e && e.target && e.target.scrollTop) st = e.target.scrollTop;
    if (st > 40) nav.classList.add('scrolled'); else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', navScroll, { passive: true });
  document.addEventListener('scroll', navScroll, true);
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  navToggle.addEventListener('click', function () { navLinks.classList.toggle('open'); });
  document.querySelectorAll('.nav-link, .nav-cta').forEach(function (l) {
    l.addEventListener('click', function () { navLinks.classList.remove('open'); });
  });
  // rect-based reveal (IntersectionObserver is unreliable in embedded viewports)
  function checkReveal() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight - 60 && r.bottom > 0) {
        var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.transitionDelay = Math.min(idx * 0.06, 0.4) + 's';
        el.classList.add('visible');
      }
    });
  }
  checkReveal();
  document.addEventListener('scroll', checkReveal, true);
  window.addEventListener('resize', checkReveal);
  setInterval(checkReveal, 500);

  // ═══════════════════════════════════════════════════════════
  // PALETTE
  // ═══════════════════════════════════════════════════════════
  var SAGE = { r: 74, g: 113, b: 150 };
  var SAGE_SOFT = { r: 143, g: 176, b: 204 };
  var AMBER = { r: 207, g: 174, b: 130 };
  var AMBER_SOFT = { r: 223, g: 196, b: 160 };
  var SLATE = { r: 46, g: 74, b: 102 };
  var SLATE_SOFT = { r: 122, g: 149, b: 173 };
  var TERRA = { r: 185, g: 106, b: 86 };
  var MOSS = { r: 138, g: 143, b: 106 };
  var INK = { r: 58, g: 56, b: 51 };

  // ═══════════════════════════════════════════════════════════
  // PATH FUNCTIONS — parametric t∈[0,1] → {x, y}
  // ═══════════════════════════════════════════════════════════
  function pathLine(p0, p1) {
    return function (t) { return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t }; };
  }
  function pathBezier(p0, p1, p2, p3) {
    return function (t) {
      var mt = 1 - t;
      return {
        x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
        y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
      };
    };
  }
  function pathCircle(cx, cy, r) {
    return function (t) { var a = t * Math.PI * 2; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; };
  }
  function pathEllipse(cx, cy, rx, ry) {
    return function (t) { var a = t * Math.PI * 2; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; };
  }
  function pathArc(cx, cy, r, a0, a1) {
    return function (t) { var a = a0 + (a1 - a0) * t; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; };
  }

  // ═══════════════════════════════════════════════════════════
  // ROLE BUILDERS
  // ═══════════════════════════════════════════════════════════
  function addFlow(roles, path, count, color, speedMin, speedMax) {
    speedMin = speedMin || 0.0015; speedMax = speedMax || 0.003;
    for (var i = 0; i < count; i++) {
      roles.push({
        type: 'flow', path: path, color: color,
        speed: speedMin + Math.random() * (speedMax - speedMin),
        t: i / Math.max(1, count) + Math.random() * 0.04
      });
    }
  }
  function addWalk(roles, cx, cy, radius, count, color, speed) {
    speed = speed || 0.5;
    for (var i = 0; i < count; i++) {
      roles.push({ type: 'walk', cx: cx, cy: cy, r: radius, color: color, walkSpeed: speed });
    }
  }
  function rectEdges(x, y, w, h) {
    return [
      pathLine({ x: x, y: y }, { x: x + w, y: y }),
      pathLine({ x: x + w, y: y }, { x: x + w, y: y + h }),
      pathLine({ x: x + w, y: y + h }, { x: x, y: y + h }),
      pathLine({ x: x, y: y + h }, { x: x, y: y })
    ];
  }
  function addBuildingFootprint(roles, x, y, w, h, color, dotsPerEdge) {
    dotsPerEdge = dotsPerEdge || 6;
    rectEdges(x, y, w, h).forEach(function (e) {
      addFlow(roles, e, dotsPerEdge, color, 0.0007, 0.0014);
    });
  }

  function fillCircleStatic(roles, ccx, ccy, r, density, color) {
    for (var y = ccy - r; y < ccy + r; y += density) {
      for (var x = ccx - r; x < ccx + r; x += density) {
        var dx = x - ccx, dy = y - ccy;
        if (dx * dx + dy * dy <= r * r) {
          roles.push({
            type: 'static',
            x: x + (Math.random() - 0.5) * density * 0.6,
            y: y + (Math.random() - 0.5) * density * 0.6,
            color: color
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CANVAS FACTORY
  // particle types: static / flow / walk · trail-fade rendering
  // ═══════════════════════════════════════════════════════════
  function createDotCanvas(canvas, scenes, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var N = opts.N || 280;
    var holdMs = opts.holdMs || 9000;
    var dotSize = opts.dotSize || 1.6;
    var trailAlpha = opts.trailAlpha || 0.08;
    var bgRGB = opts.bgRGB || '236, 234, 229';
    var dotAlpha = opts.dotAlpha || 0.75;
    var cycle = opts.cycle !== false;
    var onSceneChange = opts.onSceneChange || null;

    var particles = [];
    var sceneIdx = 0, sceneStart = 0, running = true;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      if (W < 10 || H < 10) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = 'rgb(' + bgRGB + ')';
      ctx.fillRect(0, 0, W, H);
    }
    function initParticles() {
      particles = [];
      for (var i = 0; i < N; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: 0, vy: 0, type: 'walk',
          cx: W / 2, cy: H / 2, r: Math.min(W, H) * 0.4,
          walkSpeed: 0.4, path: null, pathT: 0, pathSpeed: 0.002,
          anchorX: W / 2, anchorY: H / 2,
          rcol: SAGE.r, gcol: SAGE.g, bcol: SAGE.b,
          trcol: SAGE.r, tgcol: SAGE.g, tbcol: SAGE.b,
          size: dotSize + (Math.random() - 0.5) * 0.4,
          settling: 1.0
        });
      }
    }
    function applyScene(scene) {
      var roles = scene.fn(W, H);
      var padStatic = opts.padStatic && roles.length > 0;
      while (roles.length < N) {
        if (padStatic) {
          // surplus agents thicken the figure itself — no ambient walkers
          var src = roles[Math.floor(Math.random() * roles.length)];
          if (src.type === 'static') {
            roles.push({ type: 'static', x: src.x + (Math.random() - 0.5) * 5, y: src.y + (Math.random() - 0.5) * 5, color: src.color });
          } else {
            roles.push(src);
          }
        } else {
          roles.push({ type: 'walk', cx: W / 2, cy: H / 2, r: Math.min(W, H) * 0.45, color: SAGE_SOFT, walkSpeed: 0.3 });
        }
      }
      for (var i = roles.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = roles[i]; roles[i] = roles[j]; roles[j] = tmp;
      }
      roles = roles.slice(0, N);
      for (var i = 0; i < N; i++) {
        var p = particles[i]; var r = roles[i];
        p.type = r.type;
        p.trcol = r.color.r; p.tgcol = r.color.g; p.tbcol = r.color.b;
        p.settling = 1.0;
        if (r.type === 'static') { p.anchorX = r.x; p.anchorY = r.y; }
        else if (r.type === 'flow') { p.path = r.path; p.pathSpeed = r.speed; p.pathT = r.t != null ? r.t : Math.random(); }
        else if (r.type === 'walk') { p.cx = r.cx; p.cy = r.cy; p.r = r.r; p.walkSpeed = r.walkSpeed || 0.5; }
      }
    }
    function tick() {
      if (!running) { requestAnimationFrame(tick); return; }
      var now = performance.now();
      if (cycle && scenes.length > 1 && now - sceneStart > holdMs) {
        sceneIdx = (sceneIdx + 1) % scenes.length;
        applyScene(scenes[sceneIdx]); sceneStart = now;
        if (onSceneChange) onSceneChange(sceneIdx, scenes[sceneIdx]);
      }
      ctx.fillStyle = 'rgba(' + bgRGB + ',' + trailAlpha + ')';
      ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var p = particles[i];
        if (p.settling > 0) p.settling -= 0.012;
        if (p.type === 'static') {
          var dx = p.anchorX - p.x, dy = p.anchorY - p.y;
          p.vx = p.vx * 0.86 + dx * 0.035 + (Math.random() - 0.5) * 0.05;
          p.vy = p.vy * 0.86 + dy * 0.035 + (Math.random() - 0.5) * 0.05;
        } else if (p.type === 'flow' && p.path) {
          p.pathT += p.pathSpeed;
          var looped = false;
          if (p.pathT >= 1) { p.pathT -= 1; looped = true; }
          var target = p.path(p.pathT);
          if (looped) { p.x = target.x; p.y = target.y; p.vx = 0; p.vy = 0; }
          else {
            var dx = target.x - p.x, dy = target.y - p.y;
            var lerp = p.settling > 0 ? 0.08 : 0.35;
            p.vx = p.vx * 0.4 + dx * lerp;
            p.vy = p.vy * 0.4 + dy * lerp;
          }
        } else if (p.type === 'walk') {
          p.vx += (Math.random() - 0.5) * p.walkSpeed;
          p.vy += (Math.random() - 0.5) * p.walkSpeed;
          p.vx *= 0.92; p.vy *= 0.92;
          var dxc = p.x - p.cx, dyc = p.y - p.cy;
          var dist = Math.sqrt(dxc * dxc + dyc * dyc);
          if (dist > p.r) { p.vx -= dxc * 0.03; p.vy -= dyc * 0.03; }
        }
        p.x += p.vx; p.y += p.vy;
        p.rcol += (p.trcol - p.rcol) * 0.05;
        p.gcol += (p.tgcol - p.gcol) * 0.05;
        p.bcol += (p.tbcol - p.bcol) * 0.05;
        ctx.fillStyle = 'rgba(' + Math.round(p.rcol) + ',' + Math.round(p.gcol) + ',' + Math.round(p.bcol) + ',' + dotAlpha + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    resize();
    initParticles();
    if (scenes.length > 0) {
      applyScene(scenes[0]); sceneStart = performance.now();
      if (onSceneChange) onSceneChange(0, scenes[0]);
    }
    tick();
    window.addEventListener('resize', function () {
      resize();
      if (scenes.length > 0) applyScene(scenes[sceneIdx]);
    });
    setInterval(function () {
      var r = canvas.getBoundingClientRect();
      running = r.bottom > -80 && r.top < window.innerHeight + 80;
    }, 400);
  }

  // ═══════════════════════════════════════════════════════════
  // HERO SCENES — real-world systems painted by agent motion
  // ═══════════════════════════════════════════════════════════

  // ── 1. CITY — isometric houses with pitched roofs, meandering river with banks, bridge ──
  function sceneCity(W, H) {
    var roles = [];
    var ox = W / 2, oy = H * 0.55;
    var tw = Math.min(W / 22, 32), th = tw / 2;
    function iso(x, y, z) { return { x: ox + (x - y) * (tw / 2), y: oy + (x + y) * (th / 2) - (z || 0) }; }

    // ── Meandering river across the iso plane (west to east, with banks) ──
    var rivStart = iso(-9, -2, 0), rivC1 = iso(-4, -1, 0);
    var rivC2 = iso(2, 1, 0), rivEnd = iso(9, 0, 0);
    addFlow(roles, pathBezier(rivStart, rivC1, rivC2, rivEnd), 36, SLATE, 0.0014, 0.0024);
    // Left bank (perpendicular offset)
    addFlow(roles, pathBezier(
      { x: rivStart.x, y: rivStart.y - 4 }, { x: rivC1.x, y: rivC1.y - 4 },
      { x: rivC2.x, y: rivC2.y - 4 }, { x: rivEnd.x, y: rivEnd.y - 4 }
    ), 14, SLATE_SOFT, 0.0008, 0.0014);
    // Right bank
    addFlow(roles, pathBezier(
      { x: rivStart.x, y: rivStart.y + 4 }, { x: rivC1.x, y: rivC1.y + 4 },
      { x: rivC2.x, y: rivC2.y + 4 }, { x: rivEnd.x, y: rivEnd.y + 4 }
    ), 14, SLATE_SOFT, 0.0008, 0.0014);

    // ── Bridge crossing the river (perpendicular path) ──
    var bridgeS = iso(-1, -3, 0), bridgeE = iso(-1, 2, 0);
    addFlow(roles, pathLine(bridgeS, bridgeE), 7, AMBER, 0.0014, 0.0024);
    addFlow(roles, pathLine(bridgeE, bridgeS), 6, AMBER_SOFT, 0.0014, 0.0024);

    // ── Roads ──
    addFlow(roles, pathLine(iso(-9, 3, 0), iso(9, 3, 0)), 14, AMBER, 0.0028, 0.0048);
    addFlow(roles, pathLine(iso(9, 3.3, 0), iso(-9, 3.3, 0)), 12, AMBER_SOFT, 0.0026, 0.0046);
    addFlow(roles, pathLine(iso(-9, -3, 0), iso(9, -3, 0)), 12, AMBER, 0.0028, 0.0048);
    addFlow(roles, pathLine(iso(9, -2.7, 0), iso(-9, -2.7, 0)), 10, AMBER_SOFT, 0.0026, 0.0046);
    addFlow(roles, pathLine(iso(-5, -5, 0), iso(-5, 5, 0)), 10, SLATE, 0.0026, 0.0046);
    addFlow(roles, pathLine(iso(-4.7, 5, 0), iso(-4.7, -5, 0)), 8, SLATE_SOFT, 0.0024, 0.0044);
    addFlow(roles, pathLine(iso(5, -5, 0), iso(5, 5, 0)), 10, SLATE, 0.0026, 0.0046);
    addFlow(roles, pathLine(iso(5.3, 5, 0), iso(5.3, -5, 0)), 8, SLATE_SOFT, 0.0024, 0.0044);

    // Roundabout at main south intersection
    var roundC = iso(0, 3, 0);
    addFlow(roles, pathCircle(roundC.x, roundC.y, 16), 14, AMBER, 0.0028, 0.0042);

    // ── House builder (iso 3D with pitched roof + door) ──
    function addHouse(gx, gy, w, d, wH, rH, color) {
      var bsw = iso(gx, gy + d, 0), bse = iso(gx + w, gy + d, 0), bne = iso(gx + w, gy, 0);
      var wsw = iso(gx, gy + d, wH), wse = iso(gx + w, gy + d, wH);
      var wne = iso(gx + w, gy, wH);
      var aS = iso(gx + w / 2, gy + d, wH + rH), aN = iso(gx + w / 2, gy, wH + rH);
      // Wall edges (front + right + verticals + eaves)
      [[bsw, bse], [bse, bne], [bsw, wsw], [bse, wse], [bne, wne], [wsw, wse], [wse, wne]].forEach(function (e) {
        addFlow(roles, pathLine(e[0], e[1]), 3, color, 0.0008, 0.0014);
      });
      // Roof slopes + ridge
      addFlow(roles, pathLine(wsw, aS), 3, color, 0.0008, 0.0014);
      addFlow(roles, pathLine(wse, aS), 3, color, 0.0008, 0.0014);
      addFlow(roles, pathLine(wne, aN), 3, color, 0.0008, 0.0014);
      addFlow(roles, pathLine(wse, aN), 2, color, 0.0008, 0.0014);
      addFlow(roles, pathLine(aN, aS), 4, color, 0.0008, 0.0014);
      // Door on front (south) wall
      var dLx = bsw.x + (bse.x - bsw.x) * 0.4, dLy = bsw.y + (bse.y - bsw.y) * 0.4;
      var dRx = bsw.x + (bse.x - bsw.x) * 0.58, dRy = bsw.y + (bse.y - bsw.y) * 0.58;
      var dyOff = wH * 0.65;
      addFlow(roles, pathLine({ x: dLx, y: dLy }, { x: dLx, y: dLy - dyOff }), 2, color, 0.001, 0.0016);
      addFlow(roles, pathLine({ x: dRx, y: dRy }, { x: dRx, y: dRy - dyOff }), 2, color, 0.001, 0.0016);
      addFlow(roles, pathLine({ x: dLx, y: dLy - dyOff }, { x: dRx, y: dRy - dyOff }), 2, color, 0.001, 0.0016);
    }

    // NW residential
    addHouse(-8, -4.2, 1.4, 1.4, 12, 7, TERRA);
    addHouse(-6.2, -4.2, 1.4, 1.4, 12, 7, TERRA);
    addHouse(-8, -2, 1.4, 1.4, 12, 7, TERRA);
    addHouse(-6.2, -2, 1.4, 1.4, 12, 7, TERRA);
    // NE commercial
    addHouse(2.8, -4.2, 1.7, 1.7, 18, 10, AMBER);
    addHouse(5.2, -4.2, 1.5, 1.5, 16, 9, AMBER);
    addHouse(7.2, -3.5, 1.4, 1.4, 14, 8, AMBER);
    addHouse(3, -2, 1.4, 1.4, 14, 8, AMBER);
    // SE downtown (tall)
    addHouse(2.6, 3.6, 1.8, 1.8, 30, 12, SLATE);
    addHouse(5, 3.8, 1.6, 1.6, 26, 11, SLATE);
    addHouse(6.8, 4.5, 1.5, 1.5, 22, 10, SLATE);
    addHouse(3.5, 5.5, 1.3, 1.3, 20, 9, SLATE);
    // SW industrial
    addHouse(-8, 4, 2.2, 1.8, 14, 5, SAGE);
    addHouse(-4.5, 4.5, 1.8, 1.5, 13, 5, SAGE);

    // Central park trees near roundabout
    [iso(-1.5, 4.5, 0), iso(1.5, 4.5, 0), iso(0, 5.5, 0)].forEach(function (p) {
      addFlow(roles, pathLine({ x: p.x, y: p.y }, { x: p.x, y: p.y - 11 }), 4, TERRA, 0.0014, 0.0024);
      addFlow(roles, pathEllipse(p.x, p.y - 15, 8, 6), 9, MOSS, 0.0014, 0.0024);
    });

    // Pedestrians at intersections
    [iso(0, 3, 0), iso(-5, 3, 0), iso(5, 3, 0)].forEach(function (p) {
      addWalk(roles, p.x, p.y, 14, 3, SAGE_SOFT, 0.4);
    });
    return roles;
  }

  // ── 2. FOREST — branching trees with leaf clusters at tips, mycelial network, leaves, birds ──
  function sceneForest(W, H) {
    var roles = [];
    var ground = H * 0.62;
    // Sunbeams from top-right
    for (var s = 0; s < 5; s++) {
      var sx = W * 0.88 - s * 14;
      addFlow(roles, pathLine({ x: sx, y: -10 }, { x: sx - 90, y: ground - 30 }), 4, AMBER_SOFT, 0.002, 0.0034);
    }

    function addTree(x, height) {
      var trunkTop = { x: x, y: ground - height * 0.5 };
      var canopyH = height * 0.55;
      // Trunk (two parallel lines for thickness)
      addFlow(roles, pathLine({ x: x - 1.5, y: ground }, { x: x - 1, y: trunkTop.y }), 7, TERRA, 0.0016, 0.0028);
      addFlow(roles, pathLine({ x: x + 1.5, y: ground }, { x: x + 1, y: trunkTop.y }), 7, TERRA, 0.0016, 0.0028);
      // Main branches (4 from upper trunk via bezier)
      var tips = [];
      [-0.85, -0.5, 0.5, 0.85].forEach(function (a) {
        var startY = trunkTop.y + 8 * (Math.abs(a) - 0.5);
        var start = { x: x, y: startY };
        var dx = a * canopyH * 0.55;
        var dy = -canopyH * 0.55 * (1 - Math.abs(a) * 0.2);
        var tip = { x: x + dx, y: trunkTop.y + dy };
        var c1 = { x: x + dx * 0.3, y: trunkTop.y + dy * 0.2 - 4 };
        var c2 = { x: x + dx * 0.7, y: trunkTop.y + dy * 0.7 - 2 };
        addFlow(roles, pathBezier(start, c1, c2, tip), 5, TERRA, 0.0014, 0.0024);
        tips.push(tip);
      });
      // Two upper branches reaching highest
      var topL = { x: x - canopyH * 0.3, y: trunkTop.y - canopyH * 0.85 };
      var topR = { x: x + canopyH * 0.3, y: trunkTop.y - canopyH * 0.85 };
      addFlow(roles, pathBezier(trunkTop,
        { x: x - 4, y: trunkTop.y - 14 },
        { x: x - canopyH * 0.2, y: trunkTop.y - canopyH * 0.55 }, topL), 4, TERRA, 0.0014, 0.0024);
      addFlow(roles, pathBezier(trunkTop,
        { x: x + 4, y: trunkTop.y - 14 },
        { x: x + canopyH * 0.2, y: trunkTop.y - canopyH * 0.55 }, topR), 4, TERRA, 0.0014, 0.0024);
      tips.push(topL, topR);
      // Leaf clusters at each tip (irregular sizes)
      tips.forEach(function (tip) {
        addFlow(roles, pathEllipse(tip.x, tip.y - 4, 10 + Math.random() * 4, 7 + Math.random() * 3), 9, MOSS, 0.0012, 0.0022);
      });
      // Central crown cluster
      addFlow(roles, pathEllipse(x, trunkTop.y - canopyH * 0.35, canopyH * 0.35, canopyH * 0.3), 14, MOSS, 0.0012, 0.0022);
      // Falling leaves
      for (var k = 0; k < 3; k++) {
        var lx = x + (Math.random() - 0.5) * canopyH;
        addFlow(roles, pathLine(
          { x: lx, y: trunkTop.y - canopyH * 0.35 },
          { x: lx + (Math.random() - 0.5) * 28, y: ground - 4 }
        ), 2, MOSS, 0.0014, 0.0024);
      }
      // Roots curving down
      [-1.0, -0.5, 0.5, 1.0].forEach(function (a) {
        var rEnd = { x: x + Math.sin(a) * 48, y: ground + 26 + Math.cos(a) * 28 };
        addFlow(roles, pathBezier(
          { x: x, y: ground }, { x: x + Math.sin(a) * 15, y: ground + 8 },
          { x: x + Math.sin(a) * 32, y: ground + 18 }, rEnd
        ), 4, TERRA, 0.0012, 0.0024);
      });
    }

    // 6 trees at varied positions and heights
    var treeXs = [W * 0.1, W * 0.28, W * 0.46, W * 0.64, W * 0.82, W * 0.95];
    var heights = [H * 0.5, H * 0.58, H * 0.52, H * 0.6, H * 0.54, H * 0.46];
    treeXs.forEach(function (x, i) { addTree(x, heights[i]); });

    // Ground line
    addFlow(roles, pathLine({ x: -10, y: ground + 3 }, { x: W + 10, y: ground + 3 }), 24, SAGE, 0.0008, 0.0014);
    // Mycelial network beziers connecting adjacent roots
    for (var i = 0; i < treeXs.length - 1; i++) {
      var midX = (treeXs[i] + treeXs[i + 1]) / 2;
      var midY = ground + 42 + Math.random() * 18;
      addFlow(roles, pathBezier(
        { x: treeXs[i], y: ground + 22 },
        { x: midX, y: midY + 8 }, { x: midX, y: midY },
        { x: treeXs[i + 1], y: ground + 22 }
      ), 6, AMBER_SOFT, 0.0014, 0.0024);
    }
    // Birds
    addWalk(roles, W * 0.7, H * 0.1, 60, 5, SLATE, 0.6);
    addWalk(roles, W * 0.3, H * 0.08, 50, 4, SLATE, 0.6);
    return roles;
  }

  // ── 3. WATERSHED — rivers, tributaries, lake, mountains, settlements, sea ──
  function sceneWatershed(W, H) {
    var roles = [];

    // ── Meandering main river: 3 connected bezier S-segments with banks ──
    function addRiverSegment(p0, c1, c2, p1, mainCount, bankOff) {
      addFlow(roles, pathBezier(p0, c1, c2, p1), mainCount, SLATE, 0.0018, 0.003);
      // Left bank
      addFlow(roles, pathBezier(
        { x: p0.x - bankOff, y: p0.y }, { x: c1.x - bankOff, y: c1.y },
        { x: c2.x - bankOff, y: c2.y }, { x: p1.x - bankOff, y: p1.y }
      ), Math.round(mainCount * 0.35), SLATE_SOFT, 0.001, 0.0018);
      // Right bank
      addFlow(roles, pathBezier(
        { x: p0.x + bankOff, y: p0.y }, { x: c1.x + bankOff, y: c1.y },
        { x: c2.x + bankOff, y: c2.y }, { x: p1.x + bankOff, y: p1.y }
      ), Math.round(mainCount * 0.35), SLATE_SOFT, 0.001, 0.0018);
    }
    // Segment 1: top, curving right
    addRiverSegment(
      { x: W * 0.18, y: -10 }, { x: W * 0.42, y: H * 0.14 },
      { x: W * 0.18, y: H * 0.3 }, { x: W * 0.42, y: H * 0.46 }, 22, 5
    );
    // Segment 2: middle, curving back left
    addRiverSegment(
      { x: W * 0.42, y: H * 0.46 }, { x: W * 0.66, y: H * 0.55 },
      { x: W * 0.45, y: H * 0.7 }, { x: W * 0.7, y: H * 0.78 }, 22, 5
    );
    // Segment 3: bottom right to sea
    addRiverSegment(
      { x: W * 0.7, y: H * 0.78 }, { x: W * 0.86, y: H * 0.86 },
      { x: W * 0.94, y: H * 0.9 }, { x: W + 10, y: H + 10 }, 18, 5
    );

    // ── Tributaries also with banks ──
    addRiverSegment(
      { x: -10, y: H * 0.18 }, { x: W * 0.18, y: H * 0.3 },
      { x: W * 0.28, y: H * 0.4 }, { x: W * 0.42, y: H * 0.46 }, 16, 4
    );
    addRiverSegment(
      { x: W * 0.66, y: -10 }, { x: W * 0.64, y: H * 0.2 },
      { x: W * 0.6, y: H * 0.4 }, { x: W * 0.58, y: H * 0.6 }, 14, 4
    );

    // Lake at confluence
    addFlow(roles, pathEllipse(W * 0.7, H * 0.78, 28, 15), 18, SLATE_SOFT, 0.0014, 0.0024);

    // Mountain ridges (wavy beziers)
    for (var k = 0; k < 3; k++) {
      var y = H * (0.04 + k * 0.04);
      addFlow(roles, pathBezier(
        { x: -10, y: y }, { x: W * 0.3, y: y - 7 },
        { x: W * 0.7, y: y + 7 }, { x: W + 10, y: y }
      ), 12, AMBER_SOFT, 0.0008, 0.0014);
    }

    // Settlements
    [
      { x: W * 0.34, y: H * 0.42, n: 12 },
      { x: W * 0.55, y: H * 0.7, n: 10 },
      { x: W * 0.78, y: H * 0.88, n: 12 },
      { x: W * 0.22, y: H * 0.62, n: 8 }
    ].forEach(function (s) {
      addWalk(roles, s.x, s.y, 14, s.n, TERRA, 0.4);
      addFlow(roles, pathCircle(s.x, s.y, 6), 6, TERRA, 0.0014, 0.0024);
    });
    // Forest patch
    addWalk(roles, W * 0.12, H * 0.86, 50, 16, MOSS, 0.3);
    // Agricultural furrows
    for (var f = 0; f < 6; f++) {
      addFlow(roles, pathLine(
        { x: W * 0.42 + f * 7, y: H * 0.62 },
        { x: W * 0.42 + f * 7 + 24, y: H * 0.66 }
      ), 3, MOSS, 0.0006, 0.0012);
    }
    // Sea horizon at bottom-right
    addFlow(roles, pathLine({ x: W * 0.6, y: H * 0.96 }, { x: W + 10, y: H * 0.92 }), 18, SLATE_SOFT, 0.0008, 0.0014);
    return roles;
  }

  // ── 4. MARKET — 4×3 stall grid, aisles, plaza, specific trade routes ──
  function sceneMarket(W, H) {
    var roles = [];
    var stallColors = [TERRA, AMBER, MOSS, SLATE];
    var stalls = [];
    var gridX = [W * 0.16, W * 0.38, W * 0.6, W * 0.84];
    var gridY = [H * 0.22, H * 0.5, H * 0.78];
    gridX.forEach(function (x, ix) {
      gridY.forEach(function (y, iy) {
        var color = stallColors[(ix + iy) % 4];
        stalls.push({ x: x, y: y, c: color });
        addFlow(roles, pathCircle(x, y, 10), 8, color, 0.0014, 0.0024);
      });
    });
    // Horizontal aisles between stall rows
    for (var i = 0; i < gridY.length - 1; i++) {
      var midY = (gridY[i] + gridY[i + 1]) / 2;
      addFlow(roles, pathLine({ x: -10, y: midY }, { x: W + 10, y: midY }), 14, SAGE, 0.0028, 0.0046);
      addFlow(roles, pathLine({ x: W + 10, y: midY + 5 }, { x: -10, y: midY + 5 }), 12, SAGE_SOFT, 0.0026, 0.0044);
    }
    // Vertical aisles between stall columns
    for (var i = 0; i < gridX.length - 1; i++) {
      var midX = (gridX[i] + gridX[i + 1]) / 2;
      addFlow(roles, pathLine({ x: midX, y: -10 }, { x: midX, y: H + 10 }), 10, SAGE, 0.0026, 0.0044);
    }
    // Specific high-traffic diagonal trade routes
    [[0, 11], [3, 8], [1, 10], [2, 9]].forEach(function (pair) {
      var a = stalls[pair[0]], b = stalls[pair[1]];
      addFlow(roles, pathLine(a, b), 5, AMBER_SOFT, 0.0024, 0.0042);
      addFlow(roles, pathLine(b, a), 5, AMBER_SOFT, 0.0024, 0.0042);
    });
    // Entrance gateway from top
    addFlow(roles, pathLine({ x: W * 0.5, y: -10 }, { x: W * 0.5, y: H * 0.1 }), 10, AMBER, 0.003, 0.005);
    return roles;
  }

  // ── 5. BODY POLITIC — concentric rings, sectors, migration, capital ──
  function sceneBodyPolitic(W, H) {
    var roles = [];
    var cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) * 0.42;
    var rings = [
      { r: R, color: SAGE, count: 50, sp: [0.0006, 0.001] },
      { r: R * 0.78, color: AMBER, count: 40, sp: [0.0008, 0.0012] },
      { r: R * 0.58, color: MOSS, count: 32, sp: [0.001, 0.0016] },
      { r: R * 0.38, color: TERRA, count: 22, sp: [0.0014, 0.002] },
      { r: R * 0.18, color: INK, count: 14, sp: [0.0022, 0.003] }
    ];
    rings.forEach(function (ring) {
      addFlow(roles, pathCircle(cx, cy, ring.r), ring.count, ring.color, ring.sp[0], ring.sp[1]);
    });
    // 8 radial sector dividers
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      addFlow(roles, pathLine(
        { x: cx + Math.cos(a) * R * 0.18, y: cy + Math.sin(a) * R * 0.18 },
        { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }
      ), 4, INK, 0.0008, 0.0014);
    }
    // 4 migration paths (perimeter → core)
    [0, 2, 5, 7].forEach(function (i) {
      var a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      addFlow(roles, pathLine(
        { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R },
        { x: cx + Math.cos(a) * R * 0.2, y: cy + Math.sin(a) * R * 0.2 }
      ), 6, AMBER_SOFT, 0.0024, 0.004);
    });
    // Capital cluster at center
    addWalk(roles, cx, cy, R * 0.08, 10, INK, 0.3);
    // Perimeter scale ticks
    for (var t = 0; t < 24; t++) {
      var a = (t / 24) * Math.PI * 2;
      addFlow(roles, pathLine(
        { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R },
        { x: cx + Math.cos(a) * (R + 8), y: cy + Math.sin(a) * (R + 8) }
      ), 2, SAGE_SOFT, 0.001, 0.0016);
    }
    return roles;
  }

  // ── 6. INHERITANCE — 4 generations, dead branches, color genes ──
  function sceneInheritance(W, H) {
    var roles = [];
    var cx = W / 2;
    var gen0 = [{ x: cx, y: H * 0.1, c: MOSS }];
    var gen1 = [
      { x: cx - W * 0.22, y: H * 0.32, c: SAGE },
      { x: cx, y: H * 0.32, c: SAGE_SOFT, dead: true },
      { x: cx + W * 0.22, y: H * 0.32, c: SAGE }
    ];
    var gen2 = [
      { x: cx - W * 0.3, y: H * 0.58, c: AMBER },
      { x: cx - W * 0.18, y: H * 0.58, c: AMBER },
      { x: cx + W * 0.18, y: H * 0.58, c: TERRA },
      { x: cx + W * 0.3, y: H * 0.58, c: AMBER }
    ];
    var gen3 = [
      { x: cx - W * 0.36, y: H * 0.86, c: TERRA },
      { x: cx - W * 0.27, y: H * 0.86, c: AMBER },
      { x: cx - W * 0.16, y: H * 0.86, c: AMBER },
      { x: cx + W * 0.15, y: H * 0.86, c: TERRA },
      { x: cx + W * 0.22, y: H * 0.86, c: TERRA },
      { x: cx + W * 0.3, y: H * 0.86, c: AMBER },
      { x: cx + W * 0.37, y: H * 0.86, c: AMBER }
    ];
    [gen0, gen1, gen2, gen3].forEach(function (gen) {
      gen.forEach(function (n) {
        var count = n.dead ? 4 : 8;
        var radius = n.dead ? 4 : 7;
        addFlow(roles, pathCircle(n.x, n.y, radius), count, n.c, 0.0012, 0.0022);
      });
    });
    // Edges with downward gene-flow
    gen1.forEach(function (child) {
      addFlow(roles, pathLine(gen0[0], child), 6, child.dead ? SAGE_SOFT : SAGE_SOFT, 0.0016, 0.0026);
    });
    addFlow(roles, pathLine(gen1[0], gen2[0]), 5, AMBER_SOFT, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen1[0], gen2[1]), 5, AMBER_SOFT, 0.0016, 0.0026);
    // gen1[1] dies out — no descendants
    addFlow(roles, pathLine(gen1[2], gen2[2]), 5, TERRA, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen1[2], gen2[3]), 5, AMBER_SOFT, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[0], gen3[0]), 4, TERRA, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[0], gen3[1]), 4, AMBER, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[1], gen3[2]), 4, AMBER, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[2], gen3[3]), 4, TERRA, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[2], gen3[4]), 4, TERRA, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[3], gen3[5]), 4, AMBER, 0.0016, 0.0026);
    addFlow(roles, pathLine(gen2[3], gen3[6]), 4, AMBER, 0.0016, 0.0026);
    return roles;
  }

  // ═══════════════════════════════════════════════════════════
  // MODE SCENES — real-world imagery for the three modes
  // ═══════════════════════════════════════════════════════════

  // Engine: cross-section of earth strata
  function modeEngine(W, H) {
    var roles = [];
    var bands = [
      { y: H * 0.12, color: SLATE_SOFT, density: 8 },
      { y: H * 0.32, color: MOSS, density: 14 },
      { y: H * 0.55, color: AMBER, density: 18 },
      { y: H * 0.82, color: TERRA, density: 16 }
    ];
    bands.forEach(function (b) {
      addFlow(roles, pathLine({ x: -10, y: b.y }, { x: W + 10, y: b.y }), b.density, b.color, 0.0008, 0.0016);
    });
    // Vertical connections (water/nutrients ascending and descending)
    for (var x = 0.15; x < 0.95; x += 0.16) {
      addFlow(roles, pathLine({ x: W * x, y: H + 4 }, { x: W * x, y: -4 }), 6, AMBER_SOFT, 0.0024, 0.0044);
    }
    addWalk(roles, W / 2, H * 0.35, W * 0.45, 8, SAGE, 0.5);
    return roles;
  }

  // Garden: SimCity-style isometric village with roads, houses, trees, agents walking in background
  function modeGarden(W, H) {
    var roles = [];
    var ox = W / 2, oy = H * 0.58;
    var tw = Math.min(W / 16, 22), th = tw / 2;
    function iso(x, y, z) { return { x: ox + (x - y) * (tw / 2), y: oy + (x + y) * (th / 2) - (z || 0) }; }

    // ── Iso road grid ──
    // Two horizontal arterials
    addFlow(roles, pathLine(iso(-8, -1.5, 0), iso(8, -1.5, 0)), 9, AMBER, 0.0026, 0.0044);
    addFlow(roles, pathLine(iso(8, -1.2, 0), iso(-8, -1.2, 0)), 7, AMBER_SOFT, 0.0024, 0.0042);
    addFlow(roles, pathLine(iso(-8, 2.5, 0), iso(8, 2.5, 0)), 9, AMBER, 0.0026, 0.0044);
    addFlow(roles, pathLine(iso(8, 2.8, 0), iso(-8, 2.8, 0)), 7, AMBER_SOFT, 0.0024, 0.0042);
    // Vertical streets
    addFlow(roles, pathLine(iso(-4, -4, 0), iso(-4, 4, 0)), 7, SLATE, 0.0026, 0.0044);
    addFlow(roles, pathLine(iso(0, -4, 0), iso(0, 4, 0)), 7, SLATE, 0.0026, 0.0044);
    addFlow(roles, pathLine(iso(4, -4, 0), iso(4, 4, 0)), 7, SLATE, 0.0026, 0.0044);

    // ── House builder ──
    function addHouse(gx, gy, w, d, wH, rH, color) {
      var bsw = iso(gx, gy + d, 0), bse = iso(gx + w, gy + d, 0), bne = iso(gx + w, gy, 0);
      var wsw = iso(gx, gy + d, wH), wse = iso(gx + w, gy + d, wH);
      var wne = iso(gx + w, gy, wH);
      var aS = iso(gx + w / 2, gy + d, wH + rH), aN = iso(gx + w / 2, gy, wH + rH);
      [[bsw, bse], [bse, bne], [bsw, wsw], [bse, wse], [bne, wne],
       [wsw, wse], [wse, wne], [wsw, aS], [wse, aS], [wne, aN], [wse, aN], [aN, aS]].forEach(function (e) {
        addFlow(roles, pathLine(e[0], e[1]), 2, color, 0.0008, 0.0014);
      });
    }

    // 8 houses across districts
    addHouse(-7.5, -3.8, 1.4, 1.4, 10, 5, TERRA);
    addHouse(-5.5, -3.8, 1.4, 1.4, 10, 5, TERRA);
    addHouse(-2.7, -3.8, 1.4, 1.4, 14, 6, AMBER);
    addHouse(2.7, -3.8, 1.4, 1.4, 14, 6, AMBER);
    addHouse(5, -3.5, 1.4, 1.4, 11, 5, AMBER);
    addHouse(-7.5, 0, 1.4, 1.4, 12, 6, SLATE);
    addHouse(-2.5, 0, 1.5, 1.5, 16, 7, SLATE);
    addHouse(2.5, 0, 1.5, 1.5, 16, 7, SLATE);
    addHouse(5.5, 0, 1.4, 1.4, 11, 5, SAGE);
    addHouse(-5.5, 3, 1.5, 1.5, 9, 4, SAGE);
    addHouse(2.7, 3, 1.5, 1.5, 9, 4, SAGE);

    // Trees scattered
    [iso(-3.5, -1, 0), iso(3.5, -1, 0), iso(-3, 2, 0), iso(3, 2, 0)].forEach(function (p) {
      addFlow(roles, pathLine({ x: p.x, y: p.y }, { x: p.x, y: p.y - 7 }), 3, TERRA, 0.0014, 0.0024);
      addFlow(roles, pathEllipse(p.x, p.y - 10, 5, 4), 6, MOSS, 0.0014, 0.0024);
    });

    // A few agents walking along the roads in the background
    var roadCenter = iso(0, -1.5, 0);
    addWalk(roles, roadCenter.x, roadCenter.y, W * 0.42, 5, SAGE_SOFT, 0.5);
    var roadCenter2 = iso(0, 2.5, 0);
    addWalk(roles, roadCenter2.x, roadCenter2.y, W * 0.42, 4, SAGE_SOFT, 0.5);
    return roles;
  }

  // Platform: control room — line chart, knobs, bar chart, dial, with signal flows between
  function modePlatform(W, H) {
    var roles = [];
    var pad = 4;
    // Outer console frame
    [
      pathLine({ x: pad, y: pad }, { x: W - pad, y: pad }),
      pathLine({ x: W - pad, y: pad }, { x: W - pad, y: H - pad }),
      pathLine({ x: W - pad, y: H - pad }, { x: pad, y: H - pad }),
      pathLine({ x: pad, y: H - pad }, { x: pad, y: pad })
    ].forEach(function (e) { addFlow(roles, e, 4, INK, 0.0006, 0.0012); });
    // Quadrant dividers
    var mX = W / 2, mY = H / 2;
    addFlow(roles, pathLine({ x: mX, y: pad }, { x: mX, y: H - pad }), 6, INK, 0.0006, 0.0012);
    addFlow(roles, pathLine({ x: pad, y: mY }, { x: W - pad, y: mY }), 6, INK, 0.0006, 0.0012);

    // ── TOP-LEFT PANEL: Live line chart (wavy bezier reading) ──
    var chart1Start = { x: pad + 6, y: mY * 0.7 };
    var chart1End = { x: mX - 6, y: mY * 0.55 };
    addFlow(roles, pathBezier(
      chart1Start, { x: mX * 0.35, y: mY * 0.3 },
      { x: mX * 0.7, y: mY * 0.65 }, chart1End
    ), 12, SAGE, 0.002, 0.0034);
    // Chart baseline
    addFlow(roles, pathLine({ x: pad + 6, y: mY * 0.85 }, { x: mX - 6, y: mY * 0.85 }), 4, INK, 0.0006, 0.0012);

    // ── TOP-RIGHT PANEL: Two knobs with pointer indicators ──
    var knob1 = { x: mX + (W - mX) * 0.3, y: mY * 0.5 };
    var knob2 = { x: mX + (W - mX) * 0.7, y: mY * 0.5 };
    [{ k: knob1, c: TERRA, ang: -Math.PI / 4 }, { k: knob2, c: AMBER, ang: Math.PI / 3 }].forEach(function (kk) {
      addFlow(roles, pathCircle(kk.k.x, kk.k.y, 11), 14, kk.c, 0.0016, 0.0026);
      addFlow(roles, pathCircle(kk.k.x, kk.k.y, 5), 6, kk.c, 0.002, 0.003);
      // Pointer indicator
      addFlow(roles, pathLine(
        { x: kk.k.x, y: kk.k.y },
        { x: kk.k.x + Math.cos(kk.ang) * 9, y: kk.k.y + Math.sin(kk.ang) * 9 }
      ), 3, INK, 0.0018, 0.0028);
    });

    // ── BOTTOM-LEFT PANEL: Bar chart (4 vertical bars of varied heights) ──
    var barBaseY = H - pad - 6;
    var barH = [22, 14, 30, 18];
    var barColor = [MOSS, AMBER, TERRA, SLATE];
    for (var b = 0; b < 4; b++) {
      var bx = pad + 8 + b * ((mX - pad - 16) / 4);
      rectEdges(bx, barBaseY - barH[b], (mX - pad - 16) / 5, barH[b]).forEach(function (e) {
        addFlow(roles, e, 2, barColor[b], 0.0012, 0.002);
      });
    }
    addFlow(roles, pathLine({ x: pad + 4, y: barBaseY + 2 }, { x: mX - 4, y: barBaseY + 2 }), 4, INK, 0.0006, 0.0012);

    // ── BOTTOM-RIGHT PANEL: Semicircular gauge with needle ──
    var dialC = { x: mX + (W - mX) * 0.5, y: mY + (H - mY) * 0.7 };
    var dialR = 18;
    // Semicircle arc (180° → 360°, i.e. top half)
    addFlow(roles, pathArc(dialC.x, dialC.y, dialR, Math.PI, Math.PI * 2), 14, SLATE, 0.0014, 0.0024);
    // Tick marks at edges
    [Math.PI, Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75, Math.PI * 2].forEach(function (a) {
      addFlow(roles, pathLine(
        { x: dialC.x + Math.cos(a) * (dialR - 3), y: dialC.y + Math.sin(a) * (dialR - 3) },
        { x: dialC.x + Math.cos(a) * dialR, y: dialC.y + Math.sin(a) * dialR }
      ), 2, INK, 0.0012, 0.002);
    });
    // Needle
    var needleAng = Math.PI + Math.PI * 0.55;
    addFlow(roles, pathLine(
      dialC,
      { x: dialC.x + Math.cos(needleAng) * (dialR - 2), y: dialC.y + Math.sin(needleAng) * (dialR - 2) }
    ), 4, TERRA, 0.002, 0.0032);
    addFlow(roles, pathCircle(dialC.x, dialC.y, 2), 3, INK, 0.002, 0.0032);

    // ── Signal flows between panels (suggesting knob changes the chart, etc.) ──
    addFlow(roles, pathBezier(
      chart1End, { x: mX + 4, y: mY * 0.4 },
      { x: knob1.x - 6, y: mY * 0.5 }, knob1
    ), 4, AMBER_SOFT, 0.0028, 0.0044);
    addFlow(roles, pathBezier(
      { x: mX - 12, y: barBaseY - 12 },
      { x: mX, y: barBaseY - 20 },
      { x: dialC.x - 14, y: dialC.y - 4 }, dialC
    ), 4, AMBER_SOFT, 0.0028, 0.0044);
    addFlow(roles, pathBezier(
      knob2, { x: knob2.x, y: mY + 4 },
      { x: dialC.x, y: dialC.y - dialR - 8 }, { x: dialC.x, y: dialC.y - dialR }
    ), 4, AMBER_SOFT, 0.0028, 0.0044);
    return roles;
  }

  // ═══════════════════════════════════════════════════════════
  // ENGINE RING — agents fill body polygons to form Vitruvian silhouette
  // ═══════════════════════════════════════════════════════════
  function engineRingScene(W, H) {
    var roles = [];
    var cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) * 0.44;

    // Proportions matched to the classic drawing: the man spans the circle —
    // head at circle top, feet-together at circle bottom, navel at dead center.
    var feetY = cy + R * 0.985, headTopY = cy - R * 0.985;
    var sqHalf = R * 0.83, sqTop = feetY - sqHalf * 2;
    var headR = R * 0.1, headCY = headTopY + headR * 1.05;
    var shouldersY = cy - R * 0.5, shoulderHalf = R * 0.23;
    var waistY = cy + R * 0.03, waistHalf = R * 0.135;
    var hipsY = cy + R * 0.22, hipsHalf = R * 0.16;
    var raisedAng = 0.72, spreadAng = Math.PI * 0.155;

    // ── Frame: circle + square + guide lines ──
    addFlow(roles, pathCircle(cx, cy, R), 46, INK, 0.0006, 0.0012);
    var sqPts = [
      { x: cx - sqHalf, y: sqTop }, { x: cx + sqHalf, y: sqTop },
      { x: cx + sqHalf, y: feetY }, { x: cx - sqHalf, y: feetY }
    ];
    for (var i = 0; i < 4; i++) {
      addFlow(roles, pathLine(sqPts[i], sqPts[(i + 1) % 4]), 12, INK, 0.0006, 0.0012);
    }
    [shouldersY, cy, hipsY, cy + R * 0.58].forEach(function (y) {
      addFlow(roles, pathLine({ x: cx - sqHalf + 4, y: y }, { x: cx + sqHalf - 4, y: y }), 2, SAGE_SOFT, 0.0008, 0.0014);
    });

    // ── Contour-flow helpers ──
    function pathPoly(pts, closed) {
      var arr = closed ? pts.concat([pts[0]]) : pts;
      var segs = [], total = 0;
      for (var i = 0; i < arr.length - 1; i++) {
        var dx = arr[i + 1].x - arr[i].x, dy = arr[i + 1].y - arr[i].y;
        var l = Math.sqrt(dx * dx + dy * dy) || 0.001;
        segs.push({ a: arr[i], b: arr[i + 1], l: l, start: total });
        total += l;
      }
      return {
        len: total,
        fn: function (t) {
          var dTot = Math.max(0, Math.min(0.9999, t)) * total;
          for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            if (dTot <= s.start + s.l) {
              var u = (dTot - s.start) / s.l;
              return { x: s.a.x + (s.b.x - s.a.x) * u, y: s.a.y + (s.b.y - s.a.y) * u };
            }
          }
          return arr[arr.length - 1];
        }
      };
    }
    function flowPoly(pts, closed, color, spacing) {
      var p = pathPoly(pts, closed);
      addFlow(roles, p.fn, Math.max(3, Math.round(p.len / (spacing || 5.5))), color, 0.0007, 0.0014);
    }
    function flowCircle(x, y, r, color, spacing) {
      addFlow(roles, pathCircle(x, y, r), Math.max(4, Math.round(2 * Math.PI * r / (spacing || 5))), color, 0.0009, 0.0018);
    }
    function lerp(p0, p1, t) { return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t }; }
    function flowLimb(joints, widths, color) {
      var edgeA = [], edgeB = [];
      for (var i = 0; i < joints.length - 1; i++) {
        var dx = joints[i + 1].x - joints[i].x, dy = joints[i + 1].y - joints[i].y;
        var l = Math.sqrt(dx * dx + dy * dy), nx = -dy / l, ny = dx / l;
        if (i === 0) {
          edgeA.push({ x: joints[0].x + nx * widths[0], y: joints[0].y + ny * widths[0] });
          edgeB.push({ x: joints[0].x - nx * widths[0], y: joints[0].y - ny * widths[0] });
        }
        edgeA.push({ x: joints[i + 1].x + nx * widths[i + 1], y: joints[i + 1].y + ny * widths[i + 1] });
        edgeB.push({ x: joints[i + 1].x - nx * widths[i + 1], y: joints[i + 1].y - ny * widths[i + 1] });
      }
      flowPoly(edgeA, false, color, 5.5);
      flowPoly(edgeB, false, color, 5.5);
    }

    // ── Head: skull + hair hugging the crown + neck into trapezius ──
    flowCircle(cx, headCY, headR, INK, 4);
    addFlow(roles, pathArc(cx, headCY, headR * 1.22, Math.PI * 1.06, Math.PI * 1.94), 12, INK, 0.001, 0.002);
    addFlow(roles, pathArc(cx, headCY, headR * 1.42, Math.PI * 1.24, Math.PI * 1.76), 7, INK, 0.001, 0.002);
    flowPoly([{ x: cx - headR * 0.45, y: headCY + headR * 1.1 }, { x: cx - shoulderHalf * 0.68, y: shouldersY }], false, INK, 5);
    flowPoly([{ x: cx + headR * 0.45, y: headCY + headR * 1.1 }, { x: cx + shoulderHalf * 0.68, y: shouldersY }], false, INK, 5);

    // ── Torso: outline only — neck slope, chest swell, waist pinch, hip, groin V ──
    flowPoly([
      { x: cx - shoulderHalf, y: shouldersY },
      { x: cx - shoulderHalf * 0.97, y: shouldersY + R * 0.07 },
      { x: cx - shoulderHalf * 0.8, y: shouldersY + R * 0.16 },
      { x: cx - waistHalf * 1.25, y: cy - R * 0.14 },
      { x: cx - waistHalf, y: waistY },
      { x: cx - hipsHalf * 0.97, y: hipsY - R * 0.05 },
      { x: cx - hipsHalf, y: hipsY },
      { x: cx - hipsHalf * 0.45, y: hipsY + R * 0.07 },
      { x: cx, y: hipsY + R * 0.1 },
      { x: cx + hipsHalf * 0.45, y: hipsY + R * 0.07 },
      { x: cx + hipsHalf, y: hipsY },
      { x: cx + hipsHalf * 0.97, y: hipsY - R * 0.05 },
      { x: cx + waistHalf, y: waistY },
      { x: cx + waistHalf * 1.25, y: cy - R * 0.14 },
      { x: cx + shoulderHalf * 0.8, y: shouldersY + R * 0.16 },
      { x: cx + shoulderHalf * 0.97, y: shouldersY + R * 0.07 },
      { x: cx + shoulderHalf, y: shouldersY }
    ], true, INK, 5);

    // ── Arms: horizontal pair to square sides + raised pair to the circle ──
    var shL = { x: cx - shoulderHalf + 3, y: shouldersY + 5 };
    var shR = { x: cx + shoulderHalf - 3, y: shouldersY + 5 };
    var armHorizL = { x: cx - sqHalf, y: shouldersY };
    var armHorizR = { x: cx + sqHalf, y: shouldersY };
    var armRaisedL = { x: cx - Math.cos(raisedAng) * R, y: cy - Math.sin(raisedAng) * R };
    var armRaisedR = { x: cx + Math.cos(raisedAng) * R, y: cy - Math.sin(raisedAng) * R };
    function arm(sh, tip) {
      // outline with bicep swell, elbow waist, forearm swell, wrist taper
      var bicep = lerp(sh, tip, 0.28), elbow = lerp(sh, tip, 0.52), fore = lerp(sh, tip, 0.72);
      flowLimb([sh, bicep, elbow, fore, tip], [8.5, 9.5, 5.5, 6.2, 2.6], INK);
      flowCircle(tip.x, tip.y, 4.5, INK, 4.5);
    }
    arm(shL, armHorizL); arm(shR, armHorizR);
    arm(shL, armRaisedL); arm(shR, armRaisedR);

    // ── Legs: together pair to circle bottom + spread pair to the circle ──
    var hipL = { x: cx - hipsHalf * 0.72, y: hipsY };
    var hipR = { x: cx + hipsHalf * 0.72, y: hipsY };
    var footTogetherL = { x: cx - hipsHalf * 0.42, y: feetY };
    var footTogetherR = { x: cx + hipsHalf * 0.42, y: feetY };
    var footSpreadL = { x: cx - Math.sin(spreadAng) * R, y: cy + Math.cos(spreadAng) * R };
    var footSpreadR = { x: cx + Math.sin(spreadAng) * R, y: cy + Math.cos(spreadAng) * R };
    function leg(hip, foot, sgn) {
      // outline with thigh swell, knee waist, calf swell, ankle taper
      var thigh = lerp(hip, foot, 0.22), knee = lerp(hip, foot, 0.5), calf = lerp(hip, foot, 0.66);
      flowLimb([hip, thigh, knee, calf, foot], [11, 12, 6, 7.5, 2.8], INK);
      flowPoly([
        { x: foot.x - sgn * 3, y: foot.y - 5 },
        { x: foot.x - sgn * 3, y: foot.y },
        { x: foot.x + sgn * 13, y: foot.y }
      ], false, INK, 4);
    }
    leg(hipL, footTogetherL, -1); leg(hipR, footTogetherR, 1);
    leg(hipL, footSpreadL, -1); leg(hipR, footSpreadR, 1);

    return roles;
  }

  // ═══════════════════════════════════════════════════════════
  // WORLD SCENES — real-world imagery for each world card
  // ═══════════════════════════════════════════════════════════

  // Foraging: meadow with berry patches + forager routes
  function worldForaging(W, H) {
    var roles = [];
    var patches = [
      { x: W * 0.22, y: H * 0.36, r: 10 },
      { x: W * 0.66, y: H * 0.46, r: 12 },
      { x: W * 0.42, y: H * 0.74, r: 9 }
    ];
    patches.forEach(function (p) {
      addFlow(roles, pathCircle(p.x, p.y, p.r), 10, AMBER, 0.0012, 0.0022);
    });
    for (var i = 0; i < patches.length; i++) {
      for (var j = i + 1; j < patches.length; j++) {
        addFlow(roles, pathLine(patches[i], patches[j]), 4, SAGE_SOFT, 0.0024, 0.004);
      }
    }
    addWalk(roles, W / 2, H / 2, W * 0.4, 12, SAGE, 0.5);
    return roles;
  }

  // Commons: village well at center, 4 houses, water-fetching paths
  function worldCommons(W, H) {
    var roles = [];
    var cx = W / 2, cy = H / 2;
    addFlow(roles, pathCircle(cx, cy, 13), 14, SLATE, 0.0014, 0.0024);
    addFlow(roles, pathCircle(cx, cy, 9), 10, SLATE_SOFT, 0.0018, 0.003);
    var R = Math.min(W, H) * 0.4;
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(function (a) {
      var hx = cx + Math.cos(a) * R, hy = cy + Math.sin(a) * R;
      addWalk(roles, hx, hy, 8, 4, SAGE, 0.3);
      addFlow(roles, pathLine({ x: hx, y: hy }, { x: cx, y: cy }), 5, AMBER_SOFT, 0.002, 0.0036);
    });
    return roles;
  }

  // Conflict: two camps with patrols + border fence
  function worldConflict(W, H) {
    var roles = [];
    addFlow(roles, pathCircle(W * 0.25, H * 0.5, 18), 12, TERRA, 0.0012, 0.0022);
    addWalk(roles, W * 0.25, H * 0.5, 17, 7, TERRA, 0.4);
    addFlow(roles, pathCircle(W * 0.75, H * 0.5, 18), 12, SLATE, 0.0012, 0.0022);
    addWalk(roles, W * 0.75, H * 0.5, 17, 7, SLATE, 0.4);
    // Border fence dashes
    for (var y = H * 0.18; y <= H * 0.82; y += H * 0.1) {
      addFlow(roles, pathLine({ x: W * 0.5, y: y }, { x: W * 0.5, y: y + H * 0.05 }), 2, INK, 0.0012, 0.002);
    }
    // Patrol routes
    addFlow(roles, pathLine({ x: W * 0.48, y: H * 0.18 }, { x: W * 0.48, y: H * 0.82 }), 5, TERRA, 0.002, 0.0036);
    addFlow(roles, pathLine({ x: W * 0.52, y: H * 0.82 }, { x: W * 0.52, y: H * 0.18 }), 5, SLATE, 0.002, 0.0036);
    return roles;
  }

  // Trading: 4 stalls in a row + customer aisle + goods flows
  function worldTrading(W, H) {
    var roles = [];
    var stallY = H * 0.3;
    [0.16, 0.4, 0.6, 0.84].forEach(function (x, i) {
      var color = [AMBER, TERRA, MOSS, SLATE][i];
      addFlow(roles, pathCircle(W * x, stallY, 8), 6, color, 0.0014, 0.0024);
      addFlow(roles, pathLine({ x: W * x, y: stallY }, { x: W * x, y: H * 0.55 }), 3, AMBER_SOFT, 0.002, 0.0036);
    });
    addFlow(roles, pathLine({ x: -10, y: H * 0.58 }, { x: W + 10, y: H * 0.58 }), 12, SAGE, 0.0024, 0.0042);
    addFlow(roles, pathLine({ x: W + 10, y: H * 0.64 }, { x: -10, y: H * 0.64 }), 10, SAGE_SOFT, 0.0024, 0.0042);
    addWalk(roles, W / 2, H * 0.82, W * 0.4, 6, AMBER_SOFT, 0.4);
    return roles;
  }

  // Inheritance: 3-gen family with lineage paths
  function worldInheritance(W, H) {
    var roles = [];
    var cx = W / 2;
    var gens = [
      [{ x: cx, y: H * 0.18, c: MOSS }],
      [{ x: cx - W * 0.18, y: H * 0.55, c: SAGE }, { x: cx + W * 0.18, y: H * 0.55, c: SAGE }],
      [{ x: cx - W * 0.3, y: H * 0.86, c: AMBER }, { x: cx - W * 0.08, y: H * 0.86, c: AMBER },
       { x: cx + W * 0.08, y: H * 0.86, c: TERRA }, { x: cx + W * 0.3, y: H * 0.86, c: AMBER }]
    ];
    gens.forEach(function (gen) { gen.forEach(function (n) { addFlow(roles, pathCircle(n.x, n.y, 5), 5, n.c, 0.0014, 0.0024); }); });
    [[0, 0, 1, 0], [0, 0, 1, 1], [1, 0, 2, 0], [1, 0, 2, 1], [1, 1, 2, 2], [1, 1, 2, 3]].forEach(function (e) {
      addFlow(roles, pathLine(gens[e[0]][e[1]], gens[e[2]][e[3]]), 5, SAGE_SOFT, 0.0014, 0.0024);
    });
    return roles;
  }

  // Yours: drafting table outline with measuring marks + central compass
  function worldYours(W, H) {
    var roles = [];
    var pad = 12;
    var corners = [{ x: pad, y: pad }, { x: W - pad, y: pad }, { x: W - pad, y: H - pad }, { x: pad, y: H - pad }];
    for (var i = 0; i < 4; i++) {
      addFlow(roles, pathLine(corners[i], corners[(i + 1) % 4]), 6, MOSS, 0.001, 0.002);
    }
    // Measuring ticks along top and bottom
    for (var x = pad + 18; x < W - pad; x += 18) {
      addFlow(roles, pathLine({ x: x, y: pad }, { x: x, y: pad + 4 }), 2, INK, 0.001, 0.0015);
      addFlow(roles, pathLine({ x: x, y: H - pad }, { x: x, y: H - pad - 4 }), 2, INK, 0.001, 0.0015);
    }
    // Compass center
    addFlow(roles, pathCircle(W / 2, H / 2, 10), 8, MOSS, 0.0014, 0.0024);
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI * 2;
      addFlow(roles, pathLine(
        { x: W / 2, y: H / 2 },
        { x: W / 2 + Math.cos(a) * 20, y: H / 2 + Math.sin(a) * 20 }
      ), 3, SAGE_SOFT, 0.002, 0.003);
    }
    return roles;
  }

  // ═══════════════════════════════════════════════════════════
  // CUSTOM RENDERERS — real graphics, not agent-traced
  // ═══════════════════════════════════════════════════════════

  // ── GARDEN: SimCity-style isometric city ──
  function createGardenRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, tw = 0, th = 0, ox = 0, oy = 0;
    var running = true;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      if (W < 10 || H < 10) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      tw = Math.min(W / 14, 28);
      th = tw / 2;
      ox = W / 2; oy = H * 0.58;
    }
    function iso(gx, gy, z) {
      return { x: ox + (gx - gy) * (tw / 2), y: oy + (gx + gy) * (th / 2) - (z || 0) };
    }
    function darken(hex, f) {
      var h = hex.replace('#', '');
      var r = parseInt(h.substr(0, 2), 16);
      var g = parseInt(h.substr(2, 2), 16);
      var b = parseInt(h.substr(4, 2), 16);
      return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
    }
    function drawTile(gx, gy, color) {
      var p1 = iso(gx, gy, 0), p2 = iso(gx + 1, gy, 0);
      var p3 = iso(gx + 1, gy + 1, 0), p4 = iso(gx, gy + 1, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    function drawHouse(h) {
      var gx = h[0], gy = h[1], w = h[2], d = h[3], wH = h[4], rH = h[5], wc = h[6], rc = h[7];
      var bsw = iso(gx, gy + d, 0), bse = iso(gx + w, gy + d, 0), bne = iso(gx + w, gy, 0);
      var wsw = iso(gx, gy + d, wH), wse = iso(gx + w, gy + d, wH), wne = iso(gx + w, gy, wH);
      var aS = iso(gx + w / 2, gy + d, wH + rH), aN = iso(gx + w / 2, gy, wH + rH);
      // Front wall (south, lit)
      ctx.fillStyle = wc;
      ctx.beginPath();
      ctx.moveTo(bsw.x, bsw.y); ctx.lineTo(bse.x, bse.y);
      ctx.lineTo(wse.x, wse.y); ctx.lineTo(wsw.x, wsw.y);
      ctx.closePath(); ctx.fill();
      // Right wall (east, shaded)
      ctx.fillStyle = darken(wc, 0.72);
      ctx.beginPath();
      ctx.moveTo(bse.x, bse.y); ctx.lineTo(bne.x, bne.y);
      ctx.lineTo(wne.x, wne.y); ctx.lineTo(wse.x, wse.y);
      ctx.closePath(); ctx.fill();
      // Front roof slope (lit)
      ctx.fillStyle = rc;
      ctx.beginPath();
      ctx.moveTo(wsw.x, wsw.y); ctx.lineTo(wse.x, wse.y);
      ctx.lineTo(aS.x, aS.y); ctx.closePath(); ctx.fill();
      // Right roof slope (shaded)
      ctx.fillStyle = darken(rc, 0.78);
      ctx.beginPath();
      ctx.moveTo(wse.x, wse.y); ctx.lineTo(wne.x, wne.y);
      ctx.lineTo(aN.x, aN.y); ctx.lineTo(aS.x, aS.y);
      ctx.closePath(); ctx.fill();
      // Outlines
      ctx.strokeStyle = 'rgba(50, 48, 44, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bsw.x, bsw.y); ctx.lineTo(bse.x, bse.y); ctx.lineTo(bne.x, bne.y);
      ctx.moveTo(bsw.x, bsw.y); ctx.lineTo(wsw.x, wsw.y);
      ctx.lineTo(wse.x, wse.y); ctx.lineTo(wne.x, wne.y);
      ctx.moveTo(bse.x, bse.y); ctx.lineTo(wse.x, wse.y);
      ctx.moveTo(wsw.x, wsw.y); ctx.lineTo(aS.x, aS.y); ctx.lineTo(wse.x, wse.y);
      ctx.moveTo(aS.x, aS.y); ctx.lineTo(aN.x, aN.y); ctx.lineTo(wne.x, wne.y);
      ctx.stroke();
      // Door
      var t0 = 0.42, t1 = 0.58;
      var dLx = bsw.x + (bse.x - bsw.x) * t0;
      var dLy = bsw.y + (bse.y - bsw.y) * t0;
      var dRx = bsw.x + (bse.x - bsw.x) * t1;
      var dRy = bsw.y + (bse.y - bsw.y) * t1;
      var doorH = wH * 0.65;
      ctx.fillStyle = darken(wc, 0.42);
      ctx.beginPath();
      ctx.moveTo(dLx, dLy); ctx.lineTo(dRx, dRy);
      ctx.lineTo(dRx, dRy - doorH); ctx.lineTo(dLx, dLy - doorH);
      ctx.closePath(); ctx.fill();
    }
    function drawTree(gx, gy) {
      var base = iso(gx, gy, 0);
      ctx.fillStyle = 'rgba(50, 48, 44, 0.13)';
      ctx.beginPath(); ctx.ellipse(base.x, base.y, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8c6a40';
      ctx.fillRect(base.x - 1.6, base.y - 9, 3.2, 9);
      ctx.fillStyle = '#8a8f6a';
      ctx.beginPath();
      ctx.arc(base.x - 4, base.y - 11, 5, 0, Math.PI * 2);
      ctx.arc(base.x + 4, base.y - 11, 5, 0, Math.PI * 2);
      ctx.arc(base.x, base.y - 15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(50, 48, 44, 0.4)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    var houses = [
      [-6, -3.5, 1.5, 1.5, 10, 5, '#b69162', '#8c6a40'],
      [-4, -3.5, 1.5, 1.5, 10, 5, '#b69162', '#8c6a40'],
      [-1.5, -3.5, 1.5, 1.5, 13, 6, '#cfae82', '#a37f50'],
      [1.5, -3.5, 1.5, 1.5, 13, 6, '#cfae82', '#a37f50'],
      [3.5, -3.2, 1.5, 1.5, 11, 5, '#b69162', '#8c6a40'],
      [-6, -0.5, 1.5, 1.5, 14, 6, '#7a95ad', '#2e4a66'],
      [-1.5, -0.5, 1.6, 1.6, 18, 7, '#7a95ad', '#2e4a66'],
      [1.5, -0.5, 1.6, 1.6, 18, 7, '#7a95ad', '#2e4a66'],
      [3.5, -0.5, 1.5, 1.5, 12, 5, '#8fb0cc', '#4a7196'],
      [-4, 2.5, 1.5, 1.5, 10, 4, '#8fb0cc', '#4a7196'],
      [1.5, 2.5, 1.5, 1.5, 10, 4, '#8fb0cc', '#4a7196']
    ];
    var trees = [[-2.5, 1], [2.5, 1], [-3, 4], [3, 4]];
    var agents = [];
    for (var i = 0; i < 12; i++) {
      agents.push({
        gx: -6 + Math.random() * 12, gy: -3 + Math.random() * 7,
        vx: (Math.random() - 0.5) * 0.025, vy: (Math.random() - 0.5) * 0.025,
        c: ['#4a7196', '#b69162', '#2e4a66', '#b96a56'][Math.floor(Math.random() * 4)]
      });
    }

    function draw() {
      if (!running) { requestAnimationFrame(draw); return; }
      ctx.fillStyle = '#e3e0d8';
      ctx.fillRect(0, 0, W, H);
      // Grass base
      for (var gx = -7; gx < 6; gx++) {
        for (var gy = -4; gy < 5; gy++) drawTile(gx, gy, '#d3d7c6');
      }
      // Roads
      for (var gx = -7; gx < 6; gx++) { drawTile(gx, -2, '#b5b1a6'); drawTile(gx, 1.5, '#b5b1a6'); }
      for (var gy = -4; gy < 5; gy++) { drawTile(-3, gy, '#b5b1a6'); drawTile(0, gy, '#b5b1a6'); drawTile(3, gy, '#b5b1a6'); }
      // Grid lines (very faint)
      ctx.strokeStyle = 'rgba(50, 48, 44, 0.05)'; ctx.lineWidth = 0.5;
      for (var gx = -7; gx <= 6; gx++) {
        var p1 = iso(gx, -4, 0), p2 = iso(gx, 5, 0);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      for (var gy = -4; gy <= 5; gy++) {
        var p1 = iso(-7, gy, 0), p2 = iso(6, gy, 0);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      // Houses (depth-sorted)
      var sortedH = houses.slice().sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
      sortedH.forEach(drawHouse);
      // Trees (depth-sorted)
      var sortedT = trees.slice().sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
      sortedT.forEach(function (t) { drawTree(t[0], t[1]); });
      // Walking agents
      agents.forEach(function (a) {
        a.gx += a.vx; a.gy += a.vy;
        if (a.gx < -6 || a.gx > 5) a.vx = -a.vx;
        if (a.gy < -3 || a.gy > 4) a.vy = -a.vy;
        var p = iso(a.gx, a.gy, 0);
        ctx.fillStyle = a.c;
        ctx.beginPath(); ctx.arc(p.x, p.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener('resize', resize);
    setInterval(function () {
      var r = canvas.getBoundingClientRect();
      running = r.bottom > -80 && r.top < window.innerHeight + 80;
    }, 400);
  }

  // ── PLATFORM: control panel with animated chart, knobs, bars, dial ──
  function createPlatformRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, running = true, t = 0;
    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      if (W < 10 || H < 10) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    var chart = [];
    for (var i = 0; i < 32; i++) chart.push(0.4 + Math.random() * 0.2);
    var bars = [0.5, 0.7, 0.4, 0.8];
    var barT = [0.5, 0.7, 0.4, 0.8];
    var k1 = -Math.PI / 4, k1T = -Math.PI / 4;
    var k2 = Math.PI / 3, k2T = Math.PI / 3;
    var dA = Math.PI * 1.5, dAT = Math.PI * 1.5;

    var INK = '#3a3833', BG = '#eceae5';
    var SAGE = '#4a7196', AMBER = '#b69162', TERRA = '#b96a56', SLATE = '#2e4a66', MOSS = '#8a8f6a';

    function draw() {
      if (!running) { requestAnimationFrame(draw); return; }
      if (W < 60 || H < 60) { resize(); requestAnimationFrame(draw); return; }
      t++;
      if (t % 3 === 0) {
        chart.shift();
        chart.push(Math.max(0.1, Math.min(0.92, chart[chart.length - 1] + (Math.random() - 0.5) * 0.18)));
      }
      if (t % 80 === 0) { for (var i = 0; i < 4; i++) barT[i] = 0.2 + Math.random() * 0.7; }
      for (var i = 0; i < 4; i++) bars[i] += (barT[i] - bars[i]) * 0.03;
      if (t % 110 === 0) { k1T = -Math.PI / 2 + Math.random() * Math.PI; k2T = -Math.PI / 2 + Math.random() * Math.PI; }
      k1 += (k1T - k1) * 0.035; k2 += (k2T - k2) * 0.035;
      if (t % 130 === 0) dAT = Math.PI + Math.random() * Math.PI;
      dA += (dAT - dA) * 0.03;

      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      var pad = 6;
      // Outer console frame
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      // Quadrant dividers
      ctx.beginPath();
      ctx.moveTo(W / 2, pad); ctx.lineTo(W / 2, H - pad);
      ctx.moveTo(pad, H / 2); ctx.lineTo(W - pad, H / 2);
      ctx.stroke();

      // TOP-LEFT: scrolling line chart
      var cx0 = pad + 8, cy0 = pad + 8, cx1 = W / 2 - 6, cy1 = H / 2 - 8;
      var cw = cx1 - cx0, ch = cy1 - cy0;
      ctx.strokeStyle = 'rgba(50, 48, 44, 0.1)'; ctx.lineWidth = 0.5;
      for (var i = 1; i < 4; i++) {
        var y = cy0 + ch * i / 4;
        ctx.beginPath(); ctx.moveTo(cx0, y); ctx.lineTo(cx1, y); ctx.stroke();
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx0, cy1); ctx.lineTo(cx1, cy1); ctx.stroke();
      ctx.strokeStyle = SAGE; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (var i = 0; i < chart.length; i++) {
        var x = cx0 + (i / (chart.length - 1)) * cw;
        var y = cy1 - chart[i] * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      var lastY = cy1 - chart[chart.length - 1] * ch;
      ctx.fillStyle = AMBER;
      ctx.beginPath(); ctx.arc(cx1, lastY, 3, 0, Math.PI * 2); ctx.fill();

      // TOP-RIGHT: two knobs
      function drawKnob(kx, ky, kr, ang, color) {
        kr = Math.max(kr, 6);
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(kx, ky, kr - 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = BG; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(kx, ky);
        ctx.lineTo(kx + Math.cos(ang) * (kr - 4), ky + Math.sin(ang) * (kr - 4));
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(kx, ky, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
        for (var i = 0; i < 8; i++) {
          var a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(kx + Math.cos(a) * (kr + 2), ky + Math.sin(a) * (kr + 2));
          ctx.lineTo(kx + Math.cos(a) * (kr + 5), ky + Math.sin(a) * (kr + 5));
          ctx.stroke();
        }
      }
      var qcx = W * 0.75, qcy = H * 0.25;
      var kr = Math.min(W * 0.05, 13);
      drawKnob(qcx - kr * 1.5, qcy, kr, k1, TERRA);
      drawKnob(qcx + kr * 1.5, qcy, kr, k2, AMBER);

      // BOTTOM-LEFT: bar chart
      var bx0 = pad + 8, by0 = H / 2 + 8, bx1 = W / 2 - 6, by1 = H - pad - 8;
      var bw = bx1 - bx0, bh = by1 - by0;
      var bGap = 6;
      var barW = (bw - bGap * 3) / 4;
      var bC = [MOSS, AMBER, TERRA, SLATE];
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(bx0, by1); ctx.lineTo(bx1, by1); ctx.stroke();
      for (var i = 0; i < 4; i++) {
        var bbx = bx0 + i * (barW + bGap);
        var bbh = bars[i] * bh;
        ctx.fillStyle = bC[i];
        ctx.fillRect(bbx, by1 - bbh, barW, bbh);
        ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
        ctx.strokeRect(bbx, by1 - bbh, barW, bbh);
      }

      // BOTTOM-RIGHT: semicircular gauge with colored zones
      var gx = W * 0.75, gy = H * 0.72;
      var gr = Math.min(W * 0.08, 22);
      var zones = [
        { s: Math.PI, e: Math.PI * 1.33, c: SAGE },
        { s: Math.PI * 1.33, e: Math.PI * 1.67, c: AMBER },
        { s: Math.PI * 1.67, e: Math.PI * 2, c: TERRA }
      ];
      zones.forEach(function (z) {
        ctx.strokeStyle = z.c; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(gx, gy, gr - 3, z.s, z.e); ctx.stroke();
      });
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
      for (var i = 0; i <= 8; i++) {
        var a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(a) * (gr - 1), gy + Math.sin(a) * (gr - 1));
        ctx.lineTo(gx + Math.cos(a) * (gr - 8), gy + Math.sin(a) * (gr - 8));
        ctx.stroke();
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(dA) * (gr - 4), gy + Math.sin(dA) * (gr - 4));
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill();

      // Signal flow paths (faint beziers + traveling dots)
      function bezPt(t, p0, p1, p2, p3) {
        var mt = 1 - t;
        return {
          x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
          y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
        };
      }
      ctx.strokeStyle = 'rgba(207, 174, 130, 0.18)'; ctx.lineWidth = 1;
      // Chart → knobs
      var s1a = { x: cx1, y: lastY };
      var s1b = { x: qcx - kr * 1.5, y: qcy + kr };
      var s1c1 = { x: W / 2 + 4, y: cy1 - 4 };
      var s1c2 = { x: W / 2 + 8, y: qcy };
      ctx.beginPath();
      ctx.moveTo(s1a.x, s1a.y);
      ctx.bezierCurveTo(s1c1.x, s1c1.y, s1c2.x, s1c2.y, s1b.x, s1b.y);
      ctx.stroke();
      // Bars → dial
      var s2a = { x: bx1, y: by1 - bars[3] * bh };
      var s2b = { x: gx - gr, y: gy };
      var s2c1 = { x: W / 2, y: by0 };
      var s2c2 = { x: W / 2 + 4, y: gy - gr };
      ctx.beginPath();
      ctx.moveTo(s2a.x, s2a.y);
      ctx.bezierCurveTo(s2c1.x, s2c1.y, s2c2.x, s2c2.y, s2b.x, s2b.y);
      ctx.stroke();
      // Knob 2 → dial
      var s3a = { x: qcx + kr * 1.5, y: qcy + kr };
      var s3b = { x: gx, y: gy - gr };
      ctx.beginPath();
      ctx.moveTo(s3a.x, s3a.y);
      ctx.bezierCurveTo(qcx + kr * 1.5, H / 2, gx, H / 2, s3b.x, s3b.y);
      ctx.stroke();

      // Traveling dots
      var ft = (t % 90) / 90;
      var p1 = bezPt(ft, s1a, s1c1, s1c2, s1b);
      var p2 = bezPt(ft, s2a, s2c1, s2c2, s2b);
      var p3 = bezPt(ft, s3a, { x: qcx + kr * 1.5, y: H / 2 }, { x: gx, y: H / 2 }, s3b);
      ctx.fillStyle = AMBER;
      [p1, p2, p3].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
      });

      requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener('resize', resize);
    setInterval(function () {
      var r = canvas.getBoundingClientRect();
      running = r.bottom > -80 && r.top < window.innerHeight + 80;
    }, 400);
  }

  // ── VITRUVIAN: rendered Da Vinci figure with filled body, both arm/leg poses ──
  function createVitruvianRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, R = 0, running = true, t = 0;
    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      if (W < 10 || H < 10) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.42;
    }
    var INK = '#3a3833', BG = '#eceae5';
    var SAGE = '#4a7196', TERRA = '#b96a56', AMBER = '#b69162', MOSS = '#8a8f6a';

    function draw() {
      if (!running) { requestAnimationFrame(draw); return; }
      t++;
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

      var bodyH = R * 1.4, sqHalf = bodyH / 2;
      var feetY = cy + R * 0.58, headTopY = feetY - bodyH;
      var headR = R * 0.13, headCY = headTopY + headR;
      var shouldersY = headCY + headR * 1.4;
      var shoulderHalf = R * 0.22;
      var hipsY = cy + R * 0.12, hipsHalf = R * 0.12;
      var raisedAng = Math.PI * 0.22, spreadAng = Math.PI * 0.2;
      var shL = { x: cx - shoulderHalf, y: shouldersY };
      var shR = { x: cx + shoulderHalf, y: shouldersY };
      var hipL = { x: cx - hipsHalf * 0.55, y: hipsY };
      var hipR = { x: cx + hipsHalf * 0.55, y: hipsY };
      var armHorizL = { x: cx - sqHalf, y: shouldersY };
      var armHorizR = { x: cx + sqHalf, y: shouldersY };
      var armRaisedL = { x: cx - Math.sin(raisedAng) * R, y: cy - Math.cos(raisedAng) * R };
      var armRaisedR = { x: cx + Math.sin(raisedAng) * R, y: cy - Math.cos(raisedAng) * R };
      var footTogetherL = { x: cx - hipsHalf * 0.55, y: feetY };
      var footTogetherR = { x: cx + hipsHalf * 0.55, y: feetY };
      var footSpreadL = { x: cx - Math.sin(spreadAng) * R, y: cy + Math.cos(spreadAng) * R };
      var footSpreadR = { x: cx + Math.sin(spreadAng) * R, y: cy + Math.cos(spreadAng) * R };

      // Outer circle
      ctx.strokeStyle = 'rgba(50, 48, 44, 0.75)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // Inscribed square (offset so navel = circle center)
      ctx.strokeRect(cx - sqHalf, headTopY, sqHalf * 2, bodyH);
      // Proportion lines
      ctx.strokeStyle = 'rgba(74, 113, 150, 0.15)'; ctx.lineWidth = 0.5;
      [-0.42, -0.2, 0, 0.2, 0.42].forEach(function (off) {
        var y = cy + R * off;
        ctx.beginPath(); ctx.moveTo(cx - sqHalf + 4, y); ctx.lineTo(cx + sqHalf - 4, y); ctx.stroke();
      });

      // Arms — solid lines, raised first then horizontal (so horizontal overlays)
      ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(shL.x, shL.y); ctx.lineTo(armRaisedL.x, armRaisedL.y);
      ctx.moveTo(shR.x, shR.y); ctx.lineTo(armRaisedR.x, armRaisedR.y);
      ctx.moveTo(shL.x, shL.y); ctx.lineTo(armHorizL.x, armHorizL.y);
      ctx.moveTo(shR.x, shR.y); ctx.lineTo(armHorizR.x, armHorizR.y);
      ctx.stroke();

      // Legs — solid lines, spread first then together
      ctx.beginPath();
      ctx.moveTo(hipL.x, hipL.y); ctx.lineTo(footSpreadL.x, footSpreadL.y);
      ctx.moveTo(hipR.x, hipR.y); ctx.lineTo(footSpreadR.x, footSpreadR.y);
      ctx.moveTo(hipL.x, hipL.y); ctx.lineTo(footTogetherL.x, footTogetherL.y);
      ctx.moveTo(hipR.x, hipR.y); ctx.lineTo(footTogetherR.x, footTogetherR.y);
      ctx.stroke();

      // Torso (filled tapered shape from shoulders to hips)
      ctx.fillStyle = SAGE;
      ctx.beginPath();
      ctx.moveTo(shL.x, shL.y);
      ctx.bezierCurveTo(
        shL.x - 3, shL.y + R * 0.1,
        hipL.x - 4, hipsY - R * 0.04,
        hipL.x, hipsY
      );
      ctx.lineTo(hipR.x, hipR.y);
      ctx.bezierCurveTo(
        hipR.x + 4, hipsY - R * 0.04,
        shR.x + 3, shR.y + R * 0.1,
        shR.x, shR.y
      );
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();

      // Head (filled circle with hair line)
      ctx.fillStyle = SAGE;
      ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(50, 48, 44, 0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, headCY, headR - 3, Math.PI, Math.PI * 2); ctx.stroke();

      // Heart inside torso (pulsing)
      var pulse = 1 + Math.sin(t * 0.1) * 0.18;
      ctx.fillStyle = TERRA;
      ctx.beginPath();
      ctx.arc(cx, (shouldersY + hipsY) / 2 - R * 0.04, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Navel marker
      ctx.strokeStyle = TERRA; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = TERRA;
      ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();

      // Hands at all 4 arm tips
      ctx.fillStyle = MOSS; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      [armHorizL, armHorizR, armRaisedL, armRaisedR].forEach(function (h) {
        ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      // Feet at all 4 leg tips
      [footTogetherL, footTogetherR, footSpreadL, footSpreadR].forEach(function (f) {
        ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener('resize', resize);
    setInterval(function () {
      var r = canvas.getBoundingClientRect();
      running = r.bottom > -80 && r.top < window.innerHeight + 80;
    }, 400);
  }

  function navLogoScene(W, H) {
    var roles = [];
    var cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) * 0.44;
    addFlow(roles, pathCircle(cx, cy, R), 20, INK, 0.0018, 0.0032);
    fillCircleStatic(roles, cx - R * 0.39, cy - R * 0.24, R * 0.22, 1.4, SAGE);
    fillCircleStatic(roles, cx + R * 0.30, cy - R * 0.24, R * 0.18, 1.4, AMBER);
    fillCircleStatic(roles, cx, cy + R * 0.35, R * 0.20, 1.4, SLATE);
    addWalk(roles, cx, cy, R * 0.85, 5, SAGE_SOFT, 0.3);
    return roles;
  }

  // ═══════════════════════════════════════════════════════════
  // INSTANTIATE CANVASES
  // ═══════════════════════════════════════════════════════════
  var heroCanvas = document.getElementById('heroCanvas');
  var worldNameEl = document.getElementById('worldName');
  if (heroCanvas) {
    createDotCanvas(heroCanvas, [
      { name: 'City', fn: sceneCity },
      { name: 'Forest', fn: sceneForest },
      { name: 'Watershed', fn: sceneWatershed },
      { name: 'Market', fn: sceneMarket },
      { name: 'Body politic', fn: sceneBodyPolitic },
      { name: 'Lineage', fn: sceneInheritance }
    ], {
      N: 620, holdMs: 6000, dotAlpha: 0.7, dotSize: 1.6, trailAlpha: 0.06,
      onSceneChange: function (idx, scene) {
        if (!worldNameEl) return;
        worldNameEl.style.opacity = '0';
        setTimeout(function () {
          worldNameEl.textContent = scene.name;
          worldNameEl.style.opacity = '1';
        }, 250);
      }
    });
  }

  var modeScenes = { modeEngine: modeEngine, modeGarden: modeGarden, modePlatform: modePlatform };
  document.querySelectorAll('.mode-canvas').forEach(function (c) {
    var key = c.getAttribute('data-scene');
    if (key === 'modeGarden') createGardenRenderer(c);
    else if (key === 'modePlatform') createPlatformRenderer(c);
    else createDotCanvas(c, [{ name: key, fn: modeScenes[key] }], {
      N: 200, dotAlpha: 0.72, dotSize: 1.5, trailAlpha: 0.1, cycle: false
    });
  });

  var engineCanvas = document.getElementById('engineCanvas');
  if (engineCanvas) {
    createDotCanvas(engineCanvas, [{ name: 'body', fn: engineRingScene }], {
      N: 1600, dotAlpha: 0.85, dotSize: 1.5, trailAlpha: 0.1, cycle: false, padStatic: true
    });
  }

  var worldScenes = {
    worldForaging: worldForaging, worldCommons: worldCommons, worldConflict: worldConflict,
    worldTrading: worldTrading, worldInheritance: worldInheritance, worldYours: worldYours
  };
  document.querySelectorAll('.world-canvas').forEach(function (c) {
    var key = c.getAttribute('data-scene');
    createDotCanvas(c, [{ name: key, fn: worldScenes[key] }], {
      N: 120, dotAlpha: 0.78, dotSize: 1.4, trailAlpha: 0.12, cycle: false
    });
  });

  var navLogoCanvas = document.getElementById('navLogoCanvas');
  if (navLogoCanvas) {
    createDotCanvas(navLogoCanvas, [{ name: 'logo', fn: navLogoScene }], {
      N: 110, dotAlpha: 0.9, dotSize: 1.0, trailAlpha: 0.15, cycle: false
    });
  }

  var tickEl = document.getElementById('tickNum');
  var tickN = 42;
  setInterval(function () {
    tickN++;
    if (tickEl) tickEl.textContent = 't·' + String(tickN).padStart(4, '0');
  }, 714);
})();
