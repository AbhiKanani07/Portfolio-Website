const POINTS_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aRand;
layout(location = 1) in float aIdx;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;
uniform float uN;
uniform float uFreq;
uniform float uAmp;
uniform float uMorph;
uniform int uFrom;
uniform int uTo;
uniform vec2 uMouse;
uniform vec2 uMouseVel;
uniform float uMouseOn;
uniform float uPulse;
uniform float uSize;
uniform float uDpr;
uniform float uAspect;
uniform vec2 uShift;
uniform float uIntro;
uniform float uDisp;

out vec3 vColor;
out float vAlpha;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const vec3 CYAN = vec3(0.0, 0.941, 1.0);
const vec3 COBALT = vec3(0.18, 0.357, 1.0);
const vec3 SPECTRAL = vec3(0.945, 0.961, 1.0);

vec3 sphereShape(float i, vec4 r) {
  float y = 1.0 - 2.0 * (i + 0.5) / uN;
  float rad = sqrt(max(0.0, 1.0 - y * y));
  float phi = i * 2.39996323;
  vec3 p = vec3(cos(phi) * rad, y, sin(phi) * rad);
  float shell = r.z < 0.84 ? 1.0 + (r.y - 0.5) * 0.035 : pow(r.y, 0.45) * 0.9;
  return p * shell;
}

