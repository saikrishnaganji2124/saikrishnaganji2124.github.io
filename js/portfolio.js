(() => {
  "use strict";

  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (menuButton && nav) {
    const closeMenu = () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation");
    };
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    document.addEventListener("click", (event) => {
      if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const themeToggle = document.querySelector(".theme-toggle");
  let lightTheme = document.documentElement.dataset.theme === "light";
  const isLightTheme = () => lightTheme;
  if (themeToggle) {
    const syncThemeToggle = () => {
      const light = isLightTheme();
      themeToggle.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
      themeToggle.setAttribute("aria-pressed", String(light));
    };
    syncThemeToggle();
    themeToggle.addEventListener("click", () => {
      const light = !lightTheme;
      lightTheme = light;
      if (light) document.documentElement.dataset.theme = "light";
      else document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("portfolio-theme", light ? "light" : "dark"); } catch (error) { /* Storage may be unavailable. */ }
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.content = light ? "#FFF9F4" : "#030712";
      syncThemeToggle();
      document.dispatchEvent(new Event("portfolio-themechange"));
    });
  }

  const cards = document.querySelectorAll(
    ".about-highlights > div, .experience-card, .featured-project, .pipeline > div, " +
    ".project-card, .stack-group, .ml-panel, .education-list > div, .contact-links a"
  );
  cards.forEach((card) => card.classList.add("cursor-card"));

  const canvas = document.getElementById("particle-field");
  const hero = document.querySelector(".hero");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  if (!canvas || !canvas.getContext) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const glowSprite = document.createElement("canvas");
  glowSprite.width = glowSprite.height = 64;
  const glowContext = glowSprite.getContext("2d");
  function paintGlowSprite() {
    const glow = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (isLightTheme()) {
      glow.addColorStop(0, "rgba(255, 144, 76, .9)");
      glow.addColorStop(.18, "rgba(236, 102, 27, .45)");
      glow.addColorStop(.55, "rgba(212, 91, 32, .12)");
      glow.addColorStop(1, "rgba(212, 91, 32, 0)");
    } else {
      glow.addColorStop(0, "rgba(180, 240, 255, .86)");
      glow.addColorStop(.18, "rgba(0, 168, 255, .42)");
      glow.addColorStop(.55, "rgba(0, 102, 255, .11)");
      glow.addColorStop(1, "rgba(0, 102, 255, 0)");
    }
    glowContext.clearRect(0, 0, 64, 64);
    glowContext.fillStyle = glow;
    glowContext.fillRect(0, 0, 64, 64);
  }
  paintGlowSprite();

  const darkColors = ["#00A8FF", "#0088FF", "#0066FF"];
  const lightColors = ["#D45B20", "#E97930", "#F28A32"];
  let colors = isLightTheme() ? lightColors : darkColors;
  const pointer = {
    x: -1000, y: -1000, previousX: 0, previousY: 0,
    lastEvent: 0, speed: 0, active: false, radius: 230
  };
  const ripple = { active: false, x: 0, y: 0, radius: 0, life: 0, strength: 0, lastTrigger: 0 };
  let particles = [];
  let buckets = [];
  let columns = 0;
  let rows = 0;
  let width = 0;
  let height = 0;
  let deviceScale = 1;
  let mobile = false;
  let tablet = false;
  let frame = 0;
  let lastFrame = 0;
  let visible = !document.hidden;
  let highlightFrame = 0;
  let highlightTarget = null;
  let highlightX = 0;
  let highlightY = 0;
  let haloCenterX = 0;
  let haloCenterY = 0;
  let haloVisibility = 0;
  let haloDiameter = 0;
  let haloCount = 0;
  let haloLayoutFrame = 0;
  let sphereRotation = .35;
  let sphereDrawOrder = [];
  let sphereEdges = [];
  const sphereLineBins = Array.from({ length: 12 }, () => []);
  const cellSize = 108;
  const closestIndices = new Int16Array(5);
  const closestDistances = new Float32Array(5);

  function positionHalo() {
    haloLayoutFrame = 0;
    if (!hero || !haloCount) return;
    const bounds = hero.getBoundingClientRect();
    const nextX = bounds.right - haloDiameter * (width >= 1280 ? .34 : .49);
    const nextY = bounds.top + bounds.height * (tablet ? .59 : .49);
    const shiftX = nextX - haloCenterX;
    const shiftY = nextY - haloCenterY;
    haloCenterX = nextX;
    haloCenterY = nextY;
    haloVisibility = Math.max(0, Math.min(1,
      (bounds.bottom - 80) / 210,
      (height - bounds.top) / 210
    ));
    for (let index = particles.length - haloCount; index < particles.length; index++) {
      particles[index].x += shiftX;
      particles[index].y += shiftY;
    }
    if (reducedMotion.matches) render(0, performance.now());
  }

  function seed() {
    width = window.innerWidth;
    height = window.innerHeight;
    mobile = width < 720 || coarsePointer.matches;
    tablet = !mobile && width < 1100;
    deviceScale = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    canvas.width = Math.floor(width * deviceScale);
    canvas.height = Math.floor(height * deviceScale);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

    const area = width * height;
    const count = reducedMotion.matches
      ? Math.min(42, Math.max(24, Math.round(area / 26000)))
      : mobile
        ? Math.min(58, Math.max(30, Math.round(area / 7200)))
        : tablet
          ? Math.min(170, Math.max(99, Math.round(area / 6100)))
          : Math.min(354, Math.max(210, Math.round(area / 4450)));

    pointer.radius = Math.min(320, Math.max(250, Math.round(width * .18)));
    haloDiameter = mobile ? 0 : tablet ? (width < 850 ? 178 : 280)
      : width < 1280 ? Math.round(width * .35) : Math.min(560, Math.max(450, width * .28));
    haloCount = mobile ? 0 : reducedMotion.matches ? (tablet ? 64 : 140)
      : tablet ? (width < 850 ? 90 : 150) : width < 1280 ? 260 : 420;
    canvas.dataset.particleCount = String(count);
    canvas.dataset.cursorRadius = String(pointer.radius);
    canvas.dataset.haloCount = String(haloCount);
    canvas.dataset.haloDiameter = String(Math.round(haloDiameter));
    columns = Math.ceil(width / cellSize);
    rows = Math.ceil(height / cellSize);
    buckets = Array.from({ length: columns * rows }, () => []);
    particles = Array.from({ length: count }, (_, index) => {
      const angle = Math.random() * Math.PI * 2;
      const ambientSpeed = mobile ? .16 + Math.random() * .23
        : tablet ? .24 + Math.random() * .29
        : .33 + Math.random() * .38;
      const driftX = Math.cos(angle) * ambientSpeed;
      const driftY = Math.sin(angle) * ambientSpeed;
      const bright = Math.random() < .16;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: driftX,
        vy: driftY,
        driftX,
        driftY,
        radius: bright ? 1.45 + Math.random() * .8 : .6 + Math.random() * .85,
        alpha: bright ? .58 + Math.random() * .25 : .28 + Math.random() * .3,
        bright,
        color: colors[index % colors.length],
        phase: Math.random() * Math.PI * 2
      };
    });
    // A softly varied shell gives the network a readable sphere; inner and fringe
    // nodes keep it volumetric and let its edge dissolve into the background.
    const shellCount = Math.floor(haloCount * .7);
    const fringeStart = Math.floor(haloCount * .94);
    for (let index = 0; index < haloCount; index++) {
      const core = index === haloCount - 1;
      const shell = index < shellCount;
      const fringe = index >= fringeStart && !core;
      const y = shell
        ? Math.max(-.995, Math.min(.995, 1 - 2 * (index + .5) / shellCount + (Math.random() - .5) * .09))
        : Math.random() * 1.98 - .99;
      const latitude = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = shell ? index * 2.399963 + (Math.random() - .5) * .32
        : Math.random() * Math.PI * 2;
      const radial = core ? .55 : shell ? .86 + Math.random() * .19
        : fringe ? 1.03 + Math.random() * .18 : .86 * Math.cbrt(Math.random());
      const rank = Math.random();
      const focal = core || rank < .025;
      const bright = focal || rank < .14;
      const medium = !bright && rank < .38;
      const dust = !bright && Math.random() < .08;
      const haloFade = radial > .96 ? Math.max(.3, 1 - (radial - .96) * 2.2) : 1;
      particles.push({
        x: 0, y: 0,
        baseX: core ? -.11 : Math.cos(angle) * latitude * radial,
        baseY: core ? .07 : y * radial,
        baseZ: core ? .53 : Math.sin(angle) * latitude * radial,
        sceneX: 0, sceneY: 0, sceneZ: 0,
        vx: 0, vy: 0, anchorX: 0, anchorY: 0,
        current3DX: 0, current3DY: 0, positionInitialized: false,
        depth: .5, perspective: 1,
        radius: core ? 2.9 : focal ? 2.2 + Math.random() * .8
          : bright ? 1.5 + Math.random() * .8
            : medium ? .9 + Math.random() * .55 : .48 + Math.random() * .44,
        alpha: core ? 1 : focal ? .94 : bright ? .84 + Math.random() * .16
          : medium ? .66 + Math.random() * .22 : .43 + Math.random() * .27,
        bright, halo: true, haloCore: core, haloFocal: focal, haloDust: dust,
        haloFade, linkBudget: dust ? 0 : fringe ? 1 + Math.floor(Math.random() * 2)
          : 3 + Math.floor(Math.random() * (bright ? 3 : 2)),
        color: colors[index % colors.length],
        phase: Math.random() * Math.PI * 2
      });
    }
    sphereDrawOrder = particles.slice(count);
    buildSphereConnections();
    canvas.dataset.particleShape = "sphere-3d";
    haloCenterX = 0;
    haloCenterY = 0;
    positionHalo();
    render(0, performance.now());
  }

  function update(step, time) {
    pointer.speed *= Math.pow(.82, step);
    if (ripple.active) {
      ripple.radius += 7.8 * step;
      ripple.life -= step;
      if (ripple.life <= 0 || ripple.radius > pointer.radius + 65) ripple.active = false;
    }
    const interaction = pointer.active && !mobile && !reducedMotion.matches;
    const radiusSquared = pointer.radius * pointer.radius;

    for (let index = 0; index < particles.length; index++) {
      const particle = particles[index];
      if (particle.halo) continue;
      particle.vx += (particle.driftX - particle.vx) * .026 * step;
      particle.vy += (particle.driftY - particle.vy) * .026 * step;
      particle.vx += Math.sin(time * .00037 + particle.phase) * .0013 * step;
      particle.vy += Math.cos(time * .00031 + particle.phase) * .0013 * step;

      if (interaction) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared) {
          const distance = Math.sqrt(distanceSquared);
          const distanceSafe = Math.max(distance, 1);
          const falloff = 1 - distance / pointer.radius;
          const force = (.64 + Math.min(pointer.speed, 36) * .022) * 1.34 * falloff * falloff * step;
          const nx = distance < 1 ? Math.cos(particle.phase) : dx / distanceSafe;
          const ny = distance < 1 ? Math.sin(particle.phase) : dy / distanceSafe;
          particle.vx += nx * force;
          particle.vy += ny * force;
        }
      }

      if (ripple.active) {
        const dx = particle.x - ripple.x;
        const dy = particle.y - ripple.y;
        const distance = Math.hypot(dx, dy);
        const ringDistance = Math.abs(distance - ripple.radius);
        if (ringDistance < 40 && distance > 1) {
          const waveForce = (1 - ringDistance / 40) * .31 * ripple.strength * step;
          particle.vx += dx / distance * waveForce;
          particle.vy += dy / distance * waveForce;
        }
      }

      const speed = Math.hypot(particle.vx, particle.vy);
      const limit = mobile ? 1.1 : 3.8;
      if (speed > limit) {
        particle.vx = particle.vx / speed * limit;
        particle.vy = particle.vy / speed * limit;
      }
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      if (!particle.halo) {
        if (particle.x < -14) particle.x = width + 14;
        else if (particle.x > width + 14) particle.x = -14;
        if (particle.y < -14) particle.y = height + 14;
        else if (particle.y > height + 14) particle.y = -14;
      }
    }
  }

  function buildSphereConnections() {
    sphereEdges = [];
    const threshold = tablet ? .7 : .53;
    // Nearest neighbours are selected in 3D once, not on every animation frame.
    for (let index = 0; index < sphereDrawOrder.length; index++) {
      const a = sphereDrawOrder[index];
      if (a.haloDust) continue;
      const limit = tablet ? Math.min(2, a.linkBudget) : a.linkBudget;
      let selected = 0;
      for (let otherIndex = index + 1; otherIndex < sphereDrawOrder.length; otherIndex++) {
        const b = sphereDrawOrder[otherIndex];
        if (b.haloDust) continue;
        if (Math.random() < .08) continue;
        const distance = Math.hypot(a.baseX - b.baseX, a.baseY - b.baseY, a.baseZ - b.baseZ);
        if (distance >= threshold) continue;
        let slot = 0;
        while (slot < selected && closestDistances[slot] < distance) slot++;
        if (slot >= limit) continue;
        for (let move = Math.min(selected, limit - 1); move > slot; move--) {
          closestIndices[move] = closestIndices[move - 1];
          closestDistances[move] = closestDistances[move - 1];
        }
        closestIndices[slot] = otherIndex;
        closestDistances[slot] = distance;
        if (selected < limit) selected++;
      }
      for (let item = 0; item < selected; item++) {
        sphereEdges.push({
          a, b: sphereDrawOrder[closestIndices[item]], threshold,
          weight: .48 + Math.random() * .4 + (a.bright ? .12 : 0)
        });
      }
    }
  }

  function projectSphere(step) {
    if (!haloCount) return;
    sphereRotation += step * .003;
    if (haloVisibility <= .01) return;
    const cosY = Math.cos(sphereRotation), sinY = Math.sin(sphereRotation);
    const cosX = Math.cos(.22), sinX = Math.sin(.22);
    const radius = haloDiameter / 2;
    const camera = 3.8;
    const silhouetteScale = Math.sqrt(1 - 1 / (camera * camera));
    const forceRadius = tablet ? Math.min(280, radius * 1.55)
      : Math.min(340, Math.max(280, width * .222));
    const interaction = step && pointer.active && !mobile && !reducedMotion.matches;
    const damping = Math.pow(.93, step);
    const springStrength = .0045;
    for (let index = particles.length - haloCount; index < particles.length; index++) {
      const p = particles[index];
      const rotatedX = p.baseX * cosY + p.baseZ * sinY;
      const rotatedZ = p.baseZ * cosY - p.baseX * sinY;
      p.sceneX = rotatedX;
      p.sceneY = p.baseY * cosX - rotatedZ * sinX;
      p.sceneZ = p.baseY * sinX + rotatedZ * cosX;
      p.depth = (p.sceneZ + 1) / 2;
      p.perspective = camera / (camera - p.sceneZ);
      const projectionScale = radius * p.perspective * silhouetteScale;
      const idleX = reducedMotion.matches ? 0 : Math.sin(sphereRotation * 4 + p.phase) * 1.6;
      const idleY = reducedMotion.matches ? 0 : Math.cos(sphereRotation * 3.3 + p.phase) * 1.6;
      p.anchorX = haloCenterX + p.sceneX * projectionScale + idleX;
      p.anchorY = haloCenterY + p.sceneY * projectionScale + idleY;

      // Only initialize once. From here, actual positions are integrated from velocity.
      if (!p.positionInitialized) {
        p.x = p.anchorX;
        p.y = p.anchorY;
        p.positionInitialized = true;
      }
      if (step) {
        if (interaction) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < forceRadius) {
            const falloff = 1 - distance / forceRadius;
            const force = (1.8 + Math.min(pointer.speed, 36) * .075) * falloff * falloff * step;
            p.vx += (distance > .1 ? dx / distance : Math.cos(p.phase)) * force;
            p.vy += (distance > .1 ? dy / distance : Math.sin(p.phase)) * force;
          }
        }
        if (ripple.active && !reducedMotion.matches) {
          const dx = p.x - ripple.x;
          const dy = p.y - ripple.y;
          const distance = Math.hypot(dx, dy);
          // Reuse the shared wave; it reaches beyond the direct sphere force.
          const ring = Math.abs(distance - ripple.radius * 1.32);
          if (ring < 50 && distance > 1) {
            const force = (1 - ring / 50) * .38 * ripple.strength * step;
            p.vx += dx / distance * force;
            p.vy += dy / distance * force;
          }
        }
        p.vx += (p.anchorX - p.x) * springStrength * step;
        p.vy += (p.anchorY - p.y) * springStrength * step;
        p.vx *= damping;
        p.vy *= damping;
        const speed = Math.hypot(p.vx, p.vy);
        const speedLimit = tablet ? 6 : 8;
        if (speed > speedLimit) {
          p.vx *= speedLimit / speed;
          p.vy *= speedLimit / speed;
        }
        p.x += p.vx * step;
        p.y += p.vy * step;
      }
      // Inverse projection makes connection stretch use the displaced positions.
      p.current3DX = (p.x - haloCenterX) / projectionScale;
      p.current3DY = (p.y - haloCenterY) / projectionScale;
    }
    sphereDrawOrder.sort((a, b) => a.sceneZ - b.sceneZ);
  }

  function drawSphere() {
    if (!haloCount || haloVisibility <= .01) return;
    const radius = haloDiameter / 2;
    const visibility = haloVisibility * (tablet ? .68 : 1);
    context.globalAlpha = .38 * visibility;
    context.drawImage(glowSprite, haloCenterX - radius * .86, haloCenterY - radius * .78, radius * 1.55, radius * 1.55);
    context.globalAlpha = .29 * visibility;
    context.drawImage(glowSprite, haloCenterX - radius * .24, haloCenterY - radius * .53, radius * .95, radius * .95);
    context.globalAlpha = .2 * visibility;
    context.drawImage(glowSprite, haloCenterX - radius * .76, haloCenterY - radius * .05, radius * .9, radius * .9);
    for (let index = 0; index < sphereLineBins.length; index++) sphereLineBins[index].length = 0;
    for (let index = 0; index < sphereEdges.length; index++) {
      const { a, b, threshold, weight } = sphereEdges[index];
      const distance = Math.hypot(
        a.current3DX - b.current3DX,
        a.current3DY - b.current3DY,
        a.sceneZ - b.sceneZ
      );
      const proximity = Math.max(0, 1 - distance / (threshold * 1.12));
      const depth = (a.depth + b.depth) / 2;
      const alpha = proximity * (.17 + depth * .68) * weight * a.haloFade * b.haloFade;
      if (alpha < .008) continue;
      sphereLineBins[Math.min(11, Math.floor(alpha * 30))].push(sphereEdges[index]);
    }
    // Batch similar line opacities into 12 draw calls, with no per-frame objects.
    for (let index = 0; index < sphereLineBins.length; index++) {
      const edges = sphereLineBins[index];
      if (!edges.length) continue;
      context.strokeStyle = isLightTheme()
        ? (index >= 8 ? "#D45B20" : "#E99560")
        : (index >= 8 ? "#00A8FF" : "#0088FF");
      context.globalAlpha = (index + .5) / 30 * visibility;
      context.lineWidth = .6 + index / 11 * .15;
      context.beginPath();
      for (let item = 0; item < edges.length; item++) {
        const { a, b } = edges[item];
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      }
      context.stroke();
    }
  }

  function drawConnections() {
    if (mobile || reducedMotion.matches) return;
    for (let index = 0; index < buckets.length; index++) buckets[index].length = 0;
    const backgroundCount = particles.length - haloCount;
    for (let index = 0; index < backgroundCount; index++) {
      const particle = particles[index];
      const column = Math.min(columns - 1, Math.max(0, Math.floor(particle.x / cellSize)));
      const row = Math.min(rows - 1, Math.max(0, Math.floor(particle.y / cellSize)));
      buckets[row * columns + column].push(index);
    }
    const threshold = tablet ? 94 : 108;
    const thresholdSquared = threshold * threshold;
    const maxConnections = tablet ? 2 : 3;
    context.strokeStyle = isLightTheme() ? "#D9864A" : "#0088FF";
    context.lineWidth = .7;
    for (let index = 0; index < backgroundCount; index++) {
      const particle = particles[index];
      const column = Math.min(columns - 1, Math.max(0, Math.floor(particle.x / cellSize)));
      const row = Math.min(rows - 1, Math.max(0, Math.floor(particle.y / cellSize)));
      let connections = 0;
      for (let offsetY = -1; offsetY <= 1 && connections < maxConnections; offsetY++) {
        const neighborRow = row + offsetY;
        if (neighborRow < 0 || neighborRow >= rows) continue;
        for (let offsetX = -1; offsetX <= 1 && connections < maxConnections; offsetX++) {
          const neighborColumn = column + offsetX;
          if (neighborColumn < 0 || neighborColumn >= columns) continue;
          const bucket = buckets[neighborRow * columns + neighborColumn];
          for (let item = 0; item < bucket.length && connections < maxConnections; item++) {
            const otherIndex = bucket[item];
            if (otherIndex <= index) continue;
            const other = particles[otherIndex];
            const dx = particle.x - other.x, dy = particle.y - other.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared >= thresholdSquared) continue;
            context.globalAlpha = (1 - distanceSquared / thresholdSquared) * .184;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);
            context.stroke();
            connections++;
          }
        }
      }
    }
  }

  function render(step, time) {
    if (step) update(step, time);
    projectSphere(step);
    context.clearRect(0, 0, width, height);
    drawConnections();
    drawSphere();

    const rippleInsideSphere = haloVisibility > .01
      && Math.hypot(ripple.x - haloCenterX, ripple.y - haloCenterY) < haloDiameter / 2;
    if (ripple.active && !reducedMotion.matches && !rippleInsideSphere) {
      context.beginPath();
      context.strokeStyle = isLightTheme() ? "#D45B20" : "#00A8FF";
      context.globalAlpha = Math.min(.05, ripple.life / 38 * .05);
      context.lineWidth = 1;
      context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      context.stroke();
    }

    const backgroundCount = particles.length - haloCount;
    for (let index = 0; index < particles.length; index++) {
      const particle = index < backgroundCount ? particles[index] : sphereDrawOrder[index - backgroundCount];
      if (particle.halo && haloVisibility <= .01) continue;
      const shimmer = .9 + .1 * Math.sin(time * .0012 + particle.phase);
      const visibility = particle.halo ? haloVisibility * particle.haloFade * (tablet ? .74 : 1) : 1;
      const depthAlpha = particle.halo ? .26 + .74 * particle.depth : 1;
      const size = particle.halo
        ? particle.radius * (.65 + .65 * particle.depth) * particle.perspective : particle.radius;
      const particleAlpha = particle.halo ? particle.alpha : Math.min(1, particle.alpha * 1.29);
      context.fillStyle = particle.haloCore
        ? (isLightTheme() ? "#C44B13" : "#BEEFFF") : particle.color;
      if (particle.bright) {
        if (particle.halo) {
          if (particle.haloCore) {
            context.globalAlpha = .22 * depthAlpha * shimmer * visibility;
            context.drawImage(glowSprite, particle.x - 68, particle.y - 68, 136, 136);
          }
          const glowSize = particle.haloCore ? 76 : particle.haloFocal ? 24 + size * 8 : 16 + size * 5;
          context.globalAlpha = (particle.haloCore ? .95 : particle.haloFocal ? .84 : .47)
            * depthAlpha * shimmer * visibility;
          context.drawImage(glowSprite, particle.x - glowSize / 2, particle.y - glowSize / 2, glowSize, glowSize);
        } else {
          context.globalAlpha = particleAlpha * .126 * shimmer;
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius * 3.3, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = particleAlpha * shimmer * visibility * depthAlpha;
      context.beginPath();
      context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function tick(time) {
    frame = 0;
    if (!visible || reducedMotion.matches) return;
    const step = Math.min((time - (lastFrame || time)) / 16.67, 2);
    lastFrame = time;
    render(step, time);
    frame = requestAnimationFrame(tick);
  }

  function syncMotion() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (!visible) return;
    if (reducedMotion.matches) render(0, performance.now());
    else frame = requestAnimationFrame(tick);
  }

  function updateCardHighlight() {
    highlightFrame = 0;
    let element = highlightTarget;
    while (element && element !== document.body) {
      if (element.classList.contains("cursor-card")) {
        const rect = element.getBoundingClientRect();
        element.style.setProperty("--mouse-x", (highlightX - rect.left) + "px");
        element.style.setProperty("--mouse-y", (highlightY - rect.top) + "px");
      }
      element = element.parentElement;
    }
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { seed(); syncMotion(); }, 150);
  }, { passive: true });
  window.addEventListener("scroll", () => {
    if (haloCount && !haloLayoutFrame) haloLayoutFrame = requestAnimationFrame(positionHalo);
  }, { passive: true });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || mobile) return;
    const now = performance.now();
    const elapsed = pointer.lastEvent ? Math.max(8, now - pointer.lastEvent) : 16.67;
    const motion = pointer.lastEvent
      ? Math.hypot(event.clientX - pointer.previousX, event.clientY - pointer.previousY) / elapsed * 16.67
      : 0;
    pointer.speed = pointer.speed * .65 + Math.min(motion, 45) * .35;
    pointer.previousX = event.clientX;
    pointer.previousY = event.clientY;
    pointer.lastEvent = now;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;

    if (!reducedMotion.matches && motion > 9 && now - ripple.lastTrigger > 170) {
      ripple.active = true;
      ripple.x = pointer.x;
      ripple.y = pointer.y;
      ripple.radius = 10;
      ripple.life = 38;
      ripple.strength = Math.min(1.5, .7 + motion / 30);
      ripple.lastTrigger = now;
    }

    if (!reducedMotion.matches && event.target instanceof Element) {
      highlightTarget = event.target;
      highlightX = event.clientX;
      highlightY = event.clientY;
      if (!highlightFrame) highlightFrame = requestAnimationFrame(updateCardHighlight);
    }
  }, { passive: true });

  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) pointer.active = false;
  }, { passive: true });
  window.addEventListener("blur", () => { pointer.active = false; });
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (!visible) pointer.active = false;
    syncMotion();
  });
  window.addEventListener("pagehide", () => {
    if (frame) cancelAnimationFrame(frame);
    if (highlightFrame) cancelAnimationFrame(highlightFrame);
    if (haloLayoutFrame) cancelAnimationFrame(haloLayoutFrame);
    clearTimeout(resizeTimer);
  });
  reducedMotion.addEventListener("change", () => { seed(); syncMotion(); });
  coarsePointer.addEventListener("change", () => { seed(); syncMotion(); });
  document.addEventListener("portfolio-themechange", () => {
    colors = isLightTheme() ? lightColors : darkColors;
    for (let index = 0; index < particles.length; index++) {
      particles[index].color = colors[index % colors.length];
    }
    paintGlowSprite();
    if (reducedMotion.matches) render(0, performance.now());
  });
  seed();
  syncMotion();
})();
