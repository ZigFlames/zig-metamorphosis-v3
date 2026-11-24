/*! Zig Metamorphosis v3.0.0 © 2026 ZigFlames (zigflames.com). All rights reserved. Unauthorized copying, redistribution, resale, or removal of this notice is prohibited. License ZIGMETA3-A41F-9C27-E6B8 · sig:ZS-B7E2C91F04A65D38 */
/* Zig Metamorphosis v3.0.0 bookmark effect. Runs on the current page. Nothing is uploaded. */
(() => {
  'use strict';
  const ZIG_OWNER = 'Zig Metamorphosis v3.0.0 © 2026 ZigFlames (zigflames.com). All rights reserved. Unauthorized copying, redistribution, resale, or removal of this notice is prohibited. License ZIGMETA3-A41F-9C27-E6B8 · sig:ZS-B7E2C91F04A65D38';
  if (window.__zigMorphV3) { window.__zigMorphV3.off(); return; }
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
  const MODES = {
    liquid: 0, dissolve: 1, refraction: 2, chroma: 3, cycle: 4, brain: 5,
    ripple: 6, kaleido: 7, smoke: 8, mirror: 9, shatter: 10, breathe: 11, vision: 12, thick: 13
  };
  const MODE_LIST = [
    ['cycle','Cycle'],['liquid','Liquid'],['dissolve','Dissolve'],['refraction','Refract'],
    ['chroma','Chroma'],['ripple','Ripple'],['kaleido','Kaleido'],['smoke','Smoke'],
    ['mirror','Mirror'],['shatter','Shatter'],['breathe','Breathe'],['vision','Zig Vision'],
    ['thick','Thick'],['brain','Brain Morph']
  ];
  const PACE = { slow: 0.5, normal: 1, fast: 2, turbo: 3.5 };
  const PACE_LIST = [['slow','Slow'],['normal','Normal'],['fast','Fast'],['turbo','Turbo']];
  const LIGHT_CAP = 3, BRAIN_MAX_HZ = 0.9, BRAIN_FPS = 15, MIN_W = 80, MIN_H = 60, MAX_SIDE = 960;
  const PERF = { fps: 24, scale: 0.7 };
  const KEY = '__zigMorphV3Mode', PKEY = '__zigMorphV3Pace';
  const UNIFORMS = ['u_tex','u_time','u_int','u_res','u_crop','u_modeA','u_modeB','u_mix','u_brain','u_bType','u_bAlpha','u_bPhase','u_bSpin','u_lt','u_gl','u_vis','u_vh','u_th'];
  const FILTER_ID = 'zigmeta3-bm-filter', TURB_ID = 'zigmeta3-bm-turb', DISP_ID = 'zigmeta3-bm-disp', HUE_ID = 'zigmeta3-bm-hue';

  let mode = 'cycle', paceName = 'normal';
  try { const m = localStorage.getItem(KEY); if (m && m in MODES) mode = m; const p = localStorage.getItem(PKEY); if (p && p in PACE) paceName = p; } catch (e) {}

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
    const now = performance.now(); if (!thickSince) thickSince = now;
    const u = Math.min(1, (now - thickSince) / 3000);
    return (0.08 + 0.10 * 0.6) * u * u * (3 - 2 * u);
  }
  const paceOf = () => PACE[paceName] || 1;
  const speedFactor = () => 1.06 * paceOf();
  const glowGain = () => Math.min(1, 2.5 / speedFactor());
  const intensity = () => 0.6;

  let clock = 0, lclock = 0, lastNow = performance.now(), brainHz = 0, alive = true;
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000), sf = speedFactor();
    clock += dt * sf; lclock += dt * Math.min(sf, LIGHT_CAP); lastNow = now; return clock;
  }
  const CYCLE = [0, 6, 1, 8, 2, 10, 3, 7, 11, 9];
  function cycleState() {
    const n = CYCLE.length, pos = lclock / 7, i = Math.floor(pos) % n, f = pos - Math.floor(pos);
    const blend = f < 0.6 ? 0 : (f - 0.6) / 0.4;
    return { a: CYCLE[i], b: CYCLE[(i + 1) % n], mix: blend * blend * (3 - 2 * blend) };
  }
  let brainStart = performance.now(), brainPhase = 0, brainSpin = 0, brainLast = performance.now();
  function brainState() {
    const now = performance.now(); const dt = Math.min(0.1, (now - brainLast) / 1000); brainLast = now;
    const spin = 0.05 * paceOf();
    const rate = Math.min(0.25 + 0.4, BRAIN_MAX_HZ - 4.8 * spin / (2 * Math.PI));
    brainHz = rate + 4.8 * spin / (2 * Math.PI);
    brainPhase = (brainPhase + dt * rate) % 1; brainSpin = (brainSpin + dt * spin) % (10 * Math.PI);
    const adapt = 25, FADE = 2, VIEW = 8, sA = adapt + FADE + VIEW;
    let x = ((now - brainStart) / 1000) % (sA * 2 + 22);
    const ease = (u) => u * u * (3 - 2 * u);
    const block = (type, t) => {
      let alpha; if (t < 1.5) alpha = ease(t / 1.5); else if (t < adapt) alpha = 1;
      else if (t < adapt + FADE) alpha = 1 - ease((t - adapt) / FADE); else alpha = 0;
      return { type, alpha };
    };
    if (x < sA) return block(0, x); x -= sA; if (x < sA) return block(1, x); x -= sA;
    const alpha = x < 4 ? ease(x / 4) : x < 14 ? 1 : x < 18 ? 1 - ease((x - 14) / 4) : 0;
    return { type: 2, alpha };
  }
  function modeState() {
    const m = MODES[mode] ?? 4;
    if (m === 4) return cycleState();
    if (m === 5) return { a: 0, b: 0, mix: 0, brain: true };
    return { a: m, b: m, mix: 0 };
  }

  let svgRoot = null; const filteredVideos = new Set();
  function ensureSvg() {
    if (svgRoot && svgRoot.isConnected) return svgRoot;
    const NS = 'http://www.w3.org/2000/svg';
    svgRoot = document.createElementNS(NS, 'svg');
    svgRoot.setAttribute('width', '0'); svgRoot.setAttribute('height', '0');
    svgRoot.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    svgRoot.innerHTML = `<defs><filter id="${FILTER_ID}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence id="${TURB_ID}" type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="3" result="noise"/><feDisplacementMap id="${DISP_ID}" in="SourceGraphic" in2="noise" scale="20" xChannelSelector="R" yChannelSelector="G"/><feColorMatrix id="${HUE_ID}" type="hueRotate" values="0"/></filter></defs>`;
    (document.body || document.documentElement).appendChild(svgRoot);
    return svgRoot;
  }
  function updateFallbackFilter(t) {
    ensureSvg();
    const k = intensity(), st = modeState();
    const turb = document.getElementById(TURB_ID), disp = document.getElementById(DISP_ID), hue = document.getElementById(HUE_ID);
    if (!turb || !disp || !hue) return;
    const P = [{fx:0.006,fy:0.014,scale:45,hue:0},{fx:0.05,fy:0.05,scale:30,hue:20},{fx:0.012,fy:0.012,scale:28,hue:0},{fx:0.004,fy:0.004,scale:10,hue:160},null,null,{fx:0.02,fy:0.02,scale:16,hue:0},{fx:0.01,fy:0.01,scale:22,hue:40},{fx:0.003,fy:0.012,scale:40,hue:0},{fx:0.002,fy:0.03,scale:26,hue:-15},{fx:0.03,fy:0.03,scale:20,hue:12},{fx:0.005,fy:0.005,scale:25,hue:0},{fx:0.004,fy:0.004,scale:0,hue:0},{fx:0.004,fy:0.004,scale:0,hue:0}];
    const A = P[st.a], B = P[st.b]; if (!A || !B) return;
    const L = (x,y)=>x+(y-x)*st.mix, wob = 1 + 0.35 * Math.sin(t * 0.7);
    turb.setAttribute('baseFrequency', `${(L(A.fx,B.fx)*wob).toFixed(5)} ${(L(A.fy,B.fy)*(2-wob)).toFixed(5)}`);
    disp.setAttribute('scale', (L(A.scale,B.scale)*k).toFixed(2));
    hue.setAttribute('values', (L(A.hue,B.hue)*k*Math.sin(t*0.3)).toFixed(1));
    for (const v of filteredVideos) v.style.setProperty('filter', `url(#${FILTER_ID})`, 'important');
  }

  const stats = { draws: 0, uploads: 0 };
  class Renderer {
    constructor(video) {
      this.video = video; this.mode = 'none'; this.canvas = null; this.gl = null; this.u = {};
      this.hasFrame = false; this.texBlocked = false; this.running = false; this.hidden = false; this.filtered = false;
      this.rvfcId = 0; this.rafId = 0; this.lastDraw = 0; this.lastTime = -1;
    }
    start() { if (this.mode === 'none' && !this.initGL()) this.mode = 'fallback'; this.update(); }
    shouldRun() {
      const v = this.video;
      return alive && !document.hidden && !v.paused && !v.ended && v.readyState >= 2;
    }
    update() {
      const want = this.shouldRun();
      if (want && !this.running) { this.running = true; lastNow = performance.now(); this.schedule(); }
      else if (!want && this.running) { this.running = false; this.cancel(); }
    }
    schedule() {
      if (!this.running) return;
      const v = this.video;
      if (typeof v.requestVideoFrameCallback === 'function') this.rvfcId = v.requestVideoFrameCallback(() => { this.rvfcId = 0; this.onFrame(true); });
      else this.rafId = requestAnimationFrame(() => { this.rafId = 0; this.onFrame(false); });
    }
    cancel() {
      const v = this.video;
      if (this.rvfcId && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this.rvfcId);
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rvfcId = 0; this.rafId = 0;
    }
    initGL() {
      const v = this.video, parent = v.parentNode; if (!parent) return false;
      const c = document.createElement('canvas');
      c.className = 'zig-metamorphosis-v3-canvas';
      c.style.cssText = 'position:absolute!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important;z-index:2147483645;display:none;left:0;top:0;';
      const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false }) || c.getContext('experimental-webgl');
      if (!gl) return false;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
      parent.insertBefore(c, v.nextSibling);
      this.canvas = c; this.gl = gl; this.prog = p; gl.useProgram(p);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      this.u = {}; for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(p, n);
      gl.uniform1i(this.u.u_tex, 0);
      this.mode = 'gl'; this.savedOpacity = v.style.getPropertyValue('opacity');
      return true;
    }
    onFrame(isNew) {
      if (!this.running) return;
      const now = performance.now(), v = this.video;
      const fps = mode === 'brain' ? BRAIN_FPS : PERF.fps;
      const fresh = isNew || v.currentTime !== this.lastTime;
      if (fresh && now - this.lastDraw >= 1000 / fps - 2) {
        this.lastDraw = now; this.lastTime = v.currentTime;
        this.draw(tick());
      }
      this.schedule();
    }
    layout() {
      const v = this.video, r = v.getBoundingClientRect(), cs = getComputedStyle(v);
      const vw = v.videoWidth || r.width, vh = v.videoHeight || r.height;
      let box = { left: r.left + v.clientLeft, top: r.top + v.clientTop, width: v.clientWidth || r.width, height: v.clientHeight || r.height };
      let crop = [1,1,0,0];
      if (vw && vh && box.width && box.height) {
        const ea = box.width / box.height, va = vw / vh, fit = cs.objectFit || 'contain';
        if (fit === 'contain' || fit === 'scale-down') {
          if (va > ea) { const h = box.width / va; box.top += (box.height - h) / 2; box.height = h; }
          else { const w = box.height * va; box.left += (box.width - w) / 2; box.width = w; }
        } else if (fit === 'cover') {
          if (va > ea) { const s = ea / va; crop = [s, 1, (1 - s) / 2, 0]; }
          else { const s = va / ea; crop = [1, s, 0, (1 - s) / 2]; }
        }
      }
      return { box, crop, visible: r.width > 1 && r.height > 1 };
    }
    place(box) {
      const c = this.canvas, op = c.offsetParent;
      let ox, oy;
      if (op && op !== document.body && op !== document.documentElement) {
        const pr = op.getBoundingClientRect();
        ox = pr.left + op.clientLeft - op.scrollLeft; oy = pr.top + op.clientTop - op.scrollTop;
      } else { ox = -window.scrollX; oy = -window.scrollY; }
      c.style.left = (box.left - ox).toFixed(2) + 'px';
      c.style.top = (box.top - oy).toFixed(2) + 'px';
      c.style.width = box.width.toFixed(2) + 'px';
      c.style.height = box.height.toFixed(2) + 'px';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let bw = Math.max(1, Math.round(box.width * dpr * PERF.scale));
      let bh = Math.max(1, Math.round(box.height * dpr * PERF.scale));
      const cap = Math.min(1, MAX_SIDE / Math.max(bw, bh, 1));
      bw = Math.max(1, Math.round(bw * cap)); bh = Math.max(1, Math.round(bh * cap));
      if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    }
    hideVideo(on) {
      const v = this.video;
      if (on && !this.hidden) { v.style.setProperty('opacity', '0', 'important'); this.hidden = true; }
      if (!on && this.hidden) {
        if (this.savedOpacity) v.style.setProperty('opacity', this.savedOpacity);
        else v.style.removeProperty('opacity');
        this.hidden = false;
      }
    }
    cssFilter(on) {
      const v = this.video;
      if (on && !this.filtered) { ensureSvg(); v.style.setProperty('filter', `url(#${FILTER_ID})`, 'important'); this.filtered = true; filteredVideos.add(v); }
      if (!on && this.filtered) { v.style.removeProperty('filter'); this.filtered = false; filteredVideos.delete(v); }
    }
    draw(t) {
      const v = this.video, st = modeState();
      if (this.mode === 'fallback' || this.texBlocked) {
        if (st.brain) this.cssFilter(false); else { this.cssFilter(true); updateFallbackFilter(t); }
        if (this.canvas) this.canvas.style.display = 'none';
        this.hideVideo(false); return;
      }
      if (this.mode !== 'gl' || !this.canvas) return;
      if (this.canvas.parentNode !== v.parentNode && v.parentNode) v.parentNode.insertBefore(this.canvas, v.nextSibling);
      const lay = this.layout();
      if (!lay.visible) { this.canvas.style.display = 'none'; return; }
      this.place(lay.box);
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.u.u_res, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.u.u_int, intensity());
      if (st.brain) {
        this.hideVideo(false); this.cssFilter(false);
        this.canvas.style.display = 'block';
        const b = brainState();
        gl.uniform1f(this.u.u_brain, 1); gl.uniform1f(this.u.u_bType, b.type);
        gl.uniform1f(this.u.u_bAlpha, b.alpha); gl.uniform1f(this.u.u_bPhase, brainPhase); gl.uniform1f(this.u.u_bSpin, brainSpin);
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6); stats.draws++; return;
      }
      gl.uniform1f(this.u.u_brain, 0);
      if (v.readyState >= 2 && v.videoWidth > 0) {
        try { gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); this.hasFrame = true; stats.uploads++; }
        catch (e) { this.texBlocked = true; this.hideVideo(false); ui.toast('Light mode: this site blocks the full effect.'); return; }
      }
      if (!this.hasFrame) { this.canvas.style.display = 'none'; return; }
      this.canvas.style.display = 'block'; this.hideVideo(true);
      const vs = visionState();
      gl.uniform1f(this.u.u_time, t); gl.uniform1f(this.u.u_lt, lclock); gl.uniform1f(this.u.u_gl, glowGain());
      gl.uniform4f(this.u.u_vis, vs[0], vs[1], vs[2], vs[3]); gl.uniform1f(this.u.u_vh, vs[4]); gl.uniform1f(this.u.u_th, thickAmt(st));
      gl.uniform4f(this.u.u_crop, lay.crop[0], lay.crop[1], lay.crop[2], lay.crop[3]);
      gl.uniform1f(this.u.u_modeA, st.a); gl.uniform1f(this.u.u_modeB, st.b); gl.uniform1f(this.u.u_mix, st.mix);
      gl.drawArrays(gl.TRIANGLES, 0, 6); stats.draws++;
    }
    destroy() {
      this.running = false; this.cancel(); this.hideVideo(false); this.cssFilter(false);
      if (this.canvas) this.canvas.remove();
      this.mode = 'none';
    }
  }

  let active = null, scanTimer = 0;
  function pickTarget() {
    let best = null, bestScore = 0;
    const vh = window.innerHeight, vw = window.innerWidth;
    for (const v of document.querySelectorAll('video')) {
      if (!v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (r.width < MIN_W || r.height < MIN_H) continue;
      const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      let score = visW * visH; if (!score) continue;
      if (!v.paused && !v.ended) score *= 4;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
  }
  function scan() {
    if (!alive) return;
    const target = pickTarget();
    if (active && (!target || target !== active.video || !active.video.isConnected)) { active.destroy(); active = null; }
    if (!active && target) { active = new Renderer(target); active.start(); }
    if (active) active.update();
  }
  function scheduleScan(delay) { if (!scanTimer) scanTimer = setTimeout(() => { scanTimer = 0; scan(); }, delay || 500); }

  const ui = (() => {
    const host = document.createElement('div');
    host.id = 'zig-morph-v3-ui';
    host.style.cssText = 'all:initial;position:fixed;top:20%;right:10px;z-index:2147483646;font:13px/1.35 -apple-system,sans-serif;color:#fff;';
    const fab = document.createElement('button');
    fab.textContent = 'Z';
    fab.style.cssText = 'width:42px;height:42px;border:0;border-radius:50%;background:linear-gradient(135deg,#b45cff,#2fd6ff);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);';
    const panel = document.createElement('div');
    panel.style.cssText = 'display:none;margin-top:8px;width:210px;background:#141025;border:1px solid #2c2748;border-radius:12px;padding:10px;max-height:70vh;overflow:auto;';
    const modes = document.createElement('div');
    MODE_LIST.forEach(([id, label]) => {
      const b = document.createElement('button'); b.textContent = label; b.dataset.mode = id;
      b.style.cssText = 'display:block;width:100%;margin:0 0 4px;padding:6px 8px;border:0;border-radius:8px;background:#0b0a12;color:#ece9ff;text-align:left;cursor:pointer;';
      b.onclick = () => setMode(id);
      modes.appendChild(b);
    });
    const paces = document.createElement('div'); paces.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:8px 0;';
    PACE_LIST.forEach(([id, label]) => {
      const b = document.createElement('button'); b.textContent = label; b.dataset.pace = id;
      b.style.cssText = 'padding:5px 0;border:0;border-radius:7px;background:#0b0a12;color:#ece9ff;cursor:pointer;';
      b.onclick = () => setPace(id);
      paces.appendChild(b);
    });
    const off = document.createElement('button'); off.textContent = 'Off ✕';
    off.style.cssText = 'width:100%;padding:8px;border:0;border-radius:8px;background:#3a2248;color:#fff;cursor:pointer;font-weight:650;';
    off.onclick = () => offAll();
    const status = document.createElement('div'); status.style.cssText = 'margin:6px 0 0;color:#9a93c2;font-size:11px;';
    const toastEl = document.createElement('div'); toastEl.style.cssText = 'display:none;margin-top:6px;color:#ffd39a;font-size:11px;';
    panel.append(modes, paces, off, status, toastEl);
    host.append(fab, panel);
    (document.body || document.documentElement).appendChild(host);
    let open = false;
    fab.onclick = () => { open = !open; panel.style.display = open ? 'block' : 'none'; paint(); };
    function paint() {
      [...modes.children].forEach((b) => { b.style.background = b.dataset.mode === mode ? 'linear-gradient(90deg,#b45cff,#2fd6ff)' : '#0b0a12'; });
      [...paces.children].forEach((b) => { b.style.background = b.dataset.pace === paceName ? 'linear-gradient(90deg,#b45cff,#2fd6ff)' : '#0b0a12'; });
      status.textContent = active ? (active.texBlocked ? 'Light mode (site blocked full effect)' : 'Morphing the video') : 'Start a video and it will join in.';
    }
    return {
      paint,
      toast(msg) { toastEl.textContent = msg; toastEl.style.display = 'block'; setTimeout(() => { toastEl.style.display = 'none'; }, 5000); },
      remove() { host.remove(); }
    };
  })();

  function setMode(m) {
    if (!(m in MODES)) return;
    mode = m; try { localStorage.setItem(KEY, m); } catch (e) {}
    if (m === 'brain') brainStart = performance.now();
    ui.paint();
  }
  function setPace(p) {
    if (!(p in PACE)) return;
    paceName = p; try { localStorage.setItem(PKEY, p); } catch (e) {}
    ui.paint();
  }

  const mo = new MutationObserver(() => scheduleScan(400));
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('play', onPlay, true);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', onVis, { passive: true });
  function onPlay() { if (alive) scheduleScan(80); }
  function onVis() { if (active) active.update(); }
  scan();
  ui.paint();
  ui.toast('Zig Morph v3 is on. Start a video and it will join in.');

  function offAll() {
    if (!alive) return;
    alive = false;
    mo.disconnect();
    document.removeEventListener('play', onPlay, true);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onVis);
    if (active) { active.destroy(); active = null; }
    if (svgRoot) svgRoot.remove();
    ui.remove();
    try { delete window.__zigMorphV3; } catch (e) { window.__zigMorphV3 = undefined; }
  }

  window.__zigMorphV3 = {
    version: 3, owner: ZIG_OWNER,
    off: offAll, setMode, setPace,
    state: () => ({ alive, mode, pace: paceName, running: !!(active && active.running), draws: stats.draws, uploads: stats.uploads, fallback: !!(active && active.texBlocked), target: active ? (active.video.currentSrc || '').slice(0, 80) : null, brainHz })
  };
})();