vec3 torusShape(vec4 r) {
  float u = r.x * TAU + uTime * 0.32 * (0.6 + r.w);
  float v = r.y * TAU;
  float R = 0.96;
  float rr = 0.32 * (0.85 + 0.3 * r.z);
  vec3 p = vec3((R + rr * cos(v)) * cos(u), rr * sin(v), (R + rr * cos(v)) * sin(u));
  float c = cos(0.95);
  float s = sin(0.95);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

vec3 matrixShape(vec4 r) {
  float pillar = floor(r.x * 27.0);
  float band = floor(r.y * 3.0);
  float ang = (pillar + 0.5) / 27.0 * TAU;
  float R = 1.0 + (r.z - 0.5) * 0.05;
  float y = -0.79 + band * 0.56 + fract(r.y * 3.0) * 0.46;
  vec3 tang = vec3(-sin(ang), 0.0, cos(ang));
  return vec3(cos(ang) * R, y, sin(ang) * R) + tang * (r.w - 0.5) * 0.08;
}

vec3 clustersShape(vec4 r) {
  float k = floor(r.x * 6.0);
  float a = k * 1.0471976 + 0.4;
  float e = mod(k, 2.0) < 1.0 ? 0.4 : -0.4;
  vec3 c = vec3(cos(a) * 0.76, e * (0.62 + 0.2 * sin(k * 2.1)), sin(a) * 0.76);
  float g1 = sqrt(-2.0 * log(max(r.y, 1e-4))) * cos(TAU * r.z);
  float g2 = sqrt(-2.0 * log(max(r.z, 1e-4))) * sin(TAU * r.w);
  float g3 = sqrt(-2.0 * log(max(r.w, 1e-4))) * cos(TAU * r.y);
  return c + vec3(g1, g2, g3) * 0.11;
}

vec3 helixShape(vec4 r) {
  float t = r.x;
  float y = (t - 0.5) * 2.1;
  float R = 0.5;
  float spin = uTime * 0.25;
  if (r.y < 0.88) {
    float strand = r.y < 0.44 ? 0.0 : 1.0;
    float a = t * TAU * 2.4 + spin + strand * PI;
    return vec3(cos(a) * R, y, sin(a) * R) + (r.zwz - 0.5) * 0.05;
  }
  float stp = floor(t * 24.0) / 24.0 + 0.5 / 24.0;
  float aa = stp * TAU * 2.4 + spin;
  float f = r.z * 2.0 - 1.0;
  return vec3(cos(aa) * R * f, (stp - 0.5) * 2.1, sin(aa) * R * f);
}

vec3 pipelinesShape(vec4 r) {
  if (r.x < 0.62) {
    float k = floor(r.y * 5.0);
    float t = fract(r.z + uTime * (0.08 + 0.05 * r.w));
    float conv = 1.0 - smoothstep(0.0, 1.0, t) * 0.78;
    float a = fract(r.x * 37.0) * TAU;
    return vec3(-1.05 + t * 1.75, (k - 2.0) * 0.3 * conv + sin(t * TAU + k * 1.7) * 0.025 + cos(a) * 0.03, (k - 2.0) * 0.14 * conv + sin(a) * 0.03);
  }
  float id = floor(r.y * 100.0);
  return vec3(0.86 + (r.z - 0.5) * 0.04, (floor(id / 10.0) - 4.5) * 0.125 + (r.w - 0.5) * 0.03, (mod(id, 10.0) - 4.5) * 0.125 + (fract(r.x * 53.0) - 0.5) * 0.03);
}

vec3 passShape(vec4 r) {
  float W = 0.62;
  float H = 0.86;
  if (r.x < 0.3) {
    float t = r.y * 4.0;
    vec2 p = t < 1.0 ? vec2(mix(-W, W, t), H) : t < 2.0 ? vec2(W, mix(H, -H, t - 1.0)) : t < 3.0 ? vec2(mix(W, -W, t - 2.0), -H) : vec2(-W, mix(-H, H, t - 3.0));
    vec2 c = clamp(p, vec2(-W + 0.09, -H + 0.09), vec2(W - 0.09, H - 0.09));
    vec2 d = p - c;
    float l = length(d);
    p = l > 0.0 ? c + d / l * 0.09 : p;
    return vec3(p, (r.z - 0.5) * 0.02);
  }
  if (r.x < 0.58) {
    float x = mix(-W + 0.05, W - 0.05, r.y);
    return vec3(x, mix(H - 0.2, H - 0.62, r.z) + sin(x * 7.0 + uTime * 0.8) * 0.035 * r.w, 0.0);
  }
  float m = floor(r.y * 225.0);
  float mx = mod(m, 15.0);
  float my = floor(m / 15.0);
  bool finder = (mx < 4.0 && my < 4.0) || (mx > 10.0 && my < 4.0) || (mx < 4.0 && my > 10.0);
  float bit = fract(sin(m * 12.9898 + 4.1) * 43758.5453);
  if (r.x < 0.86 && (finder || bit > 0.48)) {
    return vec3(vec2((mx - 7.0) * 0.03, -H + 0.3 + (7.0 - my) * 0.03) + (r.zw - 0.5) * 0.022, 0.0);
  }
  float line = floor(r.z * 3.0);
  float len = line < 0.5 ? 0.9 : (line < 1.5 ? 0.6 : 0.75);
  return vec3(mix(-W + 0.08, -W + 0.08 + (2.0 * W - 0.16) * len, r.w), 0.1 - line * 0.11, 0.0);
}

const vec3 C_POS[8] = vec3[8](vec3(0.0, -0.7, 0.0), vec3(-0.45, -0.38, 0.25), vec3(0.4, -0.38, -0.2), vec3(-0.45, 0.04, 0.25), vec3(0.45, 0.12, -0.25), vec3(0.45, 0.55, -0.25), vec3(-0.1, -0.02, -0.45), vec3(0.0, 0.85, 0.35));
const vec3 C_HALF[8] = vec3[8](vec3(0.85, 0.08, 0.65), vec3(0.22), vec3(0.22), vec3(0.18), vec3(0.2), vec3(0.16, 0.2, 0.16), vec3(0.15), vec3(0.12));
vec3 voxelsShape(vec4 r) {
  int k = int(floor(r.x * 8.0));
  float f = floor(r.y * 6.0);
  vec2 uv = vec2(r.z, r.w) * 2.0 - 1.0;
  if (fract(r.y * 6.0) < 0.35) uv = abs(uv.x) > abs(uv.y) ? vec2(sign(uv.x), uv.y) : vec2(uv.x, sign(uv.y));
  vec3 p = f < 1.0 ? vec3(1.0, uv) : f < 2.0 ? vec3(-1.0, uv) : f < 3.0 ? vec3(uv.x, 1.0, uv.y) : f < 4.0 ? vec3(uv.x, -1.0, uv.y) : f < 5.0 ? vec3(uv, 1.0) : vec3(uv, -1.0);
  return C_POS[k] + p * C_HALF[k];
}

vec3 shapeOf(int s, float i, vec4 r) {
  if (s == 7) return voxelsShape(r);
  if (s == 5) return pipelinesShape(r);
  if (s == 6) return passShape(r);
  if (s == 1) return torusShape(r);
  if (s == 2) return matrixShape(r);
  if (s == 3) return clustersShape(r);
  if (s == 4) return helixShape(r);
  return sphereShape(i, r);
}

vec3 tintOf(int s, vec4 r) {
  if (s == 7) { float k = floor(r.x * 8.0); return k < 0.5 ? COBALT : (mod(k, 2.0) < 1.0 ? CYAN : SPECTRAL * 0.85); }
  if (s == 5) return r.x < 0.62 ? mix(CYAN, SPECTRAL, 0.1 + 0.2 * floor(r.y * 5.0) / 4.0) : (fract(r.y * 61.8) > 0.86 ? SPECTRAL : COBALT);
  if (s == 6) return r.x < 0.3 ? SPECTRAL * 0.9 : (r.x < 0.58 ? mix(COBALT, CYAN, r.y) : (r.x < 0.86 ? SPECTRAL : COBALT));
  if (s == 2) { float b = floor(r.y * 3.0); return b < 0.5 ? CYAN : (b < 1.5 ? COBALT : SPECTRAL * 0.82); }
  if (s == 3) return mix(COBALT, CYAN, floor(r.x * 6.0) / 5.0);
  if (s == 4) return r.y < 0.44 ? CYAN : (r.y < 0.88 ? COBALT : SPECTRAL * 0.8);
  if (s == 1) return mix(COBALT, CYAN, 0.5 + 0.5 * sin(r.x * TAU * 3.0));
  return mix(COBALT, CYAN, r.z);
}

void main() {
  float d = aRand.w * 0.42;
  float t = clamp((uMorph - d) / 0.58, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(shapeOf(uFrom, aIdx, aRand), shapeOf(uTo, aIdx, aRand), t);
  vec3 dirc = normalize(p + vec3(1e-4));
  p += dirc * sin(t * PI) * 0.22 * (0.4 + aRand.z);

  float ti = clamp((uIntro - aRand.w * 0.5) / 0.5, 0.0, 1.0);
  ti = 1.0 - pow(1.0 - ti, 3.0);
  p = mix((aRand.xyz - 0.5) * 7.0, p, ti);

  float phase = aRand.x * TAU + p.y * 2.6;
  p += dirc * sin(uTime * uFreq * TAU + phase) * uAmp * (0.55 + 0.45 * aRand.y);
  p += dirc * uPulse * 0.09 * (0.3 + aRand.z);

  vec4 view = uView * uModel * vec4(p, 1.0);
  vec4 clip = uProj * view;

  vec2 ndc = clip.xy / clip.w + uShift;
  vec2 dd = ndc - uMouse;
  dd.x *= uAspect;
  float dist = length(dd);
  float fall = exp(-dist * dist / 0.045) * uMouseOn;
  float spd = min(length(uMouseVel), 4.0);
  vec2 dir = dist > 1e-4 ? dd / dist : vec2(0.0);
  vec2 push = (dir * (0.03 + 0.06 * spd) + vec2(-dir.y, dir.x) * 0.035 * spd) * fall;
  push.x /= uAspect;
  ndc += push;
  clip.xy = ndc * clip.w;
  gl_Position = clip;

  vec3 n = normalize(mat3(uView * uModel) * dirc);
  float rim = pow(1.0 - abs(n.z), 1.5);
  vec3 tint = mix(tintOf(uFrom, aRand), tintOf(uTo, aRand), t);
  vec3 col = mix(tint * 0.55, tint, rim);
  vec3 irid = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + rim * 0.85 + uTime * 0.04 + uDisp * 0.6));
  col = mix(col, irid * vec3(0.55, 0.85, 1.0), 0.2 * rim + 0.18 * uDisp);
  col = mix(col, SPECTRAL, smoothstep(0.72, 1.0, rim) * 0.55 + fall * 0.45 + uPulse * 0.25);

  float depth = -view.z;
  vColor = col;
  vAlpha = clamp(1.3 - (depth - 3.2) * 0.42, 0.18, 1.0) * (0.5 + 0.5 * aRand.z) * (0.35 + 0.65 * ti);
  gl_PointSize = clamp(uSize * uDpr * (0.8 + rim * 0.7 + fall * 1.6 + uPulse * 0.4) * (3.8 / depth), 1.0, 28.0 * uDpr);
}`;
const POINTS_FRAG = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
uniform float uGain;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float a = (exp(-r2 * 22.0) + exp(-r2 * 7.0) * 0.35) * vAlpha * uGain;
  outColor = vec4(vColor * a, a);
}`;
const FULL_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uDisp;
uniform float uScan;
uniform float uGlitch;
uniform vec2 uCenter;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  float bandY = 1.0 - fract(uTime * 0.045);
  float band = exp(-pow((uv.y - bandY) * 28.0, 2.0));
  uv.x += band * uGlitch * 0.006 * sin(uTime * 37.0 + uv.y * 420.0);

  vec2 ca = (uv - uCenter) * (0.006 + uDisp * 0.022);
  vec3 col = vec3(texture(uScene, uv + ca).r, texture(uScene, uv).g, texture(uScene, uv - ca).b);

  vec2 px = 1.0 / uRes;
  vec3 glow = vec3(0.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398;
    glow += texture(uScene, uv + vec2(cos(a), sin(a)) * px * 7.0).rgb;
  }
  col += glow * 0.07;

  float s = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.5708);
  col *= 1.0 - uScan * (0.22 * (1.0 - s) + band * 0.25);
  col += band * uGlitch * 0.02 * vec3(0.0, 0.94, 1.0);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.012;

  outColor = vec4(vec3(0.0196, 0.0196, 0.0275) + col, 1.0);
}`;
export {
  COMPOSITE_FRAG,
  FULL_VERT,
  POINTS_FRAG,
  POINTS_VERT
};
