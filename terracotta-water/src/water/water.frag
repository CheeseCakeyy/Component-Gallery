uniform sampler2D uImage;
uniform sampler2D uMask;
uniform sampler2D uHeight;
uniform vec2 uResolution;
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;

float field(vec2 uv) {
  // Simulation data is row-major TOP LEFT; image textures use bottom-left UVs.
  vec2 q = clamp(vec2(uv.x, 1.0-uv.y), 0.0, 1.0) * (uResolution-1.0);
  vec2 cell = floor(q), f = fract(q);
  vec2 a = (cell+0.5)/uResolution;
  vec2 d = 1.0/uResolution;
  return mix(mix(texture2D(uHeight,a).r, texture2D(uHeight,a+vec2(d.x,0)).r,f.x),
             mix(texture2D(uHeight,a+vec2(0,d.y)).r, texture2D(uHeight,a+d).r,f.x),f.y);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float heightAt(vec2 uv) {
  vec2 p = uv * vec2(uAspect,1.0);
  return field(uv) + .0008*sin(p.x*43.0+p.y*28.0+uTime*.65)
    + .00055*sin(p.x*31.0-p.y*47.0-uTime*.48);
}
void main() {
  float wet = smoothstep(.45,.95,texture2D(uMask,vUv).r);
  if(wet < .001) discard;
  vec2 texel = 1.0 / uResolution;
  vec2 slope = vec2(heightAt(vUv+vec2(texel.x,0))-heightAt(vUv-vec2(texel.x,0)),
                    heightAt(vUv+vec2(0,texel.y))-heightAt(vUv-vec2(0,texel.y))) / (2.0*texel*vec2(uAspect,1));
  vec2 offset = clamp(slope*.009,vec2(-.012),vec2(.012))/vec2(uAspect,1);
  vec2 refracted = clamp(vUv+offset*wet,vec2(.001),vec2(.999));
  // Prevent refraction from pulling stones or baked flowers into moving water.
  float safe = smoothstep(.7,.98,texture2D(uMask,refracted).r);
  refracted = mix(vUv,refracted,safe);
  vec3 color = texture2D(uImage,refracted).rgb;
  vec3 normal = normalize(vec3(-slope*.22,1.0));
  vec3 light = normalize(vec3(-.25,.36,1.0));
  float specular = pow(max(dot(normal,normalize(light+vec3(0,0,1))),0.0),180.0);
  vec2 p = vUv*vec2(uAspect,1.0)*56.0 + slope*2.8;
  float caustic = pow(1.0-abs(sin(p.x+sin(p.y+uTime*.19))*sin(p.y-sin(p.x-uTime*.13))),22.0);
  float gate = smoothstep(.015,.16,dot(color,vec3(.2126,.7152,.0722)));
  color += vec3(.16,.064,.011)*caustic*gate*.32;
  color += vec3(.055,.045,.027)*specular;
  // Reflected light follows the actual wavefront, even in dark water.
  vec2 waveSlope = vec2(field(vUv+vec2(texel.x,0))-field(vUv-vec2(texel.x,0)),
    field(vUv+vec2(0,texel.y))-field(vUv-vec2(0,texel.y)))/(2.0*texel*vec2(uAspect,1));
  float facing = dot(waveSlope,normalize(vec2(-.6,.8)));
  color += vec3(.24,.17,.075)*min(.75,max(0.0,facing))*.65;
  color *= 1.0-min(.28,max(0.0,-facing)*.16);
  // Sun glitter: sparse points twinkle on already lit water and jump with the slope.
  vec2 gp = vUv*vec2(uAspect,1.0)*240.0 + slope*5.0;
  vec2 gc = floor(gp);
  float h = hash(gc);
  vec2 jitter = vec2(hash(gc+1.3),hash(gc+2.7))*.6+.2;
  float twinkle = pow(.5+.5*sin(uTime*(1.6+h*4.0)+h*60.0),10.0);
  float glint = step(.92,h)*twinkle*smoothstep(.16,.0,length(fract(gp)-jitter));
  float lit = smoothstep(.06,.3,dot(color,vec3(.2126,.7152,.0722)));
  color += vec3(1.0,.86,.62)*glint*lit*(1.1+max(0.0,facing)*2.0);
  gl_FragColor=vec4(color,wet);
  #include <colorspace_fragment>
}
