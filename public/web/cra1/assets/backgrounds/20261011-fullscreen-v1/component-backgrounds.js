/* Five fullscreen experiments; no dependencies, requests or saved settings.
   One low-resolution surface, one draw call, capped updates, idle stop. */
(() => {
  'use strict';
  const styles = ['metal', 'ribbons', 'glass', 'terrain', 'curtain'];
  const labels = ['金属绸缎', '流动色带', '玻璃折射', '数字地形', '全屏光幕'];
  const layer = document.querySelector('#cp-background-layer');
  const controls = document.querySelector('#cp-background-controls');
  const select = document.querySelector('#cp-background-select');
  const buttons = [...controls.querySelectorAll('[data-fx-mode]')];
  const paletteButton = document.querySelector('#cp-background-palette');
  const pauseButton = document.querySelector('#cp-background-pause');
  const entry = document.querySelector('#cp-background-open');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const instrument = new URLSearchParams(location.search).has('measure');
  let canvas = document.querySelector('#cp-background-canvas');
  let renderer, active = false, paused = false, contextLost = false;
  let mode = 0, light = false, raf = 0, lastPaint = 0, time = 2.4;
  let previousHash = '#cp-top', previousScroll = 0, pixelBudget = 400000, slowFrames = 0;
  let viewportWidth = innerWidth, viewportHeight = innerHeight, lastInput = null;
  const current = { x: .5, y: .5, energy: 0 }, target = { ...current };
  const metrics = { frames: 0, totalJsMs: 0, maxJsMs: 0 };

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
      } else if (uMode == 1) {
        // Broad color ribbons deform across the complete viewport.
        float a = sin(q.y * 2.1 + q.x * .75 + sin(q.x * 1.3 - uTime * .25) * .8 - uTime * .3);
        float b = sin(q.y * .95 - q.x * 1.1 + sin(q.y * 1.5 + uTime * .16) * .7 + uTime * .25);
        float silverBand = smoothstep(-.85, .85, a);
        float goldBand = smoothstep(-.1, .95, b);
        color = mix(surface(), mix(vec3(.40,.47,.55),vec3(.74,.80,.85),uLight), silverBand * .82);
        color = mix(color, mix(vec3(.54,.43,.30),PALE_GOLD,uLight), goldBand * .65);
        color += vec3(.035) * fourth(.5 + .5 * sin(a * 2.0 + b));
      } else if (uMode == 2) {
        // An analytic warped backdrop; never samples or bends page content.
        vec2 glass = q + vec2(sin(q.y * 3.6 + uTime * .25), sin(q.x * 3.0 - uTime * .2)) * .23;
        float broad = .5 + .5 * sin(glass.x * 1.9 - glass.y * .7);
        color = mix(surface(), mix(vec3(.31,.39,.47),vec3(.80,.86,.90),uLight), broad * .75);
        color = mix(color, mix(vec3(.48,.40,.30),PALE_GOLD,uLight), (.5+.5*sin(glass.y*1.8+glass.x*.5)) * .25);
        float vertical = eighth(.5+.5*cos(glass.x*7.0+sin(glass.y*2.0)));
        float horizontal = eighth(.5+.5*cos(glass.y*5.0+sin(glass.x*2.2)));
        float caustic = eighth(.5+.5*sin(glass.x*3.8+glass.y*1.7));
        color = mix(color, mix(SILVER,vec3(1.0),uLight), vertical * .25 + horizontal * .16);
        color += mix(vec3(.11,.12,.13),vec3(.05),uLight) * caustic;
      } else if (uMode == 3) {
        // Contours of one deforming height field, not moving line decorations.
        float h = sin(q.x*1.7+uTime*.18)*.55 + cos(q.y*2.1-uTime*.22)*.45;
        h += sin(q.x*2.5+q.y*2.7+uTime*.13)*.25 + ripple*.16;
        float minor = line(h*9.0, .027);
        float major = line(h*2.25+.125, .014);
        color = mix(surface(), mix(vec3(.18,.23,.28),vec3(.85,.89,.92),uLight), .2+.2*(h+.8));
        color = mix(color, mix(vec3(.48,.56,.64),vec3(.48,.56,.63),uLight), minor * .55);
        color = mix(color, mix(GOLD,vec3(.68,.53,.34),uLight), major * .75);
      } else {
        // A full-width curtain of angled light; global direction follows input.
        float angle = .35 + (uPointer.x-.5)*.45;
        float x = q.x*cos(angle) - q.y*sin(angle);
        float a = eighth(.5+.5*sin(x*5.0+q.y*.38+uTime*.22));
        float b = fourth(.5+.5*sin(x*2.0-q.y*.24-uTime*.17));
        float c = fourth(.5+.5*cos(x*6.3+q.y*.12+uTime*.15));
        color = mix(surface(), mix(vec3(.49,.55,.61),vec3(.77,.82,.86),uLight), a*.72+b*.18);
        color = mix(color, mix(GOLD,PALE_GOLD,uLight), c*b*.32);
        color += mix(vec3(.07),vec3(.018),uLight)*a*a;
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
          gl.uniform1f(uniforms.uLight, light ? 1 : 0); gl.uniform1i(uniforms.uMode, mode);
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

  // Lightweight path-based fallback; covers the full screen without pixel loops.
  function twoDimensional(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return { kind: 'static', draw() {}, destroy() {} };
    return {
      kind: '2d', destroy() {},
      draw() {
        const w = canvas.width, h = canvas.height;
        const px = current.x-.5, py = current.y-.5, t = time;
        ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1;
        const base = ctx.createLinearGradient(0,0,w,h);
        base.addColorStop(0,light?'#f9fafb':'#212327'); base.addColorStop(.6,light?'#dce3e9':'#424d59'); base.addColorStop(1,light?'#eadfcf':'#39332c');
        ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
        if (mode===0 || mode===1) {
          const count = mode===0?18:6;
          for(let i=-2;i<count+2;i++) {
            const y=i*h/count, phase=i*.43+t*.25+px;
            ctx.beginPath();ctx.moveTo(-w*.1,y);
            ctx.bezierCurveTo(w*.25,y+Math.sin(phase)*h*.35,w*.7,y+Math.cos(phase+py)*h*.4,w*1.1,y+Math.sin(phase+1)*h*.16);
            ctx.lineTo(w*1.1,y+h/count);
            ctx.bezierCurveTo(w*.7,y+h/count+Math.cos(phase+py)*h*.4,w*.25,y+h/count+Math.sin(phase)*h*.35,-w*.1,y+h/count);
            ctx.closePath();
            const strip=ctx.createLinearGradient(0,y-h*.2,0,y+h*.3);
            strip.addColorStop(0,light?'#919fab':'#202a34');strip.addColorStop(mode===0?.5:.8,i%3===0?'#c5a777':light?'#f9fafb':'#84939f');strip.addColorStop(1,light?'#d8e1e8':'#35383c');
            ctx.fillStyle=strip;ctx.globalAlpha=mode===0?.6:.55;ctx.fill();
          }
        } else if (mode===2 || mode===3) {
          ctx.lineWidth=mode===2?1.8:1.05;
          for(let i=-5;i<35;i++) {
            ctx.beginPath();
            for(let step=0;step<=48;step++) {
              const x=step*w/48;
              const y=i*h/24+Math.sin(x/w*5.0+py*2+t*.35+i*.055)*h*.12+Math.cos(x/w*2.8-px+t*.16+i*.13)*h*.14;
              if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
            }
            ctx.strokeStyle=i%4===0?(light?'#a78d69':'#c5a777'):(light?'#8194a5':'#8294a4');ctx.globalAlpha=mode===2?.35:.55;ctx.stroke();
          }
          if(mode===2)for(let i=-2;i<19;i++) {
            ctx.beginPath();for(let step=0;step<=24;step++) {
              const y=step*h/24,x=i*w/15+Math.sin(y/h*4.0+px*2+t*.28+i*.06)*w*.08;
              if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
            }
            ctx.strokeStyle=light?'#fff':'#bdcbd7';ctx.globalAlpha=.35;ctx.stroke();
          }
        } else {
          ctx.translate(w*.5,h*.5);ctx.rotate(.35+px*.45);
          for(let i=-6;i<7;i++) {
            const x=i*w*.2+Math.sin(t*.3+py)*w*.1;
            const beam=ctx.createLinearGradient(x-w*.08,0,x+w*.08,0);
            beam.addColorStop(0,'transparent');beam.addColorStop(.45,i%3===0?'#c5a777':light?'#aab8c4':'#afbdc9');beam.addColorStop(1,'transparent');
            ctx.fillStyle=beam;ctx.globalAlpha=.34;ctx.fillRect(x-w*.08,-h*2,w*.16,h*4);
          }
        }
        ctx.globalAlpha=1;
      }
    };
  }

  function replaceCanvas() {
    const next = canvas.cloneNode(false); canvas.replaceWith(next); canvas = next;
  }
  function initialize() {
    const force2d = new URLSearchParams(location.search).get('bg-renderer') === '2d';
    renderer = force2d ? null : webgl(canvas);
    if (!renderer) { replaceCanvas(); renderer = twoDimensional(canvas); }
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; stop(); });
    canvas.addEventListener('webglcontextrestored', () => {
      renderer.destroy(); renderer = webgl(canvas);
      if (!renderer) { replaceCanvas(); renderer = twoDimensional(canvas); }
      contextLost = false; resize();
    });
    resize();
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastPaint = 0;
  }
  function allowed() { return active && !paused && !contextLost && !document.hidden && !reduced.matches && fine.matches; }
  function draw() {
    if (!renderer || contextLost) return;
    const begin = instrument ? performance.now() : 0;
    renderer.draw(); metrics.frames++;
    if (instrument) { const elapsed = performance.now()-begin; metrics.totalJsMs+=elapsed;metrics.maxJsMs=Math.max(metrics.maxJsMs,elapsed); }
  }
  function resize() {
    viewportWidth=innerWidth;viewportHeight=innerHeight;
    if (!renderer) return;
    const scale=Math.min(1,1100/viewportWidth,680/viewportHeight,Math.sqrt(pixelBudget/(viewportWidth*viewportHeight)));
    canvas.width=Math.max(1,Math.round(viewportWidth*scale));canvas.height=Math.max(1,Math.round(viewportHeight*scale));
    if(active)draw();
  }
  function frame(timestamp) {
    raf=0;
    if(!allowed()) { stop();return; }
    if(lastPaint && timestamp-lastPaint<1000/30-.5) { raf=requestAnimationFrame(frame);return; }
    const elapsed=lastPaint?timestamp-lastPaint:1000/30;
    if(elapsed>95)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames>=6 && pixelBudget>200000) { pixelBudget=200000;resize();slowFrames=0; }
    const dt=Math.min(elapsed,64),alpha=1-Math.exp(-dt/90);
    lastPaint=timestamp;
    target.energy*=Math.exp(-dt/180);
    for(const key of ['x','y','energy'])current[key]+=(target[key]-current[key])*alpha;
    time+=dt/1000*(.25+current.energy*.85);
    draw();
    if(Math.abs(target.x-current.x)<.0002 && Math.abs(target.y-current.y)<.0002 && current.energy<.002) {
      current.x=target.x;current.y=target.y;current.energy=target.energy=0;draw();lastPaint=0;
    } else raf=requestAnimationFrame(frame);
  }
  function wake() { if(!raf && allowed())raf=requestAnimationFrame(frame); }
  function move(event) {
    if(event.pointerType!=='mouse' || !allowed() || event.target.closest?.('.cp-background-controls'))return;
    const now=performance.now();
    const speed=lastInput?Math.hypot(event.clientX-lastInput.x,event.clientY-lastInput.y)/Math.max(8,now-lastInput.time)*1000:350;
    target.x=clamp(event.clientX/viewportWidth,0,1);target.y=clamp(1-event.clientY/viewportHeight,0,1);
    target.energy=clamp(speed/1500,.3,1);lastInput={x:event.clientX,y:event.clientY,time:now};wake();
  }
  function capabilities() {
    const staticMode=reduced.matches || !fine.matches;
    pauseButton.disabled=staticMode;
    pauseButton.textContent=staticMode?'静态':paused?'继续':'暂停';
    pauseButton.setAttribute('aria-label',staticMode?'当前设备使用静态背景':paused?'继续动态背景':'暂停动态背景');
    pauseButton.setAttribute('aria-pressed',String(paused));
    if(!allowed()) { stop();current.energy=target.energy=0;lastInput=null;if(active && !document.hidden)draw(); }
  }
  function routeFor(value) { return '#backgrounds/'+value; }
  function applyMode(value, updateUrl) {
    const index=styles.indexOf(value);if(index<0)return;
    mode=index;select.value=value;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fxMode===value)));
    if(updateUrl)history.replaceState(null,'',location.pathname+location.search+routeFor(value));
    if(active)draw();
  }
  function open(value, updateUrl) {
    if(!active) {
      previousScroll=scrollY;if(!location.hash.startsWith('#backgrounds'))previousHash=location.hash||'#cp-top';
      active=true;document.body.classList.add('cp-background-only');layer.hidden=false;controls.hidden=false;
      if(!renderer)initialize();else resize();
      controls.querySelector(fine.matches?'[data-fx-mode]':'select').focus({preventScroll:true});
    }
    applyMode(styles.includes(value)?value:styles[0],updateUrl);capabilities();
  }
  function close(updateUrl) {
    if(!active)return;
    stop();active=false;current.energy=target.energy=0;lastInput=null;
    document.body.classList.remove('cp-background-only');layer.hidden=true;controls.hidden=true;
    if(updateUrl)history.replaceState(null,'',location.pathname+location.search+previousHash);
    entry.focus({preventScroll:true});scrollTo(0,previousScroll);
  }
  function fromHash() {
    const match=location.hash.match(/^#backgrounds(?:\/([a-z]+))?$/);
    if(match)open(match[1]||styles[0],false);else close(false);
  }
  buttons.forEach(button=>button.addEventListener('click',()=>applyMode(button.dataset.fxMode,true)));
  controls.querySelector('.cp-background-modes').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const index=buttons.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?4:(index+(event.key==='ArrowRight'?1:4))%5;
    buttons[next].focus();applyMode(styles[next],true);
  });
  select.addEventListener('change',()=>applyMode(select.value,true));
  paletteButton.addEventListener('click',()=>{
    light=!light;controls.dataset.palette=light?'light':'dark';paletteButton.textContent=light?'深色':'浅色';
    paletteButton.setAttribute('aria-label',light?'切换到深色背景':'切换到浅色背景');draw();
  });
  pauseButton.addEventListener('click',()=>{paused=!paused;capabilities();});
  document.querySelector('#cp-background-close').addEventListener('click',()=>close(true));
  entry.addEventListener('click',event=>{event.preventDefault();open(styles[0],true);});
  addEventListener('keydown',event=>{if(active && event.key==='Escape'){event.preventDefault();close(true);}});
  addEventListener('pointermove',move,{passive:true});
  addEventListener('resize',()=>{stop();lastInput=null;resize();},{passive:true});
  addEventListener('blur',stop);
  addEventListener('hashchange',fromHash);
  document.addEventListener('visibilitychange',capabilities);
  reduced.addEventListener('change',capabilities);fine.addEventListener('change',capabilities);
  addEventListener('pagehide',stop);
  // Preview-only diagnostics; instrumentation is opt-in via ?measure.
  window.CRA1BackgroundPreview=Object.freeze({
    open:value=>open(value,true),close:()=>close(true),
    getState:()=>({active,style:styles[mode],label:labels[mode],light,paused,running:Boolean(raf),backend:renderer?.kind||'uninitialized',contextLost,static:reduced.matches||!fine.matches,buffer:{width:canvas.width,height:canvas.height,pixels:canvas.width*canvas.height},...metrics})
  });
  fromHash();
})();
