/*! Zig Metamorphosis v3.0.0 © 2026 ZigFlames (zigflames.com). All rights reserved. Unauthorized copying, redistribution, resale, or removal of this notice is prohibited. License ZIGMETA3-A41F-9C27-E6B8 · sig:ZS-B7E2C91F04A65D38 */
/* Zig Metamorphosis v3.0.0 morph page. On-device only. Nothing is uploaded. */
'use strict';
(() => {
  const ZIG_OWNER = 'Zig Metamorphosis v3.0.0 © 2026 ZigFlames (zigflames.com). All rights reserved. Unauthorized copying, redistribution, resale, or removal of this notice is prohibited. License ZIGMETA3-A41F-9C27-E6B8 · sig:ZS-B7E2C91F04A65D38';
  const VERT = `/* Zig Metamorphosis v3.0.0 — vertex shader (full-screen triangle pair) */
attribute vec2 a_pos;
varying vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;
  const FRAG = `/* Zig Metamorphosis v3.0.0 — lite/mobile fragment shader (mediump) */
precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_time, u_int, u_modeA, u_modeB, u_mix;
    uniform vec2  u_res;
    uniform vec4  u_crop;
    uniform float u_brain, u_bType, u_bAlpha, u_bPhase, u_bSpin;
    uniform vec4 u_vis; uniform float u_vh, u_th;  // Zig Vision round state
    uniform float u_lt, u_gl;  // light clock (capped, for brightness changes) + glow gain (fades sparkle at high speed)

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm2(vec2 p) { return 0.65 * noise(p) + 0.35 * noise(p * 2.03 + 7.1); } // two octaves
    vec3 tex(vec2 uv) {
      uv = clamp(uv, 0.002, 0.998);
      return texture2D(u_tex, uv * u_crop.xy + u_crop.zw).rgb;
    }
    vec3 hueShift(vec3 c, float a) {
      const vec3 k = vec3(0.57735);
      float ca = cos(a);
      return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
    }

    // Liquid Melt: smooth trig flow warped by one noise lookup (no curl/fbm stack)
    vec3 liquid(vec2 uv, float t, float k) {
      vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 2.2;
      float n = noise(p * 1.3 + vec2(t * 0.15, -t * 0.2));
      vec2 d = vec2(sin(p.y * 3.1 + t * 0.7 + n * 4.0), cos(p.x * 2.7 - t * 0.5 + n * 4.0)) * 0.016 * k;
      d.y += n * n * 0.05 * k * (1.0 - uv.y);
      vec3 c = tex(uv + d);
      return c + smoothstep(0.7, 1.0, n) * 0.10 * k * u_gl;
    }

    // Dissolve & Reform: one noise field, one hash per cell, two texture reads
    vec3 dissolve(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      float n = fbm2(uv * vec2(aspect, 1.0) * 4.0 + vec2(0.0, t * 0.12));
      float th = (0.5 - 0.5 * cos(u_lt * 0.6)) * (0.25 + 0.6 * k);
      float edgeW = 0.03 + 0.05 * k;
      float solid = smoothstep(th - edgeW, th + edgeW, n);
      vec3 base = tex(uv);
      if (solid > 0.995) return base;             // most pixels: one read and done
      float cells = mix(110.0, 50.0, k);
      vec2 g = uv * vec2(cells * aspect, cells);
      vec2 cell = floor(g);
      float h = hash(cell);
      vec2 drift = (vec2(h, fract(h * 13.7)) - 0.5) * 0.10 * k * (1.0 - solid);
      drift.y += 0.04 * k * (1.0 - solid) * h;
      vec3 particle = tex((cell + 0.5) / vec2(cells * aspect, cells) - drift);
      vec2 f = fract(g) - 0.5;
      float dotMask = step(dot(f, f), 0.09) * step(1.0 - (1.0 - solid) * 0.9, h + 0.35);
      vec3 c = mix(particle * dotMask * 1.15 + base * 0.12, base, solid);
      float edge = 1.0 - smoothstep(0.0, edgeW * 1.5, abs(n - th));
      c += mix(vec3(1.0, 0.35, 0.9), vec3(0.3, 0.9, 1.0), n) * edge * (0.25 + 0.9 * k) * step(0.02, th);
      return c;
    }

    // Refraction: one-octave density gradient + two unrolled lenses, dispersion
    vec3 refraction(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 p = uv * vec2(aspect, 1.0);
      vec2 q = p * 2.0 + vec2(t * 0.07, t * 0.05);
      float d0 = noise(q);
      vec2 grad = vec2(noise(q + vec2(0.05, 0.0)) - d0, noise(q + vec2(0.0, 0.05)) - d0) * 20.0;
      vec2 c1 = vec2(0.5 * aspect + 0.3 * aspect * sin(t * 0.21), 0.5 + 0.25 * cos(t * 0.17));
      vec2 c2 = vec2(0.5 * aspect + 0.35 * aspect * cos(t * 0.13 + 1.0), 0.5 + 0.3 * sin(t * 0.19 + 2.0));
      vec2 d1 = p - c1, d2 = p - c2;
      float r1 = length(d1) + 1e-3, r2 = length(d2) + 1e-3;
      vec2 lens = d1 / r1 * sin(r1 * 26.0 - t * 2.2) * exp(-r1 * 3.2) * 0.5
                + d2 / r2 * sin(r2 * 26.0 - t * 2.2) * exp(-r2 * 3.2) * 0.5;
      vec2 off = (grad * 0.012 + lens * 0.018) * k;
      float disp = 0.35 * k;
      vec3 c = vec3(tex(uv + off * (1.0 + disp)).r, tex(uv + off).g, tex(uv + off * (1.0 - disp)).b);
      return c + smoothstep(0.3, 1.0, length(lens)) * 0.08 * k * u_gl;
    }

    // Chroma Morph: one noise, three reads
    vec3 chroma(vec2 uv, float t, float k) {
      float n = noise(uv * 2.5 + t * 0.08);
      float ang = t * 0.35 + n * 3.0;
      vec2 dir = vec2(cos(ang), sin(ang)) * (0.004 + 0.016 * k) * (0.6 + 0.8 * n);
      vec3 c = vec3(tex(uv + dir).r, tex(uv).g, tex(uv - dir).b);
      float hue = (sin(t * 0.25) * 0.6 + (n - 0.5) * 2.0) * k * 1.6;
      return mix(c, hueShift(c, hue), 0.35 + 0.65 * k);
    }

    // ---- v2 morphs: all cheap (mediump-safe, <=9 noise/hash lookups, 1-3 texture reads), continuous, no hard swaps.
    // 6: Ripple Pool: rings spread from three slowly wandering drops, like a still pool being touched
    vec3 ripple(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 p = uv * vec2(aspect, 1.0), g = vec2(0.0);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 c = vec2(aspect * (0.5 + 0.32 * sin(t * (0.11 + 0.04 * fi) + fi * 2.1)), 0.5 + 0.3 * cos(t * (0.09 + 0.03 * fi) + fi * 1.3));
        vec2 d = p - c;
        float r = length(d) + 0.001;
        g += d / r * sin(r * 34.0 - t * 2.4 + fi * 2.0) * exp(-r * 2.6);
      }
      vec3 c = tex(uv + g * 0.010 * k);
      return c + max(0.0, dot(g, vec2(0.6, 0.8))) * 0.06 * k * u_gl;
    }
    // 7: Kaleido Bloom: a soft six-petal mirror fold opens out from the centre, then closes back to the real picture
    vec3 kaleido(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r = length(p), a = atan(p.y, p.x) + t * 0.05;
      float fa = abs(mod(a, 1.0471976) - 0.5235988);
      vec2 q = vec2(cos(fa), sin(fa)) * r * (1.0 + 0.04 * k * sin(t * 0.4 + r * 6.0));
      float bloom = (0.5 - 0.5 * cos(u_lt * 0.35)) * k;
      float w = clamp(bloom * smoothstep(0.05, 0.45, r) * (0.75 + 0.5 * noise(p * 3.0 + t * 0.1)), 0.0, 0.7);
      return mix(tex(uv), tex(q / vec2(aspect, 1.0) + 0.5), w);
    }
    // 8: Smoke Drift: the picture rises and curls like smoke (curl-noise flow) with soft haze in the wisps
    vec3 smoke(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 p = uv * vec2(aspect, 1.0) * 3.0 - vec2(0.0, t * 0.25);
      float n0 = noise(p), nx = noise(p + vec2(0.08, 0.0)), ny = noise(p + vec2(0.0, 0.08));
      vec2 cu = vec2(ny - n0, n0 - nx) * 12.5;
      float n2 = noise(p * 2.1 + cu * 0.4 + 5.0);
      vec3 c = tex(uv + (cu * 0.012 - vec2(0.0, 0.02 * n2)) * k);
      float wisp = smoothstep(0.45, 0.9, n2) * k * u_gl;
      return mix(c, mix(vec3(dot(c, vec3(0.333))), vec3(0.86, 0.86, 0.9), 0.35), wisp * 0.35);
    }
    // 9: Mirror Twin: a mirrored twin of the picture fuses in and out along a softly swaying axis
    vec3 mirror(vec2 uv, float t, float k) {
      float axis = 0.5 + 0.06 * sin(t * 0.13);
      vec2 m = vec2(2.0 * axis - uv.x, uv.y) + (vec2(noise(uv * 3.0 + t * 0.1), noise(uv * 3.0 - t * 0.1 + 4.0)) - 0.5) * 0.02 * k;
      float w = clamp(k * (0.3 + 0.25 * sin(u_lt * 0.3)) * (0.7 + 0.6 * noise(uv * 2.0 + t * 0.05)), 0.0, 0.6);
      return mix(tex(uv), tex(m), w);
    }
    // 10: Glass Shatter Flow: slow crystalline facets, each bending the light a little differently
    vec3 shatter(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 p = uv * vec2(aspect, 1.0) * 5.0, ip = floor(p), fp = fract(p), id = ip;
      float d1 = 8.0, d2 = 8.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        float h = hash(ip + g);
        float d = length(g + 0.5 + 0.38 * sin(t * 0.25 + 6.2831 * vec2(h, fract(h * 7.3))) - fp);
        if (d < d1) { d2 = d1; d1 = d; id = ip + g; } else if (d < d2) { d2 = d; }
      }
      float h = hash(id), ang = 6.2831 * h + t * 0.15;
      vec2 off = vec2(cos(ang), sin(ang)) * (0.006 + 0.014 * h) * k;
      float dp = 0.3 * k;
      vec3 c = vec3(tex(uv + off * (1.0 + dp)).r, tex(uv + off).g, tex(uv + off * (1.0 - dp)).b);
      return c + (1.0 - smoothstep(0.0, 0.06, d2 - d1)) * 0.10 * k * u_gl;
    }
    // 11: Pulse Breathe: the frame gently inhales and exhales (centre-weighted zoom with a soft twist)
    vec3 breathe(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float br = sin(u_lt * 0.9), fall = exp(-length(p) * 2.2);
      float sw = br * 0.12 * k * fall + (noise(p * 2.0 + t * 0.1) - 0.5) * 0.06 * k;
      float cs = cos(sw), sn = sin(sw);
      vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) * (1.0 - br * 0.06 * k * fall);
      return tex(q / vec2(aspect, 1.0) + 0.5);
    }

    // 12: Zig Vision (perception boost): unsharp mask + vibrance, soft vignette focus pull, slow low-contrast peripheral
    // drift texture at the edges, and now and then a soft complementary-tint primer that fades so true colours look richer.
    // All round parameters (u_vis = primer, enhance, vignette, edge drift; u_vh = primer hue) ease over seconds in JS.
    vec3 vision(vec2 uv, float t, float k) {
      float aspect = u_res.x / u_res.y;
      vec2 px = 1.5 / u_res;
      vec3 c = tex(uv);
      vec3 bl = (tex(uv + vec2(px.x, 0.0)) + tex(uv - vec2(px.x, 0.0)) + tex(uv + vec2(0.0, px.y)) + tex(uv - vec2(0.0, px.y))) * 0.25;
      c += (c - bl) * (0.6 + 1.2 * u_vis.y) * k;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
      c = mix(vec3(l), c, 1.0 + (0.12 + 0.25 * u_vis.y) * k * (1.0 - sat));
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r = length(p);
      c *= 1.0 - u_vis.z * k * smoothstep(0.35, 0.95, r) * 0.45;
      float saw = fract(atan(p.y, p.x) * 3.8197 + r * 6.0 - t * 0.05);
      c += (saw - 0.5) * 0.06 * smoothstep(0.45, 0.85, r) * u_vis.w * k;
      c = mix(c, mix(vec3(l), hueShift(vec3(0.62, 0.5, 0.42), u_vh), 0.5), u_vis.x * 0.35);
      return c;
    }

    // 13: Thick: smooth, organic horizontal widening of the lower-middle of the frame (roughly 45-80% down), strongest at the
    // centre and fading out toward the sides and above/below (waist-preserving falloff), slowly breathing; plus a warm skin
    // glow (warm tint, soft smoothing, highlight bloom, light saturation). u_th = amount (eased in over 3 s in JS).
    vec3 thick(vec2 uv, float t, float k) {
      float amt = u_th * (0.85 + 0.15 * sin(t * 0.5));
      float band = exp(-pow((uv.y - 0.375) / 0.16, 2.0));
      float dx = uv.x - 0.5;
      float s = 1.0 + amt * band * exp(-pow(dx / 0.32, 2.0));
      vec2 q = vec2(0.5 + dx / s, uv.y);
      vec3 c = tex(q), w = vec3(1.06, 1.0, 0.92);
      vec3 soft = (tex(q + vec2(0.004, 0.0)) + tex(q - vec2(0.004, 0.0)) + tex(q + vec2(0.0, 0.004)) + tex(q - vec2(0.0, 0.004))) * 0.25;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, soft, 0.25 * k) * w + smoothstep(0.55, 1.0, l) * 0.05 * k;
      return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.0 + 0.12 * k);
    }

    vec3 effect(float m, vec2 uv, float t, float k) {
      if (m < 0.5) return liquid(uv, t, k);
      if (m < 1.5) return dissolve(uv, t, k);
      if (m < 2.5) return refraction(uv, t, k);
      if (m < 3.5) return chroma(uv, t, k);
      if (m < 6.5) return ripple(uv, t, k);
      if (m < 7.5) return kaleido(uv, t, k);
      if (m < 8.5) return smoke(uv, t, k);
      if (m < 9.5) return mirror(uv, t, k);
      if (m < 10.5) return shatter(uv, t, k);
      if (m < 11.5) return breathe(uv, t, k);
      if (m < 12.5) return vision(uv, t, k);
      return thick(uv, t, k);
    }

    // Brain Morph overlay: smooth sinusoidal patterns; per-pixel temporal freq = phase rate (< 1 Hz, set in JS)
    vec4 brain(vec2 uv) {
      float aspect = u_res.x / u_res.y;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r = length(p) + 1e-3;
      float th = atan(p.y, p.x);
      float lum, a;
      if (u_bType < 0.5) {
        lum = 0.5 + 0.5 * sin(4.0 * (th + u_bSpin) + 9.0 * log(r) - 6.2831853 * u_bPhase);
        a = smoothstep(0.02, 0.12, r);
      } else if (u_bType < 1.5) {
        lum = 0.5 + 0.5 * sin(10.0 * log(r) + 0.09 * sin(3.0 * th + u_bSpin * 2.0) - 6.2831853 * u_bPhase);
        a = smoothstep(0.02, 0.12, r);
      } else {
        float saw = fract((th + u_bSpin * 0.2) / 6.2831853 * 24.0 + mod(floor(r * 9.0), 2.0) * 0.5);
        lum = mix(0.15, 0.85, saw < 0.8 ? saw / 0.8 : (1.0 - saw) / 0.2);
        a = smoothstep(0.12, 0.35, r) * 0.8;
      }
      float alpha = u_bAlpha * a * (0.18 + 0.47 * u_int);
      vec3 col = mix(vec3(0.05, 0.03, 0.10), vec3(0.95, 0.92, 1.0), lum);
      float dotA = (1.0 - smoothstep(0.006, 0.010, r)) * u_bAlpha * 0.9;
      col = mix(col, vec3(1.0, 0.3, 0.3), dotA);
      alpha = max(alpha, dotA);
      return vec4(col * alpha, alpha);
    }

    void main() {
      if (u_brain > 0.5) { gl_FragColor = brain(v_uv); return; }
      vec3 col = effect(u_modeA, v_uv, u_time, u_int);
      if (u_mix > 0.001) {
        vec3 b = effect(u_modeB, v_uv, u_time, u_int);
        float front = noise(v_uv * 3.0 + u_time * 0.1);
        col = mix(col, b, smoothstep(front - 0.25, front + 0.25, u_mix * 1.5 - 0.25));
      }
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;
  const $ = (id) => document.getElementById(id);
  const MODES = {
    liquid: 0, dissolve: 1, refraction: 2, chroma: 3, cycle: 4, brain: 5,
    ripple: 6, kaleido: 7, smoke: 8, mirror: 9, shatter: 10, breathe: 11, vision: 12, thick: 13
  };
  const CYCLE = [0, 6, 1, 8, 2, 10, 3, 7, 11, 9];
  const PACE = { slow: 0.5, normal: 1, fast: 2, turbo: 3.5 };
  const PERF = { low: { fps: 15, scale: 0.5, max: 720 }, medium: { fps: 24, scale: 0.6, max: 960 }, high: { fps: 30, scale: 0.85, max: 1280 } };
  const LIGHT_CAP = 3, BRAIN_MAX_HZ = 0.9, BRAIN_FPS = 15;
  const DEFAULTS = { mode: 'cycle', intensity: 60, speed: 40, adapt: 25, perf: 'medium', pace: 'normal' };
  const STORE = 'zigMobileSettingsV3';
  const UNIFORMS = ['u_tex','u_time','u_int','u_res','u_crop','u_modeA','u_modeB','u_mix','u_brain','u_bType','u_bAlpha','u_bPhase','u_bSpin','u_lt','u_gl','u_vis','u_vh','u_th'];

  let settings = { ...DEFAULTS };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
  if (!(settings.mode in MODES)) settings.mode = DEFAULTS.mode;
  if (!PERF[settings.perf]) settings.perf = DEFAULTS.perf;
  if (!PACE[settings.pace]) settings.pace = DEFAULTS.pace;
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) {} };

  let vRound = null;
  function visionState() {
    const now = performance.now() / 1000, R = Math.random;
    const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    if (!vRound || now >= vRound.end || now < vRound.start) {
      const from = vRound ? vRound.cur.slice() : [0, 0.6, 0.6, 0.6];
      vRound = { start: now, end: now + 30 + 15 * R(), from, to: [0, 0.4 + 0.6 * R(), 0.3 + 0.7 * R(), 0.3 + 0.7 * R()], hue: 6.2832 * R(), prime: 0.5 + 0.5 * R(), cur: from };
    }
    const x = now - vRound.start, m = ease(x / 3), cur = vRound.from.map((a, i) => a + (vRound.to[i] - a) * m);
    cur[0] = vRound.prime * (x < 2 ? ease(x / 2) : 1 - ease((x - 5) / 3));
    vRound.cur = cur;
    return [cur[0], cur[1], cur[2], cur[3], vRound.hue];
  }
  let thickSince = 0;
  function thickAmt(st) {
    if (!st || (st.a !== 13 && st.b !== 13)) { thickSince = 0; return 0; }
    const now = performance.now();
    if (!thickSince) thickSince = now;
    const u = Math.min(1, (now - thickSince) / 3000);
    return (0.08 + 0.10 * intensity()) * u * u * (3 - 2 * u);
  }
  const perfOf = () => PERF[settings.perf] || PERF.medium;
  const paceOf = () => PACE[settings.pace] || 1;
  const speedFactor = () => (0.1 + (settings.speed / 100) * 2.4) * paceOf();
  const glowGain = () => Math.min(1, 2.5 / speedFactor());
  const intensity = () => Math.max(0, Math.min(1, settings.intensity / 100));

  let clock = 0, lclock = 0, lastNow = performance.now(), brainHz = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000), sf = speedFactor();
    clock += dt * sf; lclock += dt * Math.min(sf, LIGHT_CAP); lastNow = now; return clock;
  }
  function cycleState() {
    const n = CYCLE.length, pos = lclock / 7, i = Math.floor(pos) % n, f = pos - Math.floor(pos);
    const blend = f < 0.6 ? 0 : (f - 0.6) / 0.4;
    return { a: CYCLE[i], b: CYCLE[(i + 1) % n], mix: blend * blend * (3 - 2 * blend) };
  }
  let brainStart = performance.now(), brainPhase = 0, brainSpin = 0, brainLast = performance.now();
  function brainState() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - brainLast) / 1000); brainLast = now;
    const spin = 0.05 * paceOf();
    const rate = Math.min(0.25 + 0.6 * (settings.speed / 100), BRAIN_MAX_HZ - 4.8 * spin / (2 * Math.PI));
    brainHz = rate + 4.8 * spin / (2 * Math.PI);
    brainPhase = (brainPhase + dt * rate) % 1;
    brainSpin = (brainSpin + dt * spin) % (10 * Math.PI);
    const adapt = Math.max(5, Math.min(120, Number(settings.adapt) || 25));
    const FADE = 2, VIEW = 8, sA = adapt + FADE + VIEW, sD = 22, total = sA * 2 + sD;
    let x = ((now - brainStart) / 1000) % total;
    const ease = (u) => u * u * (3 - 2 * u);
    const block = (type, t) => {
      let alpha;
      if (t < 1.5) alpha = ease(t / 1.5);
      else if (t < adapt) alpha = 1;
      else if (t < adapt + FADE) alpha = 1 - ease((t - adapt) / FADE);
      else alpha = 0;
      return { type, alpha };
    };
    if (x < sA) return block(0, x);
    x -= sA;
    if (x < sA) return block(1, x);
    x -= sA;
    const alpha = x < 4 ? ease(x / 4) : x < 14 ? 1 : x < 18 ? 1 - ease((x - 14) / 4) : 0;
    return { type: 2, alpha };
  }
  function modeState() {
    const m = MODES[settings.mode] ?? 4;
    if (m === 4) return cycleState();
    if (m === 5) return { a: 0, b: 0, mix: 0, brain: true };
    return { a: m, b: m, mix: 0 };
  }

  const video = $('video'), canvas = $('canvas'), stage = $('stage');
  const stats = { draws: 0, uploads: 0, errors: [] };
  let gl = null, prog = null, tex = null, u = {}, hasFrame = false, texBlocked = false;
  let running = false, rafId = 0, rvfcId = 0, lastDraw = 0, lastTime = -1, blobUrl = null;

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { stats.errors.push(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function initGL() {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) { texBlocked = true; return false; }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { texBlocked = true; return false; }
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { stats.errors.push(gl.getProgramInfoLog(prog)); texBlocked = true; return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    u = {}; for (const n of UNIFORMS) u[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(u.u_tex, 0);
    return true;
  }

  function videoBox() {
    const vw = video.videoWidth, vh = video.videoHeight;
    const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
    if (!vw || !vh || !w || !h) return { left: 0, top: 0, width: w, height: h };
    const ea = w / h, va = vw / vh;
    if (va > ea) { const hh = w / va; return { left: 0, top: (h - hh) / 2, width: w, height: hh }; }
    const ww = h * va; return { left: (w - ww) / 2, top: 0, width: ww, height: h };
  }

  function sizeBuffer() {
    const p = perfOf();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = videoBox();
    canvas.style.left = box.left + 'px';
    canvas.style.top = box.top + 'px';
    canvas.style.width = box.width + 'px';
    canvas.style.height = box.height + 'px';
    canvas.style.right = 'auto';
    canvas.style.bottom = 'auto';
    let bw = Math.max(1, Math.round(box.width * dpr * p.scale));
    let bh = Math.max(1, Math.round(box.height * dpr * p.scale));
    const cap = Math.min(1, p.max / Math.max(bw, bh, 1));
    bw = Math.max(1, Math.round(bw * cap)); bh = Math.max(1, Math.round(bh * cap));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  }

  function cropFor() { return [1, 1, 0, 0]; }

  function draw() {
    const t = tick();
    const st = modeState();
    sizeBuffer();
    if (!gl || texBlocked) {
      $('fallbackNote').hidden = false;
      $('fallbackNote').textContent = 'This video can only use a lighter colour effect.';
      return;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.u_res, canvas.width, canvas.height);
    gl.uniform1f(u.u_int, intensity());
    if (st.brain) {
      video.style.opacity = '1';
      canvas.style.mixBlendMode = 'normal';
      const b = brainState();
      gl.uniform1f(u.u_brain, 1);
      gl.uniform1f(u.u_bType, b.type);
      gl.uniform1f(u.u_bAlpha, b.alpha);
      gl.uniform1f(u.u_bPhase, brainPhase);
      gl.uniform1f(u.u_bSpin, brainSpin);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      stats.draws++;
      return;
    }
    gl.uniform1f(u.u_brain, 0);
    if (video.readyState >= 2 && video.videoWidth > 0) {
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        hasFrame = true; stats.uploads++;
      } catch (e) {
        texBlocked = true;
        $('fallbackNote').hidden = false;
        $('fallbackNote').textContent = 'This link blocked a full effect. Try a video saved on this device.';
        return;
      }
    }
    if (!hasFrame) return;
    video.style.opacity = '0';
    const crop = cropFor();
    gl.uniform1f(u.u_time, t);
    gl.uniform1f(u.u_lt, lclock);
    gl.uniform1f(u.u_gl, glowGain());
    const vs = visionState();
    gl.uniform4f(u.u_vis, vs[0], vs[1], vs[2], vs[3]);
    gl.uniform1f(u.u_vh, vs[4]);
    gl.uniform1f(u.u_th, thickAmt(st));
    gl.uniform4f(u.u_crop, crop[0], crop[1], crop[2], crop[3]);
    gl.uniform1f(u.u_modeA, st.a);
    gl.uniform1f(u.u_modeB, st.b);
    gl.uniform1f(u.u_mix, st.mix);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    stats.draws++;
  }

  function schedule() {
    if (!running) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      rvfcId = video.requestVideoFrameCallback(() => { rvfcId = 0; onFrame(true); });
    } else {
      rafId = requestAnimationFrame(() => { rafId = 0; onFrame(false); });
    }
  }
  function cancel() {
    if (rvfcId && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(rvfcId);
    if (rafId) cancelAnimationFrame(rafId);
    rvfcId = 0; rafId = 0;
  }
  function onFrame(isNew) {
    if (!running) return;
    const now = performance.now();
    const brain = settings.mode === 'brain';
    const fps = brain ? Math.min(BRAIN_FPS, perfOf().fps) : perfOf().fps;
    const fresh = isNew || video.currentTime !== lastTime;
    if (fresh && now - lastDraw >= 1000 / fps - 2) {
      lastDraw = now; lastTime = video.currentTime;
      try { draw(); } catch (e) { stats.errors.push(String(e && e.message || e)); console.warn(e); }
    }
    schedule();
  }
  function startLoop() {
    if (running) return;
    running = true; lastNow = performance.now(); lastDraw = 0; schedule();
  }
  function stopLoop() { running = false; cancel(); }

  function fmt(t) {
    if (!isFinite(t)) return '0:00';
    const s = Math.max(0, Math.floor(t));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function syncUI() {
    for (const b of document.querySelectorAll('#modes button')) b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode));
    for (const b of document.querySelectorAll('#pace button')) b.setAttribute('aria-checked', String(b.dataset.pace === settings.pace));
    for (const b of document.querySelectorAll('#perf button')) b.setAttribute('aria-checked', String(b.dataset.perf === settings.perf));
    $('intensity').value = settings.intensity;
    $('speed').value = settings.speed;
    $('adapt').value = settings.adapt;
    $('adaptVal').textContent = settings.adapt + 's';
    $('adaptRow').hidden = settings.mode !== 'brain';
    $('brainHint').hidden = settings.mode !== 'brain';
    if (settings.mode === 'brain') { brainStart = performance.now(); }
  }
  function toast(text, ms) {
    const t = $('toast'); t.textContent = text; t.hidden = false;
    clearTimeout(toast.tid); toast.tid = setTimeout(() => { t.hidden = true; }, ms || 4000);
  }
  function homeMsg(text) { const m = $('homeMsg'); m.textContent = text || ''; m.hidden = !text; }

  function showStage() { $('home').hidden = true; stage.hidden = false; document.body.classList.add('playing'); }
  function showHome() {
    stopLoop();
    video.pause(); video.removeAttribute('src'); video.load();
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    hasFrame = false; texBlocked = false;
    $('home').hidden = false; stage.hidden = true; document.body.classList.remove('playing');
  }

  function load(src, title, isFile, fromGesture) {
    homeMsg('');
    $('fallbackNote').hidden = true;
    $('title').textContent = title || 'Video';
    hasFrame = false; texBlocked = false;
    if (!gl && !initGL() ) {
      $('fallbackNote').hidden = false;
      $('fallbackNote').textContent = 'This browser could not start the graphics effect.';
    }
    video.src = src;
    video.muted = false;
    showStage();
    const play = () => video.play().then(() => { $('bigPlay').hidden = true; startLoop(); }).catch(() => { $('bigPlay').hidden = false; });
    if (fromGesture) play();
    else video.addEventListener('loadeddata', () => play(), { once: true });
  }

  function updateTimes() {
    $('tCur').textContent = fmt(video.currentTime);
    $('tDur').textContent = fmt(video.duration);
    if (video.duration) $('seek').value = String(Math.round((video.currentTime / video.duration) * 1000));
  }

  $('file').addEventListener('change', () => {
    const f = $('file').files && $('file').files[0];
    if (!f) return;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(f);
    load(blobUrl, f.name, true, true);
    $('file').value = '';
  });
  $('urlForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = ($('url').value || '').trim();
    if (!url) return;
    load(url, url.split('/').pop() || 'Link', false, true);
  });
  $('demoBtn').addEventListener('click', () => load('demo.mp4', 'Demo clip', false, true));
  $('backBtn').addEventListener('click', showHome);
  $('playBtn').addEventListener('click', () => { if (video.paused) { video.play(); startLoop(); } else video.pause(); });
  $('bigPlay').addEventListener('click', () => { video.play(); $('bigPlay').hidden = true; startLoop(); });
  $('muteBtn').addEventListener('click', () => { video.muted = !video.muted; });
  $('seek').addEventListener('input', () => { if (video.duration) video.currentTime = (Number($('seek').value) / 1000) * video.duration; });
  video.addEventListener('timeupdate', updateTimes);
  video.addEventListener('play', startLoop);
  video.addEventListener('pause', stopLoop);
  video.addEventListener('ended', stopLoop);
  $('modes').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]'); if (!b) return;
    settings.mode = b.dataset.mode; save(); syncUI();
  });
  $('pace').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pace]'); if (!b) return;
    settings.pace = b.dataset.pace; save(); syncUI();
  });
  $('perf').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-perf]'); if (!b) return;
    settings.perf = b.dataset.perf; save(); syncUI(); sizeBuffer();
  });
  for (const id of ['intensity', 'speed', 'adapt']) {
    $(id).addEventListener('input', () => { settings[id] = Number($(id).value); save(); syncUI(); });
  }
  if ($('fsBtn') && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    $('fsBtn').hidden = false;
    $('fsBtn').addEventListener('click', () => {
      const el = stage;
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    });
  }
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) $('installTip').hidden = false;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  syncUI();
  window.__zigMorphPageV3 = {
    owner: ZIG_OWNER, version: '3.0.0',
    setMode(m) { if (m in MODES) { settings.mode = m; save(); syncUI(); } },
    startDemo() { load('demo.mp4', 'Demo clip', false, true); },
    stats: () => ({ ...stats, running, hasFrame, texBlocked, mode: settings.mode, draws: stats.draws, errors: stats.errors.slice(), brainHz, lightRate: Math.min(speedFactor(), LIGHT_CAP) })
  };
})();
