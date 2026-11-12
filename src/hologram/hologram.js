import { POINTS_VERT, POINTS_FRAG, FULL_VERT, COMPOSITE_FRAG } from "./shaders.js";
import { Spring } from "../core/spring.js";
import { mulberry32, observeResize } from "../core/dom.js";
import { motion } from "../core/motion.js";
const SHAPES = { core: 0, systems: 1, matrix: 2, clusters: 3, helix: 4, pipelines: 5, pass: 6, voxels: 7 };
const MODES = {
  idle: { freq: 0.32, amp: 0.016, disp: 0.1, scan: 0.5, glitch: 0.35, spin: 0.07 },
  listening: { freq: 0.72, amp: 0.022, disp: 0.18, scan: 0.58, glitch: 0.45, spin: 0.1 },
  retrieving: { freq: 2.1, amp: 0.032, disp: 0.55, scan: 0.72, glitch: 1, spin: 0.34 },
  streaming: { freq: 1.15, amp: 0.024, disp: 0.3, scan: 0.62, glitch: 0.55, spin: 0.16 },
  declined: { freq: 0.18, amp: 0.012, disp: 0.06, scan: 0.85, glitch: 1.25, spin: 0.04 }
};
const FOV = 32 * Math.PI / 180;
const DIST = 4.2;
const MORPH_SECONDS = 1.5;
const POINT_UNIFORMS = ["uProj", "uView", "uModel", "uTime", "uN", "uFreq", "uAmp", "uMorph", "uFrom", "uTo", "uMouse", "uMouseVel", "uMouseOn", "uPulse", "uSize", "uDpr", "uAspect", "uShift", "uIntro", "uDisp", "uGain"];
const COMP_UNIFORMS = ["uScene", "uRes", "uTime", "uDisp", "uScan", "uGlitch", "uCenter"];
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}
function link(gl, vs, fs) {
  const p = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  return p;
}
function locations(gl, prog, names) {
  const out = {};
  names.forEach((n) => {
    out[n] = gl.getUniformLocation(prog, n);
  });
  return out;
}
function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}
function model(out, rx, ry, s) {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  out[0] = cy * s;
  out[1] = sx * sy * s;
  out[2] = -cx * sy * s;
  out[3] = 0;
  out[4] = 0;
  out[5] = cx * s;
  out[6] = sx * s;
  out[7] = 0;
  out[8] = sy * s;
  out[9] = -sx * cy * s;
  out[10] = cx * cy * s;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
class Hologram {
  constructor(canvas, { slot, interaction, onStats } = {}) {
    this.canvas = canvas;
    this.slot = slot;
    this.target = interaction || canvas;
    this.onStats = onStats || null;
    this.mode = "idle";
    this.topic = "core";
    this.from = 0;
    this.to = 0;
    this.morph = 1;
    this.queued = null;
    this.time = 0;
    this.rot = 0;
    this.pulseV = 0;
    this.intro = 0;
    this.running = false;
    this.visible = true;
    this.lost = false;
    this.destroyed = false;
    this.fps = 0;
    this.frames = 0;
    this.fpsElapsed = 0;
    this.slow = 0;
    this.age = 0;
    this.mouse = { x: 0, y: 0, vx: 0, vy: 0, t: 0, inside: false };
    const sp = (v, k, c) => new Spring(v, { stiffness: k, damping: c, precision: 1e-4 });
    const m = MODES.idle;
    this.sp = {
      freq: sp(m.freq, 40, 12),
      amp: sp(m.amp, 40, 12),
      disp: sp(m.disp, 50, 13),
      scan: sp(m.scan, 40, 12),
      glitch: sp(m.glitch, 40, 12),
      spin: sp(m.spin, 20, 9),
      tiltX: sp(0, 40, 11),
      tiltY: sp(0, 40, 11),
      mouseOn: sp(0, 30, 11),
      shiftX: sp(0.35, 90, 19),
      shiftY: sp(0.1, 90, 19),
      scale: sp(0.6, 90, 19)
    };
    this.disposers = [];
    this.frame = this.frame.bind(this);
  }
  init() {
    const t0 = performance.now();
    const gl = this.canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) return false;
    this.gl = gl;
    const t1 = performance.now();
    try {
      this.build();
    } catch (err) {
      console.warn("Hologram disabled:", err);
      this.gl = null;
      return false;
    }
    this.bootInfo = { contextMs: t1 - t0, compileMs: performance.now() - t1, points: this.N };
    this.listen();
    if (motion.reduced) this.intro = 1;
    this.layout(true);
    return true;
  }
  build() {
    const gl = this.gl;
    const full = /[?&]holo=full\b/.test(location.search);
    const small = !full && (Math.min(screen.width, screen.height) < 700 || (navigator.hardwareConcurrency || 8) <= 4);
    this.noAdapt = full;
    this.N = small ? 14e3 : 3e4;
    this.count = this.N;
    this.minCount = 8e3;
    this.dprCap = small ? 1.5 : 1.75;
    this.pointSize = small ? 1.9 : 1.85;
    this.points = link(gl, POINTS_VERT, POINTS_FRAG);
    this.comp = link(gl, FULL_VERT, COMPOSITE_FRAG);
    this.u = locations(gl, this.points, POINT_UNIFORMS);
    this.uc = locations(gl, this.comp, COMP_UNIFORMS);
    const rand = mulberry32(20261111);
    const r = new Float32Array(this.N * 4);
    for (let i = 0; i < r.length; i++) r[i] = rand();
    const idx = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) idx[i] = i;
    for (let i = this.N - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = idx[i];
      idx[i] = idx[j];
      idx[j] = t;
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.bufRand = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufRand);
    gl.bufferData(gl.ARRAY_BUFFER, r, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    this.bufIdx = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.emptyVao = gl.createVertexArray();
    this.tex = gl.createTexture();
    this.fbo = gl.createFramebuffer();
    this.allocTarget(2, 2);
    this.proj = new Float32Array(16);
    this.view = new Float32Array(16);
    this.view[0] = 1;
    this.view[5] = 1;
    this.view[10] = 1;
    this.view[15] = 1;
    this.view[14] = -DIST;
    this.modelM = new Float32Array(16);
  }
  allocTarget(w, h) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  listen() {
    const on = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts);
      this.disposers.push(() => el.removeEventListener(ev, fn, opts));
    };
    on(this.target, "pointermove", (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 2 - 1;
      const y = -((e.clientY - r.top) / r.height * 2 - 1);
      const t = performance.now() / 1e3;
      const m = this.mouse;
      const dt = Math.max(8e-3, t - (m.t || t - 0.016));
      if (m.inside) {
        m.vx = m.vx * 0.7 + (x - m.x) / dt * 0.3;
        m.vy = m.vy * 0.7 + (y - m.y) / dt * 0.3;
      }
      m.x = x;
      m.y = y;
      m.t = t;
      m.inside = true;
      this.sp.mouseOn.set(e.pointerType === "touch" ? 0.6 : 1);
      this.sp.tiltY.set(x * 0.45);
      this.sp.tiltX.set(-y * 0.28);
    }, { passive: true });
    on(this.target, "pointerleave", () => {
      this.mouse.inside = false;
      this.sp.mouseOn.set(0);
      this.sp.tiltX.set(0);
      this.sp.tiltY.set(0);
    });
    on(document, "visibilitychange", () => this.sync());
    on(this.canvas, "webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      this.stop();
    });
    on(this.canvas, "webglcontextrestored", () => {
      this.lost = false;
      this.build();
      this.layout(true);
      this.sync();
    });
    on(window, "resize", () => this.layout());
    this.disposers.push(observeResize([this.canvas, this.slot], () => this.layout()));
    const io = new IntersectionObserver((entries) => {
      this.visible = entries[0].isIntersecting;
      this.sync();
    }, { threshold: 0 });
    io.observe(this.canvas);
    this.disposers.push(() => io.disconnect());
  }
  layout(jump = false) {
    if (!this.gl || this.destroyed) return;
    const cr = this.canvas.getBoundingClientRect();
    const w = Math.max(1, cr.width);
    const h = Math.max(1, cr.height);
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (W !== this.canvas.width || H !== this.canvas.height) {
      this.canvas.width = W;
      this.canvas.height = H;
      this.allocTarget(W, H);
    }
    this.dpr = dpr;
    this.cssW = w;
    this.cssH = h;
    perspective(this.proj, FOV, w / h, 0.1, 50);
    if (this.slot) {
      const sr = this.slot.getBoundingClientRect();
      if (sr.width > 0 && sr.height > 0) {
        const cx = (sr.left + sr.width / 2 - cr.left) / w * 2 - 1;
        const cy = -((sr.top + sr.height / 2 - cr.top) / h * 2 - 1);
        const radius = Math.max(60, Math.min(sr.width, sr.height) * 0.5 * 0.8);
        const scale = radius / (h / 2) * Math.tan(FOV / 2) * DIST;
        const springs = [[this.sp.shiftX, cx], [this.sp.shiftY, cy], [this.sp.scale, scale]];
        springs.forEach(([s, v]) => jump || motion.reduced ? s.jump(v) : s.set(v));
      }
    }
    if (!this.running) this.renderStill();
  }
  sync() {
    const shouldRun = this.visible && !this.covered && !document.hidden && !this.lost && !this.destroyed && !motion.reduced;
    if (shouldRun && !this.running) this.start();
    else if (!shouldRun && this.running) this.stop();
    else if (!shouldRun) this.emit();
  }
  start() {
    if (!this.gl || this.running || this.destroyed) return;
    if (motion.reduced) {
      this.renderStill();
      this.emit();
      return;
    }
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
    this.emit();
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }
  frame(now) {
    if (!this.running) return;
    const raw = this.last ? (now - this.last) / 1e3 : 1 / 60;
    this.last = now;
    this.tick(Math.min(0.25, raw));
    this.draw();
    if (this.onFrame) this.onFrame(this);
    this.frames += 1;
    this.fpsElapsed += raw;
    this.age += raw;
    if (this.fpsElapsed >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsElapsed);
      this.frames = 0;
      this.fpsElapsed = 0;
      this.adapt();
      this.emit();
    }
    this.raf = requestAnimationFrame(this.frame);
  }
  tick(dt) {
    for (const k in this.sp) this.sp[k].step(dt);
    this.time += dt;
    this.rot += dt * this.sp.spin.value;
    if (this.intro < 1) this.intro = Math.min(1, this.intro + dt / 1.8);
    if (this.morph < 1) {
      this.morph = Math.min(1, this.morph + dt / MORPH_SECONDS);
      if (this.morph >= 1 && this.queued != null) {
        const q = this.queued;
        this.queued = null;
        this.beginMorph(q);
      }
    }
    this.pulseV *= Math.exp(-dt * 6);
    const decay = Math.exp(-dt * 5);
    this.mouse.vx *= decay;
    this.mouse.vy *= decay;
  }
  adapt() {
    if (this.noAdapt || this.age < 2.5) return;
    if (this.fps >= 52) {
      this.slow = 0;
      return;
    }
    if (this.fps < 45) this.slow += 1;
    if (this.slow < 4) return;
    this.slow = 0;
    if (this.count > this.minCount) this.count = Math.max(this.minCount, Math.floor(this.count * 0.75));
    else if (this.dprCap > 1) {
      this.dprCap = Math.max(1, this.dprCap - 0.25);
      this.layout();
    }
  }
  draw() {
    const gl = this.gl;
    if (!gl || this.lost) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sp = this.sp;
    model(this.modelM, 0.32 + sp.tiltX.value, this.rot + sp.tiltY.value, sp.scale.value);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.points);
    const u = this.u;
    gl.uniformMatrix4fv(u.uProj, false, this.proj);
    gl.uniformMatrix4fv(u.uView, false, this.view);
    gl.uniformMatrix4fv(u.uModel, false, this.modelM);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uN, this.N);
    gl.uniform1f(u.uFreq, sp.freq.value);
    gl.uniform1f(u.uAmp, sp.amp.value);
    gl.uniform1f(u.uMorph, this.morph);
    gl.uniform1i(u.uFrom, this.from);
    gl.uniform1i(u.uTo, this.to);
    gl.uniform2f(u.uMouse, this.mouse.x, this.mouse.y);
    gl.uniform2f(u.uMouseVel, this.mouse.vx, this.mouse.vy);
    gl.uniform1f(u.uMouseOn, sp.mouseOn.value);
    gl.uniform1f(u.uPulse, this.pulseV);
    gl.uniform1f(u.uSize, this.pointSize);
    gl.uniform1f(u.uDpr, this.dpr);
    gl.uniform1f(u.uAspect, W / H);
    gl.uniform2f(u.uShift, sp.shiftX.value, sp.shiftY.value);
    gl.uniform1f(u.uIntro, this.intro);
    gl.uniform1f(u.uDisp, sp.disp.value);
    gl.uniform1f(u.uGain, 0.7);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.comp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    const c = this.uc;
    gl.uniform1i(c.uScene, 0);
    gl.uniform2f(c.uRes, W, H);
    gl.uniform1f(c.uTime, this.time);
    gl.uniform1f(c.uDisp, sp.disp.value);
    gl.uniform1f(c.uScan, sp.scan.value);
    gl.uniform1f(c.uGlitch, sp.glitch.value);
    gl.uniform2f(c.uCenter, (sp.shiftX.value + 1) / 2, (sp.shiftY.value + 1) / 2);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  renderStill() {
    if (!this.gl || this.lost) return;
    if (motion.reduced) {
      for (const k in this.sp) this.sp[k].jump(this.sp[k].target);
      this.intro = 1;
      if (this.queued != null) {
        this.to = this.queued;
        this.queued = null;
      }
      this.morph = 1;
      this.from = this.to;
    }
    this.draw();
    if (this.onFrame) this.onFrame(this);
  }
  beginMorph(shape) {
    if (shape === this.to && this.morph >= 1) return;
    this.from = this.to;
    this.to = shape;
    this.morph = 0;
  }
  setTopic(topic) {
    const shape = SHAPES[topic] != null ? SHAPES[topic] : 0;
    this.topic = topic in SHAPES ? topic : "core";
    if (!this.gl) return;
    if (motion.reduced) {
      this.to = shape;
      this.from = shape;
      this.morph = 1;
      this.renderStill();
      return;
    }
    if (this.morph < 1) this.queued = shape;
    else this.beginMorph(shape);
  }
  setMode(mode) {
    const m = MODES[mode] || MODES.idle;
    this.mode = MODES[mode] ? mode : "idle";
    ["freq", "amp", "disp", "scan", "glitch", "spin"].forEach((k) => this.sp[k].set(m[k]));
    if (!this.running) this.renderStill();
    this.emit();
  }
  pulse(v = 0.2) {
    this.pulseV = Math.min(1, this.pulseV + v);
  }
  cover(flag) {
    this.covered = !!flag;
    this.sync();
  }
  radiusPx() {
    return this.sp.scale.value * this.proj[5] / DIST * (this.cssH / 2);
  }
  project(p) {
    const m = this.modelM;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2];
    const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2];
    const w = DIST - z;
    const nx = this.proj[0] * x / w + this.sp.shiftX.value;
    const ny = this.proj[5] * y / w + this.sp.shiftY.value;
    return { x: (nx + 1) / 2 * this.cssW, y: (1 - ny) / 2 * this.cssH, front: z > -0.05 * this.sp.scale.value };
  }
  stats() {
    return { webgl: !!this.gl, running: this.running, fps: this.fps, points: this.count, mode: this.mode, topic: this.topic, freq: this.sp.freq.value, disp: this.sp.disp.value };
  }
  emit() {
    if (this.onStats) this.onStats(this.stats());
  }
  destroy() {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.disposers.forEach((d) => d());
    this.disposers = [];
    const gl = this.gl;
    if (gl) {
      gl.deleteBuffer(this.bufRand);
      gl.deleteBuffer(this.bufIdx);
      gl.deleteVertexArray(this.vao);
      gl.deleteVertexArray(this.emptyVao);
      gl.deleteTexture(this.tex);
      gl.deleteFramebuffer(this.fbo);
      gl.deleteProgram(this.points);
      gl.deleteProgram(this.comp);
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
    this.gl = null;
  }
}
class StillHologram {
  constructor(hero, slot, onStats) {
    this.hero = hero;
    this.slot = slot;
    this.onStats = onStats;
    this.mode = "idle";
    this.topic = "core";
  }
  init() {
    this.hero.classList.add("no-webgl");
    const place = () => {
      const hr = this.hero.getBoundingClientRect();
      const sr = this.slot.getBoundingClientRect();
      this.hero.style.setProperty("--fx", `${(sr.left + sr.width / 2 - hr.left) / hr.width * 100}%`);
      this.hero.style.setProperty("--fy", `${(sr.top + sr.height / 2 - hr.top) / hr.height * 100}%`);
    };
    place();
    this.dispose = observeResize([this.hero, this.slot], place);
    this.emit();
    return true;
  }
  start() {
    this.emit();
  }
  stop() {
  }
  cover() {
  }
  setMode(m) {
    this.mode = m;
    this.emit();
  }
  setTopic(t) {
    this.topic = t;
  }
  pulse() {
  }
  stats() {
    return { webgl: false, running: false, fps: 0, points: 0, mode: this.mode, topic: this.topic, freq: 0, disp: 0 };
  }
  emit() {
    if (this.onStats) this.onStats(this.stats());
  }
  destroy() {
    if (this.dispose) this.dispose();
  }
}
export {
  Hologram,
  MODES,
  SHAPES,
  StillHologram
};
