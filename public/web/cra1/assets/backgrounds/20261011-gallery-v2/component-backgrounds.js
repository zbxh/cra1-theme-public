/* Preview gallery: one retained surface, nine discrete motion systems and
   an original dwell / chase / comet / burst experiment. No dependencies. */
(() => {
  'use strict';
  const catalog = [
    ['metal', '金属绸缎'], ['net', '粒子连线'], ['pixels', '像素扩散'],
    ['galaxy', '空间星海'], ['flock', '群体飞行'], ['balls', '物理球群'],
    ['tiles', '几何拼贴'], ['letters', '数字字符'], ['tunnel', '光速隧道'],
    ['circuit', '电路数据流'], ['comet', '聚光彗星']
  ];
  const styles = catalog.map(item => item[0]), labels = catalog.map(item => item[1]);
  const layer = document.querySelector('#cp-background-layer');
  const controls = document.querySelector('#cp-background-controls');
  const select = document.querySelector('#cp-background-select');
  const paletteButton = document.querySelector('#cp-background-palette');
  const pauseButton = document.querySelector('#cp-background-pause');
  const entry = document.querySelector('#cp-background-open');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const tau = Math.PI * 2;
  const instrument = new URLSearchParams(location.search).has('measure');
  const force2d = new URLSearchParams(location.search).get('bg-renderer') === '2d';
  const cache = new Map();
  let canvas = document.querySelector('#cp-background-canvas');
  let renderer, active = false, paused = false, contextLost = false, focused = true;
  let mode = 0, light = false, raf = 0, lastPaint = 0, time = 2.4;
  let previousHash = '#cp-top', previousScroll = 0, pixelBudget = 800000, slowFrames = 0;
  let viewportWidth = innerWidth, viewportHeight = innerHeight, lastInput = null;
  let pointerInside = false, lastMotion = -100, pulseTime = -100;
  const current = { x: .5, y: .5, energy: 0, speed: 0 }, target = { ...current };
  const metrics = { frames: 0, totalJsMs: 0, maxJsMs: 0 };
  const staticMode = () => reduced.matches || !fine.matches;
  const palette = () => light
    ? { bg: '#f5f6f7', edge: '#e8ecef', warm: '#ece4d9', ink: '#525e6b', silver: '#6e7f8f', gold: '#a07c43', dim: '#bcc5ce', line: '#a6b2be' }
    : { bg: '#121519', edge: '#222a32', warm: '#27221c', ink: '#e3e9ef', silver: '#afbecd', gold: '#d7b57b', dim: '#53616f', line: '#758697' };
  function random(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  function freshCanvas() { const el = document.createElement('canvas'); el.id = 'cp-background-canvas'; return el; }
  function pointer() {
    return { x: current.x * viewportWidth, y: (1 - current.y) * viewportHeight,
      nx: current.x - .5, ny: .5 - current.y, energy: current.energy, speed: current.speed,
      inside: pointerInside, still: time - lastMotion, static: staticMode() };
  }
  function stroke(ctx, points, color, alpha = 1, width = 1) {
    if (!points.length) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
  function circle(ctx, x, y, radius, color, alpha = 1) {
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, tau); ctx.fill();
  }
  const spriteCache = new Map();
  function glow(ctx, x, y, radius, color, alpha = 1) {
    let sprite = spriteCache.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas'); sprite.width = sprite.height = 96;
      const c = sprite.getContext('2d'), g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, color); g.addColorStop(.14, color + 'be');
      g.addColorStop(.42, color + '38'); g.addColorStop(1, color + '00');
      c.fillStyle = g; c.fillRect(0, 0, 96, 96); spriteCache.set(color, sprite);
    }
    ctx.globalAlpha = alpha; ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  }
  function field(id, w, h) {
    const rng = random(711 + styles.indexOf(id) * 137);
    const p = palette();
    const pulses = [];
    const wave = (x, y, power = 1) => { pulses.push({ x, y, age: 0, power }); if (pulses.length > 5) pulses.shift(); };
    function waves(dt) { for (const pulse of pulses) pulse.age += dt; while (pulses[0]?.age > 3.6) pulses.shift(); }

    if (id === 'net') {
      const nodes = Array.from({ length: 86 }, (_, i) => ({ x: rng() * w, y: rng() * h,
        vx: (rng() - .5) * 25, vy: (rng() - .5) * 25, depth: .4 + rng(), r: 1.5 + rng() * 1.5, gold: i % 7 === 0 }));
      return {
        info: () => ({ nodes: nodes.length }),
        draw(ctx, dt, t, mouse) {
          const reach = clamp(Math.sqrt(w * h) / 6, 130, 215), projected = [];
          for (const n of nodes) {
            n.x += (n.vx + mouse.nx * 27) * dt; n.y += (n.vy + mouse.ny * 27) * dt;
            if (n.x < -90) n.x = w + 90; if (n.x > w + 90) n.x = -90;
            if (n.y < -90) n.y = h + 90; if (n.y > h + 90) n.y = -90;
            let x = n.x + mouse.nx * 110 * n.depth, y = n.y + mouse.ny * 90 * n.depth;
            const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
            if (mouse.inside && d > 1 && d < 150) { const push = (1 - d / 150) * 26; x += dx / d * push; y += dy / d * push; }
            projected.push([x, y]);
          }
          for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
            const d = Math.hypot(projected[i][0] - projected[j][0], projected[i][1] - projected[j][1]);
            if (d < reach) stroke(ctx, [projected[i], projected[j]], nodes[i].gold ? p.gold : p.silver, (1 - d / reach) * .38, .9);
          }
          projected.forEach(([x, y], i) => {
            const n = nodes[i], col = n.gold ? p.gold : p.silver;
            glow(ctx, x, y, n.r * 5, col, .32); circle(ctx, x, y, n.r, col, .8);
          });
        }
      };
    }
    if (id === 'pixels') {
      const spacing = Math.max(25, Math.sqrt(w * h / 1550));
      const cols = Math.ceil(w / spacing), rows = Math.ceil(h / spacing);
      wave(w * .3, h * .45, .6);
      return {
        click: wave, pulse: wave, info: () => ({ cells: cols * rows, waves: pulses.length }),
        draw(ctx, dt, t, mouse) {
          waves(dt);
          for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const x = col * spacing + spacing / 2, y = row * spacing + spacing / 2;
            let value = .27 + .13 * Math.sin(col * .31 + row * .24 + t * .8 + mouse.nx * 3);
            value += .10 * Math.cos(row * .37 - col * .18 - t * .6 + mouse.ny * 3);
            for (const pulse of pulses) {
              const d = Math.hypot(x - pulse.x, y - pulse.y), rim = Math.abs(d - pulse.age * 360);
              value += Math.exp(-rim * rim / 5500) * Math.max(0, 1 - pulse.age / 3.6) * pulse.power;
            }
            const dist = Math.hypot(x - mouse.x, y - mouse.y);
            if (mouse.inside) value += Math.exp(-dist * dist / 15000) * .3;
            value = clamp(value, .08, 1); const size = 2.5 + value * spacing * .38;
            const displacement = mouse.energy * Math.sin(t * 2 + row * .3) * 4;
            ctx.globalAlpha = .24 + value * .76; ctx.fillStyle = value > .65 || (col + row * 3) % 19 === 0 ? p.gold : p.silver;
            ctx.fillRect(x - size / 2 + mouse.nx * 14, y - size / 2 + displacement + mouse.ny * 14, size, size);
          }
        }
      };
    }
    if (id === 'galaxy') {
      const stars = Array.from({ length: 220 }, (_, i) => ({ x: (rng() - .5) * 2, y: (rng() - .5) * 2,
        z: .2 + rng() * 1.6, phase: rng() * tau, gold: i % 9 === 0 }));
      return {
        info: () => ({ stars: stars.length }),
        draw(ctx, dt, t, mouse) {
          const angle = t * .006 + mouse.nx * .05, ca = Math.cos(angle), sa = Math.sin(angle);
          for (const star of stars) {
            star.z -= dt * .028; if (star.z < .12) star.z = 1.8;
            const a = star.x * ca - star.y * sa, b = star.x * sa + star.y * ca;
            const x = w / 2 + a * w * .55 / star.z + mouse.nx * 150 / star.z;
            const y = h / 2 + b * h * .55 / star.z + mouse.ny * 110 / star.z;
            if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
            const size = clamp(1.15 / star.z, .7, 4), col = star.gold ? p.gold : p.ink;
            const alpha = .48 + .36 * Math.sin(star.phase + t * .7);
            if (size > 1.7) glow(ctx, x, y, size * 6, col, alpha * .6);
            circle(ctx, x, y, size, col, alpha);
            if (size > 2.4) { stroke(ctx, [[x - size * 3, y], [x + size * 3, y]], col, alpha * .45, .8); stroke(ctx, [[x, y - size * 3], [x, y + size * 3]], col, alpha * .45, .8); }
          }
        }
      };
    }
    if (id === 'flock') {
      const birds = Array.from({ length: 60 }, (_, i) => ({ x: rng() * w, y: rng() * h,
        vx: (rng() - .5) * 130, vy: (rng() - .5) * 130, size: 8 + rng() * 14, phase: rng() * tau, gold: i % 6 === 0 }));
      return {
        info: () => ({ birds: birds.length }),
        draw(ctx, dt, t, mouse) {
          const next = [];
          for (const b of birds) {
            let ax = 0, ay = 0, cx = 0, cy = 0, vx = 0, vy = 0, count = 0;
            for (const other of birds) {
              if (other === b) continue;
              const dx = other.x - b.x, dy = other.y - b.y, d2 = dx * dx + dy * dy;
              if (d2 < 24000) { cx += dx; cy += dy; vx += other.vx; vy += other.vy; count++; }
              if (d2 > .1 && d2 < 1600) { ax -= dx / d2 * 2300; ay -= dy / d2 * 2300; }
            }
            if (count) { ax += cx / count * .3 + (vx / count - b.vx) * .55; ay += cy / count * .3 + (vy / count - b.vy) * .55; }
            ax += mouse.nx * 65 + Math.cos(t * .2 + b.phase) * 8;
            ay += mouse.ny * 65 + Math.sin(t * .2 + b.phase) * 8;
            const dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy);
            if (mouse.inside && d > 1 && d < 240) { const force = (1 - d / 240) * 330; ax += dx / d * force; ay += dy / d * force; }
            let nx = b.vx + ax * dt, ny = b.vy + ay * dt, speed = Math.hypot(nx, ny) || 1;
            const limited = clamp(speed, 45, 150); nx *= limited / speed; ny *= limited / speed;
            next.push([nx, ny]);
          }
          birds.forEach((b, i) => {
            [b.vx, b.vy] = next[i]; b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < -40) b.x = w + 40; if (b.x > w + 40) b.x = -40;
            if (b.y < -40) b.y = h + 40; if (b.y > h + 40) b.y = -40;
            ctx.save(); ctx.translate(b.x + mouse.nx * b.size * 3, b.y + mouse.ny * b.size * 3); ctx.rotate(Math.atan2(b.vy, b.vx));
            const wing = .5 + .5 * Math.sin(t * 5 + b.phase), s = b.size;
            ctx.globalAlpha = .8; ctx.fillStyle = b.gold ? p.gold : p.silver;
            ctx.beginPath(); ctx.moveTo(s * 1.4, 0); ctx.lineTo(-s, -s * (.55 + wing * .6)); ctx.lineTo(-s * .25, 0); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = .42; ctx.beginPath(); ctx.moveTo(s * 1.4, 0); ctx.lineTo(-s, s * (.55 + wing * .6)); ctx.lineTo(-s * .25, 0); ctx.closePath(); ctx.fill(); ctx.restore();
          });
        }
      };
    }
    if (id === 'balls') {
      const sprites = [false, true].map(gold => {
        const s = document.createElement('canvas'); s.width = s.height = 128; const c = s.getContext('2d');
        const g = c.createRadialGradient(40, 32, 3, 65, 65, 58);
        g.addColorStop(0, light ? '#ffffff' : '#f0f3f5'); g.addColorStop(.28, gold ? '#dcc59e' : '#c6d0d8');
        g.addColorStop(.68, gold ? '#977c55' : '#71818f'); g.addColorStop(.9, gold ? '#443627' : '#303d48'); g.addColorStop(1, light ? '#a0aab3' : '#151c22');
        c.fillStyle = g; c.beginPath(); c.arc(64, 64, 58, 0, tau); c.fill();
        c.strokeStyle = '#ffffff55'; c.lineWidth = 1; c.stroke(); return s;
      });
      const balls = Array.from({ length: 34 }, (_, i) => ({ x: 55 + rng() * Math.max(1, w - 110), y: 55 + rng() * Math.max(1, h - 110),
        vx: (rng() - .5) * 80, vy: (rng() - .5) * 80, r: 16 + rng() * 32, gold: i % 5 === 0 }));
      return {
        info: () => ({ balls: balls.length }),
        draw(ctx, dt, t, mouse) {
          if (dt) {
            for (const b of balls) {
              b.vx += (mouse.nx * 40 + Math.sin(t * .4 + b.r) * 8) * dt;
              b.vy += (mouse.ny * 40 + Math.cos(t * .4 + b.r) * 8) * dt;
              const dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy);
              if (mouse.inside && d > 1 && d < b.r + 95) { const force = (1 - d / (b.r + 95)) * (250 + mouse.speed * .12); b.vx += dx / d * force * dt; b.vy += dy / d * force * dt; }
              const drag = Math.exp(-dt * .12); b.vx *= drag; b.vy *= drag;
              const speed = Math.hypot(b.vx, b.vy); if (speed > 250) { b.vx *= 250 / speed; b.vy *= 250 / speed; }
              b.x += b.vx * dt; b.y += b.vy * dt;
              if (b.x < b.r || b.x > w - b.r) { b.x = clamp(b.x, b.r, w - b.r); b.vx *= -.85; }
              if (b.y < b.r || b.y > h - b.r) { b.y = clamp(b.y, b.r, h - b.r); b.vy *= -.85; }
            }
            for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
              if (d < min && d > .001) {
                const nx = dx / d, ny = dy / d, overlap = (min - d) / 2;
                a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
                const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (relative < 0) { a.vx += relative * nx * .88; a.vy += relative * ny * .88; b.vx -= relative * nx * .88; b.vy -= relative * ny * .88; }
              }
            }
          }
          for (const b of balls) {
            ctx.globalAlpha = .12; ctx.fillStyle = light ? '#43515c' : '#000000'; ctx.beginPath(); ctx.ellipse(b.x + b.r * .2, b.y + b.r * .7, b.r * .95, b.r * .48, 0, 0, tau); ctx.fill();
            ctx.globalAlpha = .95; ctx.drawImage(sprites[b.gold ? 1 : 0], b.x - b.r * 1.1, b.y - b.r * 1.1, b.r * 2.2, b.r * 2.2);
          }
        }
      };
    }
    if (id === 'tiles') {
      const size = clamp(w / 6, 130, 230), gap = 16, height = size * .82;
      const cols = Math.ceil((w + h * .4) / (size + gap)) + 4, rows = Math.ceil((h + w * .4) / (height + gap)) + 4;
      const tiles = Array.from({ length: 4 }, (_, variant) => {
        const s = document.createElement('canvas'); s.width = 240; s.height = 200; const c = s.getContext('2d');
        const bg = c.createLinearGradient(0, 0, 220, 200); bg.addColorStop(0, light ? '#ffffff' : '#303942'); bg.addColorStop(1, light ? '#dde3e7' : '#1b222a');
        c.fillStyle = bg; c.beginPath(); c.roundRect(1, 1, 238, 198, 12); c.fill(); c.strokeStyle = light ? '#b4c0caaa' : '#8799aa44'; c.lineWidth = 1.3; c.stroke();
        c.translate(120, 98); const col = variant === 0 ? p.gold : p.silver;
        if (variant % 2 === 0) {
          stroke(c, [[0, -40], [40, -18], [0, 4], [-40, -18], [0, -40]], col, .75, 1.5);
          stroke(c, [[-40, -18], [-40, 25], [0, 47], [40, 25], [40, -18]], col, .55, 1.5);
          stroke(c, [[0, 4], [0, 47]], col, .55, 1.5);
        } else {
          for (let j = -1; j <= 1; j++) { c.globalAlpha = .55; c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.roundRect(-44, j * 25 - 11, 88, 19, 4); c.stroke(); circle(c, 31, j * 25 - 1, 2, col, .8); }
        }
        return s;
      });
      return {
        info: () => ({ tiles: cols * rows }),
        draw(ctx, dt, t, mouse) {
          ctx.save(); ctx.translate(w / 2 + mouse.nx * 35, h / 2 + mouse.ny * 35); ctx.rotate(-.16 + mouse.nx * .035);
          for (let row = 0; row < rows; row++) {
            const direction = row % 2 ? -1 : 1;
            const offset = ((t * 16 * direction + mouse.nx * 120 * direction) % (size + gap) + size + gap) % (size + gap);
            for (let col = 0; col < cols; col++) {
              const x = (col - cols / 2) * (size + gap) + offset, y = (row - rows / 2) * (height + gap);
              ctx.globalAlpha = .72 + .12 * Math.sin(row + col + t * .25); ctx.drawImage(tiles[(row * 3 + col) % 4], x, y, size, height);
            }
          }
          ctx.restore();
        }
      };
    }
    if (id === 'letters') {
      const chars = '0123456789ABCDEF<>/{}[]+*=.:', cell = Math.max(24, Math.sqrt(w * h / 1750));
      const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), gw = 18, gh = 24;
      const atlas = document.createElement('canvas'); atlas.width = gw * chars.length; atlas.height = gh * 2;
      const c = atlas.getContext('2d'); c.font = '15px ui-monospace, SFMono-Regular, Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      [p.silver, p.gold].forEach((col, r) => { c.fillStyle = col; Array.from(chars).forEach((ch, i) => c.fillText(ch, i * gw + gw / 2, r * gh + gh / 2)); });
      const cells = Array.from({ length: cols * rows }, () => ({ ch: Math.floor(rng() * chars.length), visible: rng() > .25, phase: rng() * tau }));
      let refresh = 0;
      return {
        pulse: wave, info: () => ({ glyphs: cells.length, waves: pulses.length }),
        draw(ctx, dt, t, mouse) {
          waves(dt); refresh += dt;
          if (refresh > .12) { refresh = 0; for (let k = 0; k < cells.length / 22; k++) { const item = cells[Math.floor(rng() * cells.length)]; item.ch = Math.floor(rng() * chars.length); } }
          for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const item = cells[row * cols + col]; if (!item.visible) continue;
            const x = col * cell + cell / 2, y = row * cell + cell / 2;
            const scan = ((t * (52 + mouse.nx * 35) + col * 37) % (h + 250)) - 100;
            let brightness = .23 + Math.exp(-Math.abs(y - scan) / 65) * .58;
            for (const pulse of pulses) { const d = Math.hypot(x - pulse.x, y - pulse.y); brightness += Math.exp(-Math.pow((d - pulse.age * 340) / 55, 2)) * .7 * Math.max(0, 1 - pulse.age / 3.6); }
            if (mouse.inside) brightness += Math.exp(-Math.hypot(x - mouse.x, y - mouse.y) / 100) * .25;
            ctx.globalAlpha = clamp(brightness, .15, 1);
            const line = brightness > .65 || col % 13 === 0 ? 1 : 0;
            const shift = brightness > .8 ? Math.sin(t * 9 + item.phase) * 2 : 0;
            ctx.drawImage(atlas, item.ch * gw, line * gh, gw, gh, x - gw / 2 + mouse.nx * 10, y - gh / 2 + shift + mouse.ny * 10, gw, gh);
          }
        }
      };
    }
    if (id === 'tunnel') {
      const streaks = Array.from({ length: 70 }, (_, i) => ({ angle: rng() * tau, z: .5 + rng() * 5, length: .08 + rng() * .32, gold: i % 4 === 0 }));
      let boost = 0;
      return {
        click: () => { boost = 1; }, info: () => ({ streaks: streaks.length, boost }),
        draw(ctx, dt, t, mouse) {
          boost *= Math.exp(-dt * 1.7);
          const hx = w * (.5 + mouse.nx * .22), hy = h * (.46 + mouse.ny * .22), turn = mouse.nx * .25;
          const point = (angle, z) => [hx + Math.cos(angle + turn) * w * .6 / (z + .15), hy + Math.sin(angle + turn) * h * .65 / (z + .15)];
          for (let lane = 0; lane < 12; lane++) { const a = lane * tau / 12; stroke(ctx, [point(a, 5), point(a, .3)], p.line, .12, .7); }
          for (let i = 0; i < 7; i++) {
            const z = ((i * .7 - t * .35) % 5 + 5) % 5 + .5;
            const ring = Array.from({ length: 13 }, (_, j) => point(j * tau / 12, z));
            stroke(ctx, ring, p.line, .15 * Math.min(1, z), .7);
          }
          for (const s of streaks) {
            s.z -= dt * (.65 + mouse.energy * .65 + boost * 2);
            if (s.z < .24) { s.z = 5.4; s.angle = rng() * tau; }
            const a = point(s.angle, s.z), b = point(s.angle, s.z + s.length * (1 + boost * 2)), col = s.gold ? p.gold : p.silver;
            stroke(ctx, [a, b], col, .13, clamp(9 / s.z, 1, 14));
            stroke(ctx, [a, b], col, .82, clamp(2 / s.z, .7, 4));
          }
          glow(ctx, hx, hy, Math.min(w, h) * .12, p.gold, .14);
        }
      };
    }
    if (id === 'circuit') {
      const grid = 64;
      const paths = Array.from({ length: 24 }, (_, index) => {
        let x = Math.round(rng() * w / grid) * grid, y = Math.round(rng() * h / grid) * grid;
        const points = [[x, y]], lengths = []; let total = 0;
        for (let s = 0; s < 5; s++) {
          const horizontal = (s + index) % 2 === 0, extent = (1 + Math.floor(rng() * 4)) * grid * (rng() > .5 ? 1 : -1);
          const nx = horizontal ? clamp(x + extent, -grid, w + grid) : x, ny = horizontal ? y : clamp(y + extent, -grid, h + grid);
          const len = Math.hypot(nx - x, ny - y); if (len < 1) continue;
          lengths.push(len); total += len; points.push([nx, ny]); x = nx; y = ny;
        }
        return { points, lengths, total, offset: rng(), speed: 35 + rng() * 45, gold: index % 4 === 0 };
      }).filter(path => path.total > 0);
      function at(path, distance) {
        let d = clamp(distance, 0, path.total);
        for (let i = 0; i < path.lengths.length; i++) {
          if (d <= path.lengths[i]) { const f = d / path.lengths[i]; return [mix(path.points[i][0], path.points[i + 1][0], f), mix(path.points[i][1], path.points[i + 1][1], f)]; }
          d -= path.lengths[i];
        }
        return path.points[path.points.length - 1];
      }
      function slice(path, start, end) {
        const points = [at(path, start)]; let d = 0;
        for (let i = 0; i < path.lengths.length; i++) { d += path.lengths[i]; if (d > start && d < end) points.push(path.points[i + 1]); }
        points.push(at(path, end)); return points;
      }
      return {
        info: () => ({ routes: paths.length }),
        draw(ctx, dt, t, mouse) {
          ctx.save(); ctx.translate(mouse.nx * 15, mouse.ny * 15);
          for (const path of paths) {
            const col = path.gold ? p.gold : p.silver;
            stroke(ctx, path.points, col, .18, 1.2);
            path.points.forEach(([x, y], i) => {
              if (i % 2) { ctx.globalAlpha = .3; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x - 4, y - 4, 8, 8); }
              else circle(ctx, x, y, 2, col, .45);
            });
            const speed = path.speed * (1 + mouse.ny * .55), offset = t * speed + path.offset * path.total + mouse.nx * 110;
            const raw = ((offset % path.total) + path.total) % path.total;
            const head = mouse.nx < -.08 ? path.total - raw : raw;
            const start = Math.max(0, head - 75), beam = slice(path, start, head), pos = at(path, head);
            stroke(ctx, beam, col, .11, 7); stroke(ctx, beam, col, .8, 1.8); glow(ctx, pos[0], pos[1], 13, col, .72);
          }
          ctx.restore();
        }
      };
    }
    if (id === 'comet') {
      let charge = 0, cooldown = 0, burstCount = 0, maxCharge = 0, movement = 0;
      let oldX = w / 2, oldY = h / 2;
      const tail = [], sparks = [], blasts = [];
      function resetRay(ray, initial = false) {
        const side = Math.floor(rng() * 4);
        ray.x = side === 0 ? -80 : side === 1 ? w + 80 : rng() * w;
        ray.y = side === 2 ? -80 : side === 3 ? h + 80 : rng() * h;
        if (initial) { ray.x = rng() * w; ray.y = rng() * h; }
        ray.vx = (w / 2 - ray.x) * .3; ray.vy = (h / 2 - ray.y) * .3;
        ray.trail = []; ray.size = .8 + rng() * 1.3; ray.gold = rng() > .55;
      }
      const rays = Array.from({ length: 42 }, () => { const ray = {}; resetRay(ray, true); return ray; });
      function explode(x, y) {
        blasts.push({ x, y, age: 0 }); burstCount++; cooldown = 1.1;
        for (let i = 0; i < 68; i++) {
          const angle = i * tau / 68 + rng() * .08, velocity = 210 + rng() * 400;
          sparks.push({ x, y, oldX: x, oldY: y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, age: 0, life: .65 + rng() * .7, gold: i % 3 !== 0 });
        }
        if (sparks.length > 136) sparks.splice(0, sparks.length - 136);
        for (const ray of rays) { const d = Math.hypot(ray.x - x, ray.y - y) || 1; ray.vx += (ray.x - x) / d * 260; ray.vy += (ray.y - y) / d * 260; }
        charge = 0;
      }
      return {
        info: () => ({ charge, maxCharge, cooldown, burstCount, phase: cooldown > 0 ? 'burst' : movement > 28 ? 'moving' : charge > .01 ? 'charging' : 'idle',
          tail: tail.length, rays: rays.length, sparks: sparks.length, bounds: rays.every(r => Number.isFinite(r.x) && Number.isFinite(r.y)) }),
        draw(ctx, dt, t, mouse) {
          const dx = mouse.x - oldX, dy = mouse.y - oldY;
          movement = dt ? Math.hypot(dx, dy) / dt : 0;
          if (dt) {
            cooldown = Math.max(0, cooldown - dt);
            const moving = mouse.still < .18 || movement > 28;
            if (mouse.inside && moving) charge = Math.max(0, charge - dt * (1 + Math.min(1.2, movement / 600)));
            else if (mouse.inside && cooldown === 0) charge = Math.min(1, charge + dt / 3.1);
            else if (!mouse.inside) charge = Math.max(0, charge - dt * .5);
            maxCharge = Math.max(maxCharge, charge);
            if (charge >= 1) explode(mouse.x, mouse.y);
            if (mouse.inside && Math.hypot(dx, dy) > 2) {
              tail.push({ x: mouse.x, y: mouse.y, age: 0, force: clamp(movement / 750, .3, 1) });
              if (tail.length > 72) tail.shift();
            }
            for (const item of tail) item.age += dt;
            while (tail[0]?.age > .85) tail.shift();
            for (const item of blasts) item.age += dt;
            while (blasts[0]?.age > 1.5) blasts.shift();
            for (let i = sparks.length - 1; i >= 0; i--) {
              const s = sparks[i]; s.oldX = s.x; s.oldY = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
              const drag = Math.exp(-dt * 1.45); s.vx *= drag; s.vy *= drag; s.age += dt;
              if (s.age > s.life) sparks.splice(i, 1);
            }
          }
          oldX = mouse.x; oldY = mouse.y;
          const displayCharge = mouse.static ? .48 : charge;
          const radius = 12 + Math.pow(displayCharge, 1.15) * 88;
          for (const ray of rays) {
            const tx = mouse.inside || mouse.static ? mouse.x : w / 2 + Math.sin(t * .2) * w * .12;
            const ty = mouse.inside || mouse.static ? mouse.y : h / 2 + Math.cos(t * .23) * h * .12;
            const dx = tx - ray.x, dy = ty - ray.y, dist = Math.hypot(dx, dy) || 1;
            if (dt) {
              const speed = 155 + displayCharge * 380 + Math.min(210, mouse.speed * .15);
              const steering = 1 - Math.exp(-dt * 2.2);
              ray.vx = mix(ray.vx, dx / dist * speed, steering); ray.vy = mix(ray.vy, dy / dist * speed, steering);
              ray.trail.push([ray.x, ray.y]); if (ray.trail.length > 7) ray.trail.shift();
              ray.x += ray.vx * dt; ray.y += ray.vy * dt;
              if (dist < Math.max(14, radius * .72) || ray.x < -500 || ray.x > w + 500 || ray.y < -500 || ray.y > h + 500) resetRay(ray);
            }
            const col = ray.gold ? p.gold : p.silver;
            const trace = ray.trail.length ? [...ray.trail, [ray.x, ray.y]] : [[ray.x - dx / dist * 42, ray.y - dy / dist * 42], [ray.x, ray.y]];
            stroke(ctx, trace, col, .07 + displayCharge * .09, ray.size * 5);
            stroke(ctx, trace, col, .38 + displayCharge * .35, ray.size); glow(ctx, ray.x, ray.y, 9, col, .32 + displayCharge * .3);
          }
          for (let i = 1; i < tail.length; i++) {
            const a = tail[i - 1], b = tail[i], fade = Math.pow(Math.max(0, 1 - b.age / .85), 1.6);
            const col = i > tail.length * .55 ? p.gold : p.silver;
            stroke(ctx, [[a.x, a.y], [b.x, b.y]], col, fade * .15, (6 + b.force * 15) * fade);
            stroke(ctx, [[a.x, a.y], [b.x, b.y]], col, fade * .8, 1.5 + fade * 2);
          }
          for (const blast of blasts) {
            const age = blast.age, progress = clamp(age / 1.4, 0, 1), r = 26 + (1 - Math.pow(1 - progress, 2.3)) * Math.max(w, h) * .52;
            ctx.globalAlpha = (1 - progress) * .5; ctx.strokeStyle = p.gold; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(blast.x, blast.y, r, 0, tau); ctx.stroke();
            ctx.globalAlpha = (1 - progress) * .18; ctx.lineWidth = 8; ctx.stroke();
            glow(ctx, blast.x, blast.y, 60 + progress * 180, p.gold, Math.max(0, 1 - age / .3) * .65);
          }
          for (const s of sparks) {
            const fade = Math.pow(Math.max(0, 1 - s.age / s.life), 1.3), col = s.gold ? p.gold : p.silver;
            stroke(ctx, [[s.oldX - s.vx * .022, s.oldY - s.vy * .022], [s.x, s.y]], col, fade * .75, 1.2); glow(ctx, s.x, s.y, 7, col, fade * .35);
          }
          const cx = mouse.x, cy = mouse.y;
          glow(ctx, cx, cy, radius * 2.3, p.gold, .12 + displayCharge * .4);
          ctx.globalAlpha = .36 + displayCharge * .6; ctx.strokeStyle = p.gold; ctx.lineWidth = 1.1 + displayCharge * 1.8;
          ctx.beginPath(); ctx.arc(cx, cy, radius, 0, tau); ctx.stroke();
          ctx.globalAlpha = .1 + displayCharge * .2; ctx.lineWidth = 6 + displayCharge * 8; ctx.stroke();
          ctx.globalAlpha = .2 + displayCharge * .4; ctx.strokeStyle = p.silver; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.arc(cx, cy, radius * (.7 + Math.sin(t * 2) * .025), 0, tau); ctx.stroke();
          const orbitCount = 5 + Math.floor(displayCharge * 11);
          for (let i = 0; i < orbitCount; i++) { const a = i * tau / orbitCount + t * (.4 + displayCharge * .6); circle(ctx, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 1.1 + displayCharge, i % 3 ? p.gold : p.silver, .45 + displayCharge * .5); }
          glow(ctx, cx, cy, 13 + displayCharge * 22, p.ink, .45 + displayCharge * .45);
        }
      };
    }
    // Retained metal effect when WebGL is unavailable. Other scenes stay native 2D.
    return {
      draw(ctx, dt, t, mouse) {
        for (let i = -2; i < 22; i++) {
          const y = i * h / 18, phase = i * .43 + t * .25 + mouse.nx;
          ctx.beginPath(); ctx.moveTo(-w * .1, y);
          ctx.bezierCurveTo(w * .25, y + Math.sin(phase) * h * .35, w * .7, y + Math.cos(phase + mouse.ny) * h * .4, w * 1.1, y + Math.sin(phase + 1) * h * .16);
          ctx.lineTo(w * 1.1, y + h / 18);
          ctx.bezierCurveTo(w * .7, y + h / 18 + Math.cos(phase + mouse.ny) * h * .4, w * .25, y + h / 18 + Math.sin(phase) * h * .35, -w * .1, y + h / 18); ctx.closePath();
          const strip = ctx.createLinearGradient(0, y - h * .2, 0, y + h * .3);
          strip.addColorStop(0, light ? '#919fab' : '#202a34'); strip.addColorStop(.5, i % 3 === 0 ? '#c5a777' : light ? '#f9fafb' : '#84939f'); strip.addColorStop(1, light ? '#d8e1e8' : '#35383c');
          ctx.fillStyle = strip; ctx.globalAlpha = .6; ctx.fill();
        }
      }
    };
  }

  const vertex = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = (aPosition + 1.0) * .5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uLight;
    uniform int uMode;
    const vec3 SILVER = vec3(.64, .69, .74);
    const vec3 GOLD = vec3(.77, .65, .46);
    const vec3 PALE_GOLD = vec3(.90, .82, .69);
    vec3 surface() { return mix(vec3(.13, .137, .153), vec3(.976, .98, .984), uLight); }
    float fourth(float x) { float q = x*x; return q*q; }
    float eighth(float x) { float q = fourth(x); return q*q; }
    float line(float value, float width) {
      float d = abs(fract(value) - .5);
      return 1.0 - smoothstep(width, width + .018, d);
    }
    void main() {
      float aspect = uResolution.x / uResolution.y;
      vec2 p = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
      vec2 mouse = (uPointer * 2.0 - 1.0) * vec2(aspect, 1.0);
      vec2 d = p - mouse;
      float distance = length(d);
      // A full-surface phase/tilt plus a traveling disturbance: never a
      // translated fixed graphic. The pointer can affect every part of the field.
      float ripple = sin(distance * 6.0 - uTime * 2.0) * exp(-distance * .65) * uEnergy;
      vec2 q = p + (uPointer - .5) * vec2(.8, .55);
      q += d / max(distance, .15) * ripple * .13;
      q += vec2(sin(p.y * 1.4 + uTime * .2), cos(p.x * 1.2 - uTime * .18)) * .09;
      vec3 color;
      if (uMode == 0) {
        // Continuous folded surface, with a moving light rather than a sphere.
        float a = q.x * 5.4 + q.y * .8 + sin(q.y * 1.8 + uTime * .2) * .9 + uTime * .6;
        float b = q.y * 4.8 - q.x * 1.8 - uTime * .35;
        float c = q.x * 8.1 + q.y * 3.7 + uTime * .22;
        float dx = cos(a) * 5.4 - cos(b) * .9 + cos(c) * 1.215;
        float dy = cos(a) * (.8 + cos(q.y * 1.8 + uTime * .2) * 1.62) + cos(b) * 2.4 + cos(c) * .555;
        vec3 normal = normalize(vec3(-dx * .22, -dy * .22, 1.0));
        vec3 lamp = normalize(vec3((uPointer.x-.5) * 1.4 - .4, (uPointer.y-.5) * 1.2 + .6, 1.15));
        float diffuse = max(dot(normal, lamp), 0.0);
        float specular = eighth(max(dot(normal, normalize(lamp + vec3(0.0, 0.0, 1.0))), 0.0));
        vec3 low = mix(vec3(.12,.14,.17), vec3(.55,.59,.64), uLight);
        vec3 high = mix(SILVER, vec3(.99,.995,1.0), uLight);
        color = mix(low, high, clamp(diffuse * .62 + specular * .36, 0.0, 1.0));
        float warm = smoothstep(.55, .95, sin(a * .62 + b * .19)) * (.12 + specular * .3);
        color = mix(color, mix(GOLD, PALE_GOLD, uLight), warm);
      }
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }`;

  function webgl(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const shaders = [];
    let program, buffer;
    try {
      function shader(type, source) {
        const compiled = gl.createShader(type); shaders.push(compiled);
        gl.shaderSource(compiled, source); gl.compileShader(compiled);
        if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(compiled));
        return compiled;
      }
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      const uniforms = Object.fromEntries(['uResolution','uPointer','uTime','uEnergy','uLight','uMode'].map(name => [name, gl.getUniformLocation(program, name)]));
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      for (const item of shaders) gl.deleteShader(item);
      return {
        kind: 'webgl',
        draw() {
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
          gl.uniform2f(uniforms.uPointer, current.x, current.y);
          gl.uniform1f(uniforms.uTime, time); gl.uniform1f(uniforms.uEnergy, current.energy);
          gl.uniform1f(uniforms.uLight, light ? 1 : 0); gl.uniform1i(uniforms.uMode, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
        destroy() { if (!gl.isContextLost()) { gl.deleteBuffer(buffer); gl.deleteProgram(program); } }
      };
    } catch (error) {
      shaders.forEach(item => gl.deleteShader(item));
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      return null;
    }
  }



  function twoDimensional(element) {
    const ctx = element.getContext('2d', { alpha: false });
    if (!ctx) return { kind: 'static', draw() {}, destroy() {} };
    let scene, sceneKey = '', width = 0, height = 0, background;
    function setup() {
      const key = styles[mode] + ':' + light;
      if (sceneKey === key && width === viewportWidth && height === viewportHeight) return;
      sceneKey = key; width = viewportWidth; height = viewportHeight;
      scene = field(styles[mode], width, height);
      const p = palette(), space = styles[mode] === 'galaxy' && !light;
      background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, space ? '#070b13' : p.bg);
      background.addColorStop(.6, space ? '#111925' : p.edge);
      background.addColorStop(1, space ? '#14151c' : p.warm);
    }
    return {
      kind: '2d', setup, destroy() {},
      input(name, x, y, power) { setup(); scene[name]?.(x, y, power); },
      info: () => scene?.info?.() || {},
      draw(dt = 0) {
        setup();
        ctx.setTransform(element.width / width, 0, 0, element.height / height, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
        scene.draw(ctx, dt, time, pointer()); ctx.globalAlpha = 1;
      }
    };
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastPaint = 0;
  }
  function allowed() { return active && !paused && !contextLost && focused && !document.hidden && !staticMode(); }
  function activateRenderer() {
    const key = styles[mode] === 'metal' && !force2d ? 'metal' : 'field';
    let cached = cache.get(key);
    if (!cached) {
      const element = cache.size ? freshCanvas() : canvas;
      let instance = key === 'metal' ? webgl(element) : twoDimensional(element);
      let targetCanvas = element;
      if (!instance) { targetCanvas = freshCanvas(); instance = twoDimensional(targetCanvas); }
      cached = { canvas: targetCanvas, renderer: instance, lost: false }; cache.set(key, cached);
      if (instance.kind === 'webgl') {
        targetCanvas.addEventListener('webglcontextlost', event => {
          event.preventDefault(); cached.lost = true;
          if (renderer === cached.renderer) { contextLost = true; stop(); }
        });
        targetCanvas.addEventListener('webglcontextrestored', () => {
          const previous = cached.renderer; previous.destroy(); cached.renderer = webgl(targetCanvas);
          if (!cached.renderer) { cached.canvas = freshCanvas(); cached.renderer = twoDimensional(cached.canvas); }
          cached.lost = false;
          if (renderer === previous) { renderer = cached.renderer; canvas = cached.canvas; layer.replaceChildren(canvas); contextLost = false; resize(); wake(); }
        });
      }
    }
    canvas = cached.canvas; renderer = cached.renderer; contextLost = cached.lost;
    if (layer.firstElementChild !== canvas) layer.replaceChildren(canvas);
    renderer.setup?.(); resize();
  }
  function draw(dt = 0) {
    if (!renderer || contextLost || !active || document.hidden) return;
    const begin = instrument ? performance.now() : 0;
    renderer.draw(dt); metrics.frames++;
    if (instrument) { const elapsed = performance.now() - begin; metrics.totalJsMs += elapsed; metrics.maxJsMs = Math.max(metrics.maxJsMs, elapsed); }
  }
  function resize() {
    viewportWidth = innerWidth; viewportHeight = innerHeight;
    if (!renderer) return;
    const metal = styles[mode] === 'metal';
    const budget = Math.min(pixelBudget, metal ? 400000 : 800000);
    const scale = Math.min(1, (metal ? 1100 : 1600) / viewportWidth, (metal ? 680 : 1000) / viewportHeight, Math.sqrt(budget / (viewportWidth * viewportHeight)));
    canvas.width = Math.max(1, Math.round(viewportWidth * scale)); canvas.height = Math.max(1, Math.round(viewportHeight * scale));
    renderer.setup?.(); draw();
  }
  function frame(timestamp) {
    raf = 0;
    if (!allowed()) { stop(); return; }
    if (lastPaint && timestamp - lastPaint < 1000 / 30 - .5) { raf = requestAnimationFrame(frame); return; }
    const elapsed = lastPaint ? timestamp - lastPaint : 1000 / 30;
    if (elapsed > 95) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames >= 6 && pixelBudget > 400000) { pixelBudget = 400000; resize(); slowFrames = 0; }
    const dt = Math.min(elapsed, 66) / 1000, alpha = 1 - Math.exp(-dt / .085);
    lastPaint = timestamp; target.energy *= Math.exp(-dt / .18); target.speed *= Math.exp(-dt / .12);
    for (const key of ['x', 'y', 'energy', 'speed']) current[key] += (target[key] - current[key]) * alpha;
    time += dt * (styles[mode] === 'metal' ? .25 + current.energy * .85 : 1);
    draw(dt);
    if (styles[mode] === 'metal' && Math.abs(target.x - current.x) < .0002 && Math.abs(target.y - current.y) < .0002 && current.energy < .002) {
      current.x = target.x; current.y = target.y; current.energy = target.energy = 0; lastPaint = 0;
    } else raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && allowed()) raf = requestAnimationFrame(frame); }
  function move(event) {
    if (event.pointerType !== 'mouse' || !allowed()) return;
    if (event.target.closest?.('.cp-background-controls')) { pointerInside = false; return; }
    const now = performance.now(), distance = lastInput ? Math.hypot(event.clientX - lastInput.x, event.clientY - lastInput.y) : 10;
    const speed = lastInput ? distance / Math.max(8, now - lastInput.time) * 1000 : 350;
    target.x = clamp(event.clientX / viewportWidth, 0, 1); target.y = clamp(1 - event.clientY / viewportHeight, 0, 1);
    target.energy = clamp(speed / 1500, .15, 1); target.speed = clamp(speed, 0, 3500); pointerInside = true;
    if (distance > 1.2) lastMotion = time;
    lastInput = { x: event.clientX, y: event.clientY, time: now };
    if (time - pulseTime > .22 && distance > 2) { renderer.input?.('pulse', event.clientX, event.clientY, clamp(speed / 1200, .4, 1)); pulseTime = time; }
    wake();
  }
  function capabilities() {
    const quiet = staticMode();
    pauseButton.disabled = quiet; pauseButton.textContent = quiet ? '静态' : paused ? '继续' : '暂停';
    pauseButton.setAttribute('aria-label', quiet ? '当前设备使用静态背景' : paused ? '继续动态背景' : '暂停动态背景');
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (!allowed()) { stop(); current.energy = target.energy = current.speed = target.speed = 0; lastInput = null; if (active && !document.hidden) draw(); }
    else { draw(); wake(); }
  }
  function routeFor(value) { return '#backgrounds/' + value; }
  function applyMode(value, updateUrl) {
    const index = styles.indexOf(value); if (index < 0) return;
    const changed = mode !== index; stop(); mode = index; select.value = value;
    if (changed) {
      time = 2.4; lastMotion = pulseTime = -100; lastInput = null; pointerInside = false;
      current.x = target.x = current.y = target.y = .5; current.energy = target.energy = current.speed = target.speed = 0;
    }
    if (updateUrl) history.replaceState(null, '', location.pathname + location.search + routeFor(value));
    if (active) { activateRenderer(); capabilities(); }
    select.setAttribute('title', labels[mode]);
  }
  function open(value, updateUrl) {
    if (!active) {
      previousScroll = scrollY; if (!location.hash.startsWith('#backgrounds')) previousHash = location.hash || '#cp-top';
      active = true; focused = true; document.body.classList.add('cp-background-only'); layer.hidden = false; controls.hidden = false;
      select.focus({ preventScroll: true });
    }
    applyMode(styles.includes(value) ? value : styles[0], updateUrl);
  }
  function close(updateUrl) {
    if (!active) return;
    stop(); active = false; current.energy = target.energy = current.speed = target.speed = 0; lastInput = null; pointerInside = false;
    document.body.classList.remove('cp-background-only'); layer.hidden = true; controls.hidden = true;
    if (updateUrl) history.replaceState(null, '', location.pathname + location.search + previousHash);
    entry.focus({ preventScroll: true }); scrollTo(0, previousScroll);
  }
  function fromHash() {
    const match = location.hash.match(/^#backgrounds(?:\/([a-z-]+))?$/);
    if (match) { const value = styles.includes(match[1]) ? match[1] : styles[0]; open(value, Boolean(match[1] && value !== match[1])); }
    else close(false);
  }
  function step(delta) { applyMode(styles[(mode + delta + styles.length) % styles.length], true); }
  document.querySelector('#cp-background-prev').addEventListener('click', () => step(-1));
  document.querySelector('#cp-background-next').addEventListener('click', () => step(1));
  controls.addEventListener('keydown', event => {
    if (event.target === select || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); if (event.key === 'Home') applyMode(styles[0], true);
    else if (event.key === 'End') applyMode(styles[styles.length - 1], true); else step(event.key === 'ArrowRight' ? 1 : -1);
  });
  select.addEventListener('change', () => applyMode(select.value, true));
  paletteButton.addEventListener('click', () => {
    light = !light; controls.dataset.palette = light ? 'light' : 'dark'; paletteButton.textContent = light ? '深色' : '浅色';
    paletteButton.setAttribute('aria-label', light ? '切换到深色背景' : '切换到浅色背景'); renderer?.setup?.(); draw();
  });
  pauseButton.addEventListener('click', () => { paused = !paused; capabilities(); });
  document.querySelector('#cp-background-close').addEventListener('click', () => close(true));
  entry.addEventListener('click', event => { event.preventDefault(); open(entry.hash.split('/')[1] || styles[0], true); });
  addEventListener('keydown', event => { if (active && event.key === 'Escape') { event.preventDefault(); close(true); } });
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerout', event => { if (!event.relatedTarget) { pointerInside = false; lastInput = null; } }, { passive: true });
  addEventListener('pointerdown', event => {
    if (!allowed() || event.pointerType !== 'mouse' || event.target.closest?.('.cp-background-controls')) return;
    renderer.input?.('click', event.clientX, event.clientY, 1); wake();
  }, { passive: true });
  addEventListener('resize', () => { stop(); lastInput = null; resize(); wake(); }, { passive: true });
  addEventListener('blur', () => { focused = false; stop(); });
  addEventListener('focus', () => { focused = true; capabilities(); });
  addEventListener('hashchange', fromHash);
  document.addEventListener('visibilitychange', capabilities);
  reduced.addEventListener('change', capabilities); fine.addEventListener('change', capabilities);
  addEventListener('pagehide', stop);
  // Inspect simulation and scheduling without changing production configuration.
  window.CRA1BackgroundPreview = Object.freeze({
    open: value => open(value, true), close: () => close(true),
    getState: () => ({ active, style: styles[mode], label: labels[mode], count: styles.length, light, paused, running: Boolean(raf),
      backend: renderer?.kind || 'uninitialized', contextLost, static: staticMode(), time,
      pointer: { x: current.x, y: 1 - current.y, inside: pointerInside }, simulation: renderer?.info?.() || {},
      buffer: { width: canvas.width, height: canvas.height, pixels: canvas.width * canvas.height }, ...metrics })
  });
  fromHash();
})();
