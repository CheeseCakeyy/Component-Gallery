export const quadVertex = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * .5 + .5;
  gl_Position = vec4(a_position, 0., 1.);
}`;

export const backgroundFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_imageSize;
uniform vec2 u_pointer;
uniform float u_time;
uniform vec3 u_ripple;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  float imageAspect = u_imageSize.x / u_imageSize.y;
  vec2 cover = vec2(min(1., aspect / imageAspect), min(1., imageAspect / aspect));
  vec2 wave = vec2(sin(uv.y * 13. + u_time * .38), cos(uv.x * 11. + u_time * .31));
  uv += wave * .0019 + (u_pointer - .5) * .014;
  vec2 delta = (v_uv - u_ripple.xy) * vec2(aspect, 1.);
  float distance = length(delta);
  float age = u_time - u_ripple.z;
  float ring = sin(distance * 66. - age * 9.) * exp(-pow((distance - age * .27) * 10., 2.));
  uv += normalize(delta + .0001) * ring * .0045 * exp(-age * 1.4) * step(0., age);
  uv = (uv - .5) * cover * .957 + .5;
  vec3 color = texture(u_image, uv).rgb;
  float shafts = pow(.5 + .5 * sin(v_uv.x * 12. + v_uv.y * 8. + sin(v_uv.y * 5. - u_time * .15)), 7.);
  color += vec3(.09, .047, .014) * shafts * (.5 + .5 * sin(u_time * .24)) * smoothstep(.1, 1., v_uv.y);
  float vignette = smoothstep(.8, .16, length((v_uv - .51) * vec2(.75, .9)));
  color *= .83 + .17 * vignette;
  outColor = vec4(color, 1.);
}`;

export const copyFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
void main() { outColor = texture(u_image, v_uv); }
`;

export const puppyVertex = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_size;
uniform float u_tilt;
uniform float u_squash;
void main() {
  v_uv = a_position * .5 + .5;
  vec2 p = a_position * u_size * .5;
  p *= vec2(1. + u_squash * .35, 1. - u_squash * .28);
  float s = sin(u_tilt), c = cos(u_tilt);
  p = mat2(c, s, -s, c) * p;
  gl_Position = vec4((p + u_center) / u_resolution * 2. - 1., 0., 1.);
}`;

export const puppyFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_puppy;
uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform vec2 u_gaze;
uniform float u_time;
uniform float u_energy;
uniform float u_blink;

void main() {
  vec2 uv = v_uv;
  // Independent, gentle deformations keep the glass body soft and buoyant.
  float ears = smoothstep(.75, .92, uv.y);
  uv.x += sin(uv.y * 12. + u_time * 2.4) * (.0015 + u_energy * .003) * ears;
  uv.y += sin(uv.x * 11. + u_time * 3.) * .003 * ears;
  float head = exp(-dot((uv - vec2(.51, .64)) * vec2(2.5, 4.), (uv - vec2(.51, .64)) * vec2(2.5, 4.)));
  uv -= u_gaze * .021 * head;
  vec4 ice = texture(u_puppy, uv);
  if (ice.a < .008) discard;
  // Reconstruct each eye locally during a blink instead of folding the UVs.
  // UV folding would pull in a second dark edge and create visible ghost lines.
  if (u_blink > .001) {
    vec2 eyeCenter = uv.x < .51 ? vec2(.379, .64) : vec2(.653, .643);
    vec2 eyeDelta = uv - eyeCenter;
    float eyeMask = 1. - smoothstep(.030, .041, length(eyeDelta * vec2(1., 1.45)));
    vec3 frost = texture(u_puppy, vec2(uv.x, eyeCenter.y + .052)).rgb;
    float lid = 1. - smoothstep(.88, 1.10, length(eyeDelta / vec2(.0245, .0175 * (1. - u_blink * .91))));
    vec3 chocolate = vec3(.17, .065, .024) + vec3(.10, .062, .022) * smoothstep(-.02, .025, eyeDelta.y);
    vec3 blinkingEye = mix(frost, chocolate, lid);
    ice.rgb = mix(ice.rgb, blinkingEye, eyeMask * smoothstep(0., .15, u_blink));
  }
  vec2 texel = vec2(.00185, .00138);
  vec2 edge = vec2(texture(u_puppy, uv + vec2(texel.x, 0.)).a - texture(u_puppy, uv - vec2(texel.x, 0.)).a,
                   texture(u_puppy, uv + vec2(0., texel.y)).a - texture(u_puppy, uv - vec2(0., texel.y)).a);
  vec2 screen = gl_FragCoord.xy / u_resolution;
  vec2 refractedUv = screen + edge * .024 + (uv - .5) * .014;
  vec3 behind = texture(u_scene, refractedUv).rgb;
  float luminous = smoothstep(.42, .95, dot(ice.rgb, vec3(.2126, .7152, .0722)));
  vec3 color = mix(ice.rgb, behind, .075 * luminous);
  float caustic = pow(.5 + .5 * sin(uv.x * 17. + uv.y * 13. + u_time * .65), 10.);
  color += vec3(.045, .029, .012) * caustic * luminous;
  color += vec3(1., .77, .37) * max(0., dot(edge, normalize(vec2(-1., 1.)))) * .17;
  outColor = vec4(color, ice.a);
}`;

export const bubbleVertex = `#version 300 es
precision highp float;
in vec4 a_bubble;
in float a_opacity;
uniform vec2 u_resolution;
uniform float u_dpr;
out float v_opacity;
void main() {
  gl_Position = vec4(a_bubble.xy / u_resolution * 2. - 1., 0., 1.);
  gl_PointSize = a_bubble.z * u_dpr;
  v_opacity = a_opacity;
}`;

export const bubbleFragment = `#version 300 es
precision highp float;
in float v_opacity;
out vec4 outColor;
uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform float u_dpr;
void main() {
  vec2 p = gl_PointCoord * 2. - 1.;
  float r = length(p);
  if (r > 1.) discard;
  float z = sqrt(max(0., 1. - r * r));
  vec3 normal = vec3(p.x, -p.y, z);
  float light = pow(max(0., dot(normal, normalize(vec3(-.5, .65, .6)))), 18.);
  float rim = pow(r, 5.) * .48;
  float outline = smoothstep(.67, .89, r) * (1. - smoothstep(.92, 1., r));
  vec3 refracted = texture(u_scene, gl_FragCoord.xy / (u_resolution * u_dpr) + p * .004 * z).rgb;
  vec3 color = mix(refracted * .78, vec3(1., .83, .46), rim + light * .7);
  color += light * .7 + outline * .12;
  float alpha = (.1 + rim + light * .75 + outline * .22) * v_opacity * (1. - smoothstep(.93, 1., r));
  outColor = vec4(color, alpha);
}`;
