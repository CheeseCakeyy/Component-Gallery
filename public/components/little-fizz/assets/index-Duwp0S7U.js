(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const c of r.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&i(c)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const q=`#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * .5 + .5;
  gl_Position = vec4(a_position, 0., 1.);
}`,W=`#version 300 es
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
}`,H=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
void main() { outColor = texture(u_image, v_uv); }
`,k=`#version 300 es
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
}`,$=`#version 300 es
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
}`,Q=`#version 300 es
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
}`,j=`#version 300 es
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
}`,K=`#version 300 es
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
}`,L=(o,e,t)=>Math.max(e,Math.min(t,o));class J{constructor(e,t){this.contacts=0,this.resize(e,t)}resize(e,t){const i=this.width||e,s=this.height||t;this.width=e,this.height=t;const r=e<600,c=r?Math.min(e*.61,t*.35):Math.min(t*.52,e*.36,440),n=[[.12,.72,1.08,-.3],[.37,.87,.82,.23],[.87,.76,1.1,.39],[.88,.26,.91,-.23],[.46,.17,.7,.48],[.12,.3,.88,.18]];this.bodies||(this.bodies=n.slice(0,r?5:6).map(([a,l,f,h],d)=>({x:a*e,y:l*t,vx:0,vy:0,angle:h,omega:0,scale:f,seed:d*1.83+.7,front:d===2||d===4,size:c*f,contact:0})));for(const a of this.bodies)a.x*=e/i,a.y*=t/s,a.vx*=e/i,a.vy*=t/s,a.size=c*a.scale,this.constrain(a)}constrain(e){const t=e.size*.4,i=Math.min(t,this.width/2),s=this.width-i,r=Math.min(t,this.height/2),c=this.height-r;e.x<i&&(e.x=i,e.vx=Math.max(0,e.vx)*.3),e.x>s&&(e.x=s,e.vx=Math.min(0,e.vx)*.3),e.y<r&&(e.y=r,e.vy=Math.max(0,e.vy)*.3),e.y>c&&(e.y=c,e.vy=Math.min(0,e.vy)*.3)}puppyContact(e,t,i){const s=Math.cos(e.angle),r=Math.sin(e.angle),c=t.x-e.x,n=t.y-e.y,a=s*c+r*n,l=-r*c+s*n,f=e.size*.065,h=e.size*.235,d=L(a,-h,h),y=L(l,-h,h);let m=a-d,p=l-y,x=Math.hypot(m,p),_=t.r+f-x;if(_<=0)return;x<1e-4?h-Math.abs(a)<h-Math.abs(l)?(m=a>=0?1:-1,p=0,_+=h-Math.abs(a)):(m=0,p=l>=0?1:-1,_+=h-Math.abs(l)):(m/=x,p/=x);const T=-(s*m-r*p),E=-(r*m+s*p);e.x+=T*_*.86,e.y+=E*_*.86;const M=(e.vx-i.x)*T+(e.vy-i.y)*E;if(M<0){const P=Math.min(420,-M*1.18);e.vx+=T*P,e.vy+=E*P;const Y=s*d-r*y,V=r*d+s*y;e.omega+=(Y*E-V*T)*P/(e.size*e.size*.14)}e.contact=1,this.contacts++}pairContact(e,t){const i=[e.angle,e.angle+Math.PI/2,t.angle,t.angle+Math.PI/2],s=t.x-e.x,r=t.y-e.y;let c=1/0,n=0,a=0;for(const m of i){const p=Math.cos(m),x=Math.sin(m),_=M=>M.size*.275*(Math.abs(Math.cos(m-M.angle))+Math.abs(Math.sin(m-M.angle))),T=s*p+r*x,E=_(e)+_(t)-Math.abs(T);if(E<=0)return;E<c&&(c=E,n=p*(T>=0?1:-1),a=x*(T>=0?1:-1))}const l=e.size*e.size,f=t.size*t.size,h=f/(l+f),d=1-h;e.x-=n*c*h*.7,e.y-=a*c*h*.7,t.x+=n*c*d*.7,t.y+=a*c*d*.7;const y=(t.vx-e.vx)*n+(t.vy-e.vy)*a;if(y<0){const m=-y*1.25;e.vx-=n*m*h,e.vy-=a*m*h,t.vx+=n*m*d,t.vy+=a*m*d;const p=(t.vx-e.vx)*-a+(t.vy-e.vy)*n;e.omega+=p*.06/e.size,t.omega-=p*.06/t.size}}step(e,t,i){const s=Math.max(1,Math.ceil(e/.008333333333333333)),r=e/s;for(let c=0;c<s;c++){for(const n of this.bodies){const a=Math.exp(-r*.72);n.vx=(n.vx+Math.sin(t*.47+n.seed)*3*r)*a,n.vy=(n.vy+Math.cos(t*.61+n.seed)*4*r)*a,n.omega=L((n.omega+Math.sin(t*.4+n.seed)*.013*r)*Math.exp(-r*1.4),-1.8,1.8),n.x+=n.vx*r,n.y+=n.vy*r,n.angle+=n.omega*r,n.contact*=Math.exp(-r*4)}for(let n=0;n<3;n++)for(let a=0;a<this.bodies.length;a++){const l=this.bodies[a];for(let f=a+1;f<this.bodies.length;f++)this.pairContact(l,this.bodies[f]);if(i){const f=(c+1)/s,h=i.x-i.vx*e*(1-f),d=i.y-i.vy*e*(1-f),y=Math.cos(i.angle),m=Math.sin(i.angle);for(const[p,x]of[[.2,.4],[-.15,.36]])this.puppyContact(l,{x:h-m*i.height*p,y:d+y*i.height*p,r:i.width*x},{x:i.vx,y:i.vy})}this.constrain(l)}}}}const b=(o,e,t)=>Math.max(e,Math.min(t,o)),F=(o,e,t,i)=>o+(e-o)*(1-Math.exp(-t*i));function N(o){return new Promise((e,t)=>{const i=new Image;i.onload=()=>e(i),i.onerror=()=>t(new Error(`Could not load ${o}`)),i.src=o})}class Z{constructor(e,{onError:t=console.error,reducedMotion:i=!1}={}){if(this.canvas=e,this.onError=t,this.gl=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1}),!this.gl)throw new Error("WebGL2 is unavailable");this.reducedMotion=i,this.paused=i,this.pointer={x:.58,y:.53,active:!1},this.dog={x:.58,y:.53,vx:0,vy:0,tilt:0},this.gaze=[0,0],this.time=0,this.energy=0,this.boost=0,this.ripple=[.5,.5,-100],this.bubbles=[],this.resources=[],this.running=!1,this.disposed=!1,this.contextLost=!1,this.lastTime=0,this.frameCount=0,this.needsDraw=!0,this.onLost=s=>{s.preventDefault(),this.contextLost=!0,cancelAnimationFrame(this.raf)},this.onRestored=()=>{if(!this.disposed)try{this.resources=[],this.setup(),this.contextLost=!1,this.resize(!0),this.lastTime=0,this.raf=requestAnimationFrame(this.frame)}catch(s){this.onError(s)}},this.onVisibility=()=>{this.lastTime=0,document.hidden?cancelAnimationFrame(this.raf):this.running&&!this.contextLost&&(this.raf=requestAnimationFrame(this.frame))},e.addEventListener("webglcontextlost",this.onLost),e.addEventListener("webglcontextrestored",this.onRestored),document.addEventListener("visibilitychange",this.onVisibility),this.frame=this.frame.bind(this)}async init(){if([this.backgroundImage,this.puppyImage]=await Promise.all([N("./assets/cola-liquid.webp"),N("./assets/puppy.webp")]),!this.disposed){this.setup(),this.resize(!0);for(let e=0;e<175;e++)this.bubbles.push(this.newBubble(!0));this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(this.canvas),this.running=!0,this.raf=requestAnimationFrame(this.frame)}}program(e,t){const i=this.gl,s=(l,f)=>{const h=i.createShader(l);if(i.shaderSource(h,f),i.compileShader(h),!i.getShaderParameter(h,i.COMPILE_STATUS)){const d=i.getShaderInfoLog(h);throw i.deleteShader(h),new Error(d)}return h},r=s(i.VERTEX_SHADER,e),c=s(i.FRAGMENT_SHADER,t),n=i.createProgram();if(i.attachShader(n,r),i.attachShader(n,c),i.linkProgram(n),i.deleteShader(r),i.deleteShader(c),!i.getProgramParameter(n,i.LINK_STATUS))throw new Error(i.getProgramInfoLog(n));this.resources.push(["Program",n]);const a={};for(let l=0;l<i.getProgramParameter(n,i.ACTIVE_UNIFORMS);l++){const f=i.getActiveUniform(n,l);a[f.name]=i.getUniformLocation(n,f.name)}return{id:n,uniforms:a}}texture(e){const t=this.gl,i=t.createTexture();return this.resources.push(["Texture",i]),t.bindTexture(t.TEXTURE_2D,i),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),e&&(t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!0),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e)),i}setup(){const e=this.gl;this.backgroundProgram=this.program(q,W),this.copyProgram=this.program(q,H),this.puppyProgram=this.program(k,$),this.bubbleProgram=this.program(Q,j),this.iceProgram=this.program(k,K),this.quad=e.createBuffer(),this.resources.push(["Buffer",this.quad]),e.bindBuffer(e.ARRAY_BUFFER,this.quad),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),e.STATIC_DRAW),this.particleBuffer=e.createBuffer(),this.resources.push(["Buffer",this.particleBuffer]),this.particleData=new Float32Array(720*5),this.backgroundTexture=this.texture(this.backgroundImage),this.puppyTexture=this.texture(this.puppyImage),this.sceneTexture=this.texture(),this.framebuffer=e.createFramebuffer(),this.resources.push(["Framebuffer",this.framebuffer]),e.bindFramebuffer(e.FRAMEBUFFER,this.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.sceneTexture,0),this.compositeTexture=this.texture(),this.compositeFramebuffer=e.createFramebuffer(),this.resources.push(["Framebuffer",this.compositeFramebuffer]),e.bindFramebuffer(e.FRAMEBUFFER,this.compositeFramebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.compositeTexture,0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.disable(e.DEPTH_TEST),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA)}resize(e=!1){if(this.contextLost||this.disposed)return;const t=this.canvas.getBoundingClientRect();this.width=Math.max(1,t.width),this.needsDraw=!0,this.height=Math.max(1,t.height),this.dpr=Math.min(devicePixelRatio||1,1.75,Math.sqrt(34e5/(this.width*this.height)));const i=Math.round(this.width*this.dpr),s=Math.round(this.height*this.dpr);if(this.mobile=this.width<600,this.home={x:this.mobile?.53:.6,y:this.mobile?.6:.54},this.dogHeight=this.mobile?Math.min(this.height*.42,this.width*.9):Math.min(this.height*.59,this.width*.4,610),this.dogWidth=this.dogHeight*this.puppyImage.width/this.puppyImage.height,e||this.canvas.width!==i||this.canvas.height!==s){this.canvas.width=i,this.canvas.height=s;const r=this.gl;if(r.bindTexture(r.TEXTURE_2D,this.sceneTexture),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,i,s,0,r.RGBA,r.UNSIGNED_BYTE,null),r.bindFramebuffer(r.FRAMEBUFFER,this.framebuffer),r.checkFramebufferStatus(r.FRAMEBUFFER)!==r.FRAMEBUFFER_COMPLETE)throw new Error("Could not create the refraction buffer");if(r.bindTexture(r.TEXTURE_2D,this.compositeTexture),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,i,s,0,r.RGBA,r.UNSIGNED_BYTE,null),r.bindFramebuffer(r.FRAMEBUFFER,this.compositeFramebuffer),r.checkFramebufferStatus(r.FRAMEBUFFER)!==r.FRAMEBUFFER_COMPLETE)throw new Error("Could not create the ice refraction buffer");r.bindFramebuffer(r.FRAMEBUFFER,null)}this.pointer.active||(this.pointer.x=this.home.x,this.pointer.y=this.home.y,this.dog.x=this.home.x,this.dog.y=this.home.y),this.iceWorld?this.iceWorld.resize(this.width,this.height):this.iceWorld=new J(this.width,this.height)}newBubble(e=!1,t,i,s=!1){const r=Math.random()>.78;return{x:t??Math.random(),y:i??(e?Math.random()*1.1:-.03),vx:s?(Math.random()-.5)*.22:(Math.random()-.5)*.009,vy:s?.03+Math.random()*.09:.012+Math.random()*.045,size:r?5+Math.random()*10:1.5+Math.random()*5,opacity:.25+Math.random()*.65,phase:Math.random()*Math.PI*2,near:r,burst:s,life:0}}move(e,t){this.pointer={x:b(e,0,1),y:b(t,0,1),active:!0}}leave(){this.pointer.active=!1}reset(){this.pointer.active=!1,this.pointer.x=this.home.x,this.pointer.y=this.home.y,this.energy=0,this.paused&&(Object.assign(this.dog,this.home,{vx:0,vy:0,tilt:0}),this.gaze=[0,0],this.needsDraw=!0)}setPaused(e){this.paused=e,this.needsDraw=!0}boop(e=this.dog.x,t=this.dog.y){if(!this.paused){this.energy=1,this.dog.vy+=.17,this.ripple=[e,t,this.time];for(let i=0;i<35&&this.bubbles.length<700;i++)this.bubbles.push(this.newBubble(!1,e+(Math.random()-.5)*.07,t,!0))}}moreFizz(){if(!this.paused){this.boost=1,this.energy=.75;for(let e=0;e<150&&this.bubbles.length<700;e++)this.bubbles.push(this.newBubble(!1,Math.random(),-.05-Math.random()*.4,!0))}}update(e){this.time+=e,this.energy=F(this.energy,0,2.2,e),this.boost=F(this.boost,0,.35,e);const t=this.dog,i=this.dogWidth*.56/this.width,s=this.dogHeight*.53/this.height;let r=this.home.x,c=this.home.y;this.pointer.active?(r=b(this.pointer.x,i+.025,1-i-.025),c=b(this.pointer.y,s+.08,1-s-.09)):(r+=Math.sin(this.time*.45)*.022,c+=Math.sin(this.time*.73)*.014),t.vx+=((r-t.x)*15-t.vx*6.5)*e,t.vy+=((c-t.y)*15-t.vy*6.5)*e,t.x+=t.vx*e,t.y+=t.vy*e,t.x=b(t.x,i,1-i),t.y=b(t.y,s+.045,1-s-.04),t.tilt=F(t.tilt,b(-t.vx*.65,-.2,.2)+Math.sin(this.time*.9)*.025+Math.sin(this.time*12)*this.energy*.1,5,e),this.gaze[0]=F(this.gaze[0],this.pointer.active?b((this.pointer.x-t.x)*5,-1,1):Math.sin(this.time*.5)*.12,5,e),this.gaze[1]=F(this.gaze[1],this.pointer.active?b((this.pointer.y-t.y)*5,-1,1):0,5,e),this.iceWorld.step(e,this.time,{x:t.x*this.width,y:t.y*this.height,vx:t.vx*this.width,vy:t.vy*this.height,width:this.dogWidth,height:this.dogHeight,angle:t.tilt});for(let n=this.bubbles.length-1;n>=0;n--){const a=this.bubbles[n];a.life+=e,a.y+=a.vy*e*(1+this.boost*1.5),a.x+=(a.vx+Math.sin(this.time*1.3+a.phase)*.006)*e,a.vx*=Math.exp(-e*.4),(a.y>1.08||a.x<-.08||a.x>1.08||a.burst&&a.life>14)&&(a.burst?this.bubbles.splice(n,1):Object.assign(a,this.newBubble()))}}bindTexture(e,t){const i=this.gl;i.activeTexture(i.TEXTURE0+t),i.bindTexture(i.TEXTURE_2D,e)}useQuad(e){const t=this.gl;t.useProgram(e.id),t.bindBuffer(t.ARRAY_BUFFER,this.quad);const i=t.getAttribLocation(e.id,"a_position");return t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0),e.uniforms}drawBubbles(e){const t=this.gl,i=this.bubbleProgram;let s=0;for(const n of this.bubbles){if(n.near!==e)continue;const a=s++*5;this.particleData[a]=n.x*this.width,this.particleData[a+1]=n.y*this.height,this.particleData[a+2]=n.size,this.particleData[a+3]=0,this.particleData[a+4]=n.opacity*(n.burst?Math.min(1,n.life*3)*Math.min(1,(14-n.life)/2):1)}if(!s)return;t.useProgram(i.id),t.bindBuffer(t.ARRAY_BUFFER,this.particleBuffer),t.bufferData(t.ARRAY_BUFFER,this.particleData.subarray(0,s*5),t.DYNAMIC_DRAW);const r=t.getAttribLocation(i.id,"a_bubble"),c=t.getAttribLocation(i.id,"a_opacity");t.enableVertexAttribArray(r),t.vertexAttribPointer(r,4,t.FLOAT,!1,20,0),t.enableVertexAttribArray(c),t.vertexAttribPointer(c,1,t.FLOAT,!1,20,16),t.uniform2f(i.uniforms.u_resolution,this.width,this.height),t.uniform1f(i.uniforms.u_dpr,this.dpr),this.bindTexture(this.sceneTexture,0),t.uniform1i(i.uniforms.u_scene,0),t.drawArrays(t.POINTS,0,s),t.disableVertexAttribArray(r),t.disableVertexAttribArray(c)}draw(){const e=this.gl,t=this.canvas.width,i=this.canvas.height;e.viewport(0,0,t,i),e.disable(e.BLEND),e.bindFramebuffer(e.FRAMEBUFFER,this.framebuffer);let s=this.useQuad(this.backgroundProgram);this.bindTexture(this.backgroundTexture,0),e.uniform1i(s.u_image,0),e.uniform2f(s.u_resolution,t,i),e.uniform2f(s.u_imageSize,this.backgroundImage.width,this.backgroundImage.height),e.uniform2f(s.u_pointer,this.dog.x,this.dog.y),e.uniform1f(s.u_time,this.time),e.uniform3fv(s.u_ripple,this.ripple),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,this.compositeFramebuffer),s=this.useQuad(this.copyProgram),this.bindTexture(this.sceneTexture,0),e.uniform1i(s.u_image,0),e.drawArrays(e.TRIANGLES,0,6),e.enable(e.BLEND),this.drawBubbles(!1),this.drawIce(!1,this.sceneTexture),s=this.useQuad(this.puppyProgram),this.bindTexture(this.puppyTexture,0),this.bindTexture(this.sceneTexture,1),e.uniform1i(s.u_puppy,0),e.uniform1i(s.u_scene,1),e.uniform2f(s.u_resolution,t,i),e.uniform2f(s.u_center,this.dog.x*t,this.dog.y*i),e.uniform2f(s.u_size,this.dogWidth*this.dpr,this.dogHeight*this.dpr),e.uniform1f(s.u_tilt,this.dog.tilt),e.uniform1f(s.u_squash,Math.sin(this.time*2)*.014+Math.sin(this.time*14)*this.energy*.07),e.uniform2fv(s.u_gaze,this.gaze),e.uniform1f(s.u_time,this.time),e.uniform1f(s.u_energy,this.energy);const r=this.time%5.7;e.uniform1f(s.u_blink,r>5.35?Math.pow(Math.sin((r-5.35)/.35*Math.PI),2):0),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,null),e.disable(e.BLEND),s=this.useQuad(this.copyProgram),this.bindTexture(this.compositeTexture,0),e.uniform1i(s.u_image,0),e.drawArrays(e.TRIANGLES,0,6),e.enable(e.BLEND),this.drawIce(!0,this.compositeTexture),this.drawBubbles(!0),e.disable(e.BLEND)}drawIce(e,t){const i=this.gl,s=this.useQuad(this.iceProgram);this.bindTexture(t,0),i.uniform1i(s.u_scene,0),i.uniform2f(s.u_resolution,this.canvas.width,this.canvas.height),i.uniform1f(s.u_time,this.time),i.uniform1f(s.u_squash,0);for(const r of this.iceWorld.bodies)r.front===e&&(i.uniform2f(s.u_center,r.x*this.dpr,r.y*this.dpr),i.uniform2f(s.u_size,r.size*this.dpr,r.size*this.dpr),i.uniform1f(s.u_tilt,r.angle),i.uniform1f(s.u_seed,r.seed),i.uniform1f(s.u_contact,r.contact),i.drawArrays(i.TRIANGLES,0,6))}frame(e){if(!this.running||this.disposed||this.contextLost)return;const t=this.lastTime?Math.min((e-this.lastTime)/1e3,.033):1/60;this.lastTime=e,this.paused||this.update(t),(!this.paused||this.needsDraw)&&(this.draw(),this.needsDraw=!1),this.frameCount++,this.raf=requestAnimationFrame(this.frame)}dispose(){this.disposed=!0,this.running=!1,cancelAnimationFrame(this.raf),this.observer?.disconnect(),this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),document.removeEventListener("visibilitychange",this.onVisibility);for(const[e,t]of this.resources)this.gl[`delete${e}`](t);this.resources=[]}}const g=document.querySelector("#experience"),ee=document.querySelector("#scene"),D=document.querySelector("#cursor"),S=document.querySelector("#pause"),B=document.querySelector("#sound"),te=document.querySelector("#announcement"),G=matchMedia("(prefers-reduced-motion: reduce)"),ie=new AbortController,v=(o,e,t,i={})=>o.addEventListener(e,t,{...i,signal:ie.signal});let u,C=!1,A=null,X;class se{enabled=!1;async toggle(){if(!this.context){const e=window.AudioContext||window.webkitAudioContext;if(!e)return!1;this.context=new e;const t=this.context;this.master=t.createGain(),this.master.gain.value=0,this.master.connect(t.destination);const i=t.createBuffer(1,t.sampleRate*4,t.sampleRate),s=i.getChannelData(0);for(let a=0;a<s.length;a++)s[a]=(Math.random()*2-1)*.35;const r=t.createBufferSource();r.buffer=i,r.loop=!0;const c=t.createBiquadFilter();c.type="highpass",c.frequency.value=5600;const n=t.createGain();n.gain.value=.1,r.connect(c).connect(n).connect(this.master),r.start()}return await this.context.resume(),this.enabled=!this.enabled,this.master.gain.setTargetAtTime(this.enabled?.5:0,this.context.currentTime,.15),this.enabled}pop(){if(!this.enabled||!this.context||this.context.state!=="running")return;const e=this.context,t=e.currentTime,i=e.createOscillator(),s=e.createGain();i.type="sine",i.frequency.setValueAtTime(650+Math.random()*250,t),i.frequency.exponentialRampToValueAtTime(160,t+.12),s.gain.setValueAtTime(1e-4,t),s.gain.exponentialRampToValueAtTime(.14,t+.008),s.gain.exponentialRampToValueAtTime(1e-4,t+.18),i.connect(s).connect(this.master),i.start(t),i.stop(t+.19),i.onended=()=>{i.disconnect(),s.disconnect()}}quiet(e){this.context&&this.master.gain.setTargetAtTime(this.enabled&&!e?.5:0,this.context.currentTime,.15)}dispose(){this.context?.close()}}const w=new se;function R(o){te.textContent=o}function z(o){u&&(u.setPaused(o),S.setAttribute("aria-pressed",String(o)),S.setAttribute("aria-label",o?"Resume animation":"Pause animation"),document.querySelector("#hint-title").textContent=o?"Taking a little breather.":matchMedia("(pointer: coarse)").matches?"Drag gently. Make a friend.":"Move your cursor. Make a friend.",document.querySelector("#hint-detail").textContent=o?"Press play whenever you’re ready.":"Click anywhere for a little happy.",w.quiet(o))}function I(o){const e=g.getBoundingClientRect();return{x:(o.clientX-e.left)/e.width,y:1-(o.clientY-e.top)/e.height,px:o.clientX-e.left,py:o.clientY-e.top}}function U(o){return o.target.closest("button, a")}function O(o){console.error("[Little Fizz]",o),g.classList.add("is-ready"),document.querySelector("#fallback").hidden=!1;for(const e of g.querySelectorAll("button"))e.disabled=!0;u?.dispose()}try{u=new Z(ee,{reducedMotion:G.matches,onError:O}),await u.init(),g.classList.add("is-ready"),z(u.paused)}catch(o){O(o)}v(g,"pointermove",o=>{if(!u||U(o)){D.classList.remove("is-visible");return}if(o.pointerType==="touch"&&!A)return;const e=I(o);u.move(e.x,e.y),D.style.transform=`translate3d(${e.px}px, ${e.py}px, 0)`,D.classList.toggle("is-visible",o.pointerType!=="touch"&&!u.paused),!C&&!u.paused&&(C=!0,g.classList.add("is-playing"))});v(g,"pointerleave",()=>{u?.leave(),D.classList.remove("is-visible")});v(g,"pointerdown",o=>{if(!u||U(o)||!o.isPrimary||o.button!==0)return;const e=I(o);A={x:o.clientX,y:o.clientY,id:o.pointerId},u.move(e.x,e.y),o.pointerType==="touch"&&g.setPointerCapture(o.pointerId)});v(g,"pointerup",o=>{if(!A||A.id!==o.pointerId)return;const e=Math.hypot(o.clientX-A.x,o.clientY-A.y);if(!U(o)&&e<15&&u&&!u.paused){const t=I(o);u.boop(t.x,t.y),w.pop(),g.classList.add("is-playing"),document.querySelector("#hint-detail").textContent="That’s the spot. Again?",clearTimeout(X),X=setTimeout(()=>{u.paused||(document.querySelector("#hint-detail").textContent="Click anywhere for a little happy.")},2600)}g.hasPointerCapture(o.pointerId)&&g.releasePointerCapture(o.pointerId),A=null});v(g,"pointercancel",()=>{A=null,u?.leave()});v(document.querySelector("#fizz"),"click",()=>{u&&(u.paused&&z(!1),u.moreFizz(),w.pop(),R("An extra splash of bubbles for your little friend."))});v(S,"click",()=>{u&&(z(!u.paused),R(u.paused?"Animation paused.":"Animation resumed."))});v(document.querySelector("#reset"),"click",()=>{u?.reset(),g.classList.remove("is-playing"),C=!1,R("Your puppy is floating back home.")});v(B,"click",async()=>{try{const o=await w.toggle();B.setAttribute("aria-pressed",String(o)),B.setAttribute("aria-label",o?"Turn sound off":"Turn sound on"),w.quiet(u?.paused||document.hidden),o&&!u?.paused&&w.pop(),R(o?"Gentle fizz sounds on.":"Sound off.")}catch{R("Sound could not start in this browser.")}});v(G,"change",o=>{o.matches&&z(!0)});v(document,"visibilitychange",()=>w.quiet(document.hidden||u?.paused));v(window,"keydown",o=>{o.code==="Space"&&o.target===document.body&&(o.preventDefault(),u&&z(!u.paused))});
