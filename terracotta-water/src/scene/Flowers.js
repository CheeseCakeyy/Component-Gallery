import * as THREE from 'three';

const vertexShader = /* glsl */`
varying vec2 vUv;
varying vec2 vWorld;
void main() {
  vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Shading derives from the cutout's own alpha, so any replacement asset gets the
// same wet edges, warm key light and glints without per-asset tuning.
const petalShader = /* glsl */`
uniform sampler2D uMap;
uniform vec2 uTilt;
uniform vec2 uDip;
uniform float uGlint;
uniform float uTime;
uniform float uAspect;
varying vec2 vUv;
varying vec2 vWorld;
float softAlpha(vec2 uv, float lod) { return textureLod(uMap, uv, lod).a; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// A fine warped web, scaled to match the caustics photographed in the pool bed.
float causticNet(vec2 q, float t) {
  q += vec2(sin(q.y * .63 + t * .55), cos(q.x * .57 - t * .47)) * 1.1;
  float a = abs(sin(q.x + sin(q.y * 1.3 + t * .4)));
  float b = abs(sin(q.y * 1.1 + sin(q.x * 1.2 - t * .35)));
  return pow(1.0 - min(a, b), 9.0);
}
void main() {
  // Blurred alpha approximates distance to the outline: petal edges sit in water,
  // and one side of each bloom is tipped under the surface, more so as it rocks.
  float rim = 1.0 - smoothstep(.55, .99, softAlpha(vUv, 5.6));
  vec2 local = vUv - .5;
  float submerged = clamp(rim * .6 + smoothstep(-.06, .38, dot(local, uDip)) * .85
    + dot(local, uTilt) * 2.5, 0.0, 1.0);
  // The water pattern is evaluated in scene space so it lines up with the pool.
  vec2 p = (vWorld + vec2(uAspect * .5, .5)) * 150.0;
  vec2 wobble = vec2(sin(p.y * .21 + uTime * 1.3), cos(p.x * .17 - uTime * 1.1)) * .006 * submerged * (1.0 - rim);
  vec4 tex = texture2D(uMap, vUv + wobble);
  if (tex.a < .02) discard;
  vec2 e = vec2(.03, 0);
  vec2 dome = vec2(softAlpha(vUv + e.xy, 5.0) - softAlpha(vUv - e.xy, 5.0),
                   softAlpha(vUv + e.yx, 5.0) - softAlpha(vUv - e.yx, 5.0));
  vec3 normal = normalize(vec3(-dome * 1.6 + uTilt * 1.4, 1.0));
  vec3 light = normalize(vec3(-.55, .62, .75));
  float diffuse = dot(normal, light);
  vec3 color = tex.rgb;
  // Low golden sun: warm the whole bloom, deepen the side turned away from it.
  color *= vec3(1.0, .885, .70);
  color *= .72 + .40 * diffuse;
  // Broad falloff across the bloom, as the low sun grazes it from the upper left.
  color *= mix(1.08, .80, smoothstep(.15, .95, dot(vUv - .5, vec2(.7, -.7)) + .5));
  // Wet edges darken and pick up the amber of the water beneath them.
  color = mix(color, color * vec3(.70, .56, .42) + vec3(.03, .015, .005), rim * .4);
  // Under the film the bloom takes the water's amber and its moving caustic net.
  color = mix(color, color * vec3(.70, .55, .40), submerged * .55);
  float caustic = causticNet(p, uTime);
  color += vec3(.62, .36, .11) * caustic * submerged * .6;
  float spec = pow(max(dot(normal, normalize(light + vec3(0, 0, 1))), 0.0), 60.0);
  float lum = dot(tex.rgb, vec3(.2126, .7152, .0722));
  color += vec3(1.0, .82, .55) * spec * (.10 + .30 * uGlint) * smoothstep(.25, .8, lum);
  // Sparse water beads catch the sun and twinkle as the flower rocks.
  vec2 cell = floor(vUv * 24.0);
  vec2 jitter = vec2(hash(cell + 7.1), hash(cell + 3.3)) * .5 + .25;
  float bead = step(.86, hash(cell)) * smoothstep(.13, .02, length(fract(vUv * 24.0) - jitter));
  float twinkle = .35 + .65 * pow(max(0.0, dot(normal, light)), 4.0) + uGlint;
  color += vec3(1.0, .9, .72) * bead * twinkle * .55 * (1.0 - rim) * smoothstep(.3, .9, tex.a);
  gl_FragColor = vec4(color, tex.a * mix(1.0, .82, rim * rim) * (1.0 - submerged * .1));
  #include <colorspace_fragment>
}`;

// Premultiplied output: a soft warm-black shadow on the stones under the water,
// plus a thin bright meniscus where surface tension bends light around petals.
const shadowShader = /* glsl */`
uniform sampler2D uMap;
uniform vec2 uOffset;
uniform float uLift;
varying vec2 vUv;
vec2 toFlower(vec2 uv) { return (uv - .5) * 1.3 + .5; }
float alphaAt(vec2 uv, float lod) {
  vec2 inside = step(vec2(0), uv) * step(uv, vec2(1));
  return textureLod(uMap, clamp(uv, 0.0, 1.0), lod).a * inside.x * inside.y;
}
void main() {
  vec2 uv = toFlower(vUv);
  float spread = 5.4 + uLift * .7;
  float shade = alphaAt(uv + uOffset * (1.0 + uLift * .35), spread) * (.95 - uLift * .15);
  float halo = max(0.0, alphaAt(uv, 5.0) - alphaAt(uv, 0.0) * 1.5);
  shade *= 1.0 - smoothstep(.0, .5, alphaAt(uv - uOffset * .6, 4.5));
  float a = clamp(shade, 0.0, .78);
  vec3 premultiplied = vec3(.02, .01, .004) * a + vec3(.40, .27, .12) * halo * .1;
  gl_FragColor = vec4(premultiplied, a);
  #include <colorspace_fragment>
}`;

function hashPhase(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296 * Math.PI * 2;
}

function dipDirection(id) {
  const angle = hashPhase(`${id}:dip`);
  return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
}

/** Transparent assets are independent meshes. Asset changes never change physics. */
export async function createFlowers(scene, definitions, loader, mapper, simulation) {
  const items = await Promise.all(definitions.map(async definition => {
    if (!definition.asset || !Array.isArray(definition.uv) || definition.uv.length !== 2
      || definition.uv.some(n => !Number.isFinite(n) || n < 0 || n > 1)
      || !(definition.scale > 0) || !Number.isFinite(definition.rotation)) {
      throw new Error('Flower requires asset, uv:[0..1,0..1], positive scale, and rotation in radians.');
    }
    const texture = await loader.texture(definition.asset);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    const aspect = texture.image.width / texture.image.height;
    const geometry = new THREE.PlaneGeometry(definition.scale * aspect, definition.scale);
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader: petalShader,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uMap: { value: texture }, uTilt: { value: new THREE.Vector2() }, uGlint: { value: 0 },
        uDip: { value: dipDirection(definition.id) }, uTime: { value: 0 }, uAspect: { value: mapper.aspect } } });
    const mesh = new THREE.Mesh(geometry, material);
    // The shadow quad is oversized so the blurred, offset silhouette and the
    // bright meniscus halo can spill past the petal outline.
    const shadowGeometry = new THREE.PlaneGeometry(definition.scale * aspect * 1.3, definition.scale * 1.3);
    const shadowMaterial = new THREE.ShaderMaterial({ vertexShader, fragmentShader: shadowShader,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uMap: { value: texture }, uOffset: { value: new THREE.Vector2(-.10, .13) },
        uLift: { value: 0 } } });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    mesh.renderOrder = 3; shadow.renderOrder = 2;
    scene.add(shadow, mesh);
    return { definition, mesh, shadow, geometry, shadowGeometry, material, shadowMaterial,
      phase: hashPhase(definition.id),
      x: 0, y: 0, vx: 0, vy: 0, bob: 0, vbob: 0,
      tiltX: 0, tiltY: 0, yaw: 0, angularX: 0, angularY: 0, angularZ: 0, wave: {}, point: {} };
  }));
  let elapsed = 0;
  return {
    update(dt) {
      elapsed += dt;
      const damping = Math.exp(-3.8 * dt);
      for (const f of items) {
        const [u, v] = f.definition.uv;
        simulation.sample(u + f.x / mapper.aspect, v - f.y, f.wave);
        const targetX = THREE.MathUtils.clamp(f.wave.dy * .36, -.24, .24);
        const targetY = THREE.MathUtils.clamp(f.wave.dx * .36, -.24, .24);
        f.angularX = (f.angularX + (targetX - f.tiltX) * 22 * dt) * damping;
        f.angularY = (f.angularY + (targetY - f.tiltY) * 22 * dt) * damping;
        f.tiltX += f.angularX * dt; f.tiltY += f.angularY * dt;
        const targetYaw = THREE.MathUtils.clamp((f.wave.dx-f.wave.dy)*.30, -.14, .14);
        f.angularZ = (f.angularZ + (targetYaw-f.yaw)*18*dt)*damping;
        f.yaw += f.angularZ*dt;
        f.vbob = (f.vbob + (f.wave.height * .65 - f.bob) * 42 * dt) * damping;
        f.bob += f.vbob * dt;
        f.vx = (f.vx + (-f.wave.dx * .008 - f.x * 7) * dt) * damping;
        f.vy = (f.vy + (f.wave.dy * .008 + f.wave.velocity * .002 - f.y * 7) * dt) * damping;
        const nextX = THREE.MathUtils.clamp(f.x + f.vx * dt, -.006, .006);
        const nextY = THREE.MathUtils.clamp(f.y + f.vy * dt, -.006, .006);
        if (simulation.sampleMask(u + nextX / mapper.aspect, v - nextY) > .8) {
          f.x = nextX; f.y = nextY;
        } else { f.vx = 0; f.vy = 0; }
        mapper.uvToWorld(u, v, f.point);
        f.mesh.position.set(f.point.x + f.x, f.point.y + f.y + f.bob, .05);
        // A slow idle sway keeps resting flowers alive between ripples.
        const sway = Math.sin(elapsed * .37 + f.phase) * Math.sin(elapsed * .23 + f.phase * 1.7) * .018;
        f.mesh.rotation.set(f.tiltX, f.tiltY, f.definition.rotation + f.yaw + sway);
        f.shadow.position.set(f.point.x + f.x, f.point.y + f.y, .025);
        f.shadow.rotation.z = f.definition.rotation + f.yaw + sway;
        f.material.uniforms.uTilt.value.set(f.tiltY, -f.tiltX);
        f.material.uniforms.uTime.value = simulation.time ?? elapsed;
        f.material.uniforms.uGlint.value = THREE.MathUtils.clamp(Math.abs(f.vbob) * 40, 0, 1);
        // Lifting on a crest spreads and lightens the shadow on the stone bed below.
        f.shadowMaterial.uniforms.uLift.value = THREE.MathUtils.clamp(f.bob * 12, -1, 1);
      }
    },
    dispose() {
      for (const f of items) {
        scene.remove(f.mesh, f.shadow);
        f.geometry.dispose(); f.shadowGeometry.dispose(); f.material.dispose(); f.shadowMaterial.dispose();
      }
    },
  };
}

