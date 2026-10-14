// Rounded solid ice, traced and lit in its own moving / rotating object space.
export const iceFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform vec2 u_size;
uniform float u_tilt;
uniform float u_time;
uniform float u_seed;
uniform float u_contact;

float iceDistance(vec3 p) {
  vec3 q = abs(p) - vec3(.61, .59, .42);
  float d = length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - .15;
  return d + .012 * sin(p.x * 10. + u_seed) * sin(p.y * 8. - u_seed) * sin(p.z * 9.);
}
float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7))) * 43758.5453); }
void main() {
  float yaw = .29 + .16 * sin(u_seed + u_time * .11);
  float pitch = -.26 + .10 * cos(u_seed * 2. + u_time * .13);
  mat3 turnY = mat3(cos(yaw),0.,sin(yaw), 0.,1.,0., -sin(yaw),0.,cos(yaw));
  mat3 turnX = mat3(1.,0.,0., 0.,cos(pitch),-sin(pitch), 0.,sin(pitch),cos(pitch));
  mat3 rotation = turnX * turnY;
  vec3 origin = rotation * vec3((v_uv * 2. - 1.) * 1.4, 3.);
  vec3 ray = rotation * vec3(0.,0.,-1.);
  float travel = 0.;
  vec3 p;
  bool hit = false;
  for (int i = 0; i < 42; i++) {
    p = origin + ray * travel;
    float d = iceDistance(p);
    if (d < .0016) { hit = true; break; }
    travel += d;
    if (travel > 5.) break;
  }
  if (!hit) discard;
  vec2 e = vec2(.0025,0.);
  vec3 normal = normalize(vec3(iceDistance(p+e.xyy)-iceDistance(p-e.xyy), iceDistance(p+e.yxy)-iceDistance(p-e.yxy), iceDistance(p+e.yyx)-iceDistance(p-e.yyx)));
  vec3 n = transpose(rotation) * normal;
  float c = cos(u_tilt), s = sin(u_tilt);
  n.xy = mat2(c,s,-s,c) * n.xy;
  vec2 screen = gl_FragCoord.xy / u_resolution;
  float fresnel = pow(1. - max(0., n.z), 3.);
  vec2 offset = n.xy * u_size / u_resolution * (.10 + fresnel * .07);
  offset += vec2(sin(p.y * 8. + u_seed), cos(p.x * 9.)) * .003;
  vec3 transmitted;
  transmitted.r = texture(u_scene, clamp(screen - offset * 1.025, .001, .999)).r;
  transmitted.g = texture(u_scene, clamp(screen - offset, .001, .999)).g;
  transmitted.b = texture(u_scene, clamp(screen - offset * .975, .001, .999)).b;
  // Wide studio reflections and a fine bright bevel, with no opaque white fill.
  vec3 reflected = reflect(vec3(0.,0.,-1.), n);
  float softbox = exp(-pow((reflected.x + .43) * 4., 2.) - pow((reflected.y - .68) * 2.6, 2.));
  float strip = exp(-pow((reflected.x - .65) * 18., 2.)) * smoothstep(-.5,.8,reflected.y);
  float bevel = pow(1. - n.z, 2.);
  vec3 color = transmitted * (.90 - fresnel * .22);
  color = mix(color, vec3(1.,.84,.50), fresnel * .40);
  color += vec3(1.,.94,.76) * (softbox * .72 + strip * .45 + bevel * .12);
  // A few tiny trapped air bubbles, fixed to each cube as it turns.
  vec3 cell = floor(p * 19.);
  vec3 local = fract(p * 19.) - .5;
  float bubble = (1. - smoothstep(.055,.095,abs(length(local.xy)-.16))) * step(.88,hash(cell + u_seed));
  color += vec3(1.,.87,.61) * bubble * .16;
  float crease = pow(.5 + .5 * sin(p.x * 14. + sin(p.y * 9.) * 2. + u_seed), 30.);
  color += vec3(.04,.032,.015) * crease;
  color += vec3(.055,.038,.012) * u_contact * fresnel;
  float edge = smoothstep(.015,.12,n.z);
  outColor = vec4(color, .92 * edge);
}`;
