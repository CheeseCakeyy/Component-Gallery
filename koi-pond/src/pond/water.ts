import { Filter, GlProgram } from 'pixi.js';
import { MAX_RIPPLES, type PondState } from './simulation';

const vertex = `
precision highp float;
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

// Fixed paper coordinates keep grain still while the drawing moves across it.
const pencilMaterial = `
float paperNoise(vec2 p) {
  return fract(sin(dot(floor(p),vec2(127.1,311.7)))*43758.5453);
}
vec3 pencilPaper(vec2 p,float blue) {
  float tooth=paperNoise(p*1.3)-.5;
  float fiber=paperNoise(vec2(p.x*.28,p.y*1.7))-.5;
  vec3 paper=mix(vec3(.962,.945,.909),vec3(.945,.959,.950),blue);
  return paper+(tooth*.027+fiber*.012)*mix(1.0,.65,blue);
}
vec3 drawPencil(vec2 p,float stroke,float tone,float ghost,float blue) {
  float grain=paperNoise(p*1.3);
  float broad=paperNoise(p*.32);
  float pressure=.70+.23*grain+.07*broad;
  float graphite=stroke*pressure+tone*(.13+.17*grain);
  // Uneven diagonal passes with a lighter crossing pass in the darkest patches.
  float diagonal=p.x*.77+p.y*.64+sin(p.y*.045)*1.2;
  float line=1.0-smoothstep(.40,1.05,abs(mod(diagonal,5.3)-2.65));
  float crossLine=1.0-smoothstep(.3,.9,abs(mod(p.x*.65-p.y*.76,7.7)-3.85));
  float hatch=tone*line*.46+smoothstep(.50,.85,tone)*crossLine*.19;
  float blueStroke=stroke*(.67+.25*grain)+hatch+tone*.045+ghost*.21;
  float coverage=clamp(mix(graphite,blueStroke,blue),0.0,.94);
  vec3 lead=mix(vec3(.25,.245,.23),vec3(.16,.36,.58),blue);
  return mix(pencilPaper(p,blue),lead,coverage);
}
`;

const fragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec2 uViewport;
uniform float uTime;
uniform float uSketch;
uniform float uBlue;
uniform vec4 uRipples[16];
${pencilMaterial}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

// Slowly evolving light cells. The bright boundaries resemble focused sunlight
// on the bed, while refraction below is driven by the actual wave gradients.
float caustic(vec2 p) {
  vec2 q = p / 68.0;
  q += vec2(sin(q.y*.83+uTime*.27),cos(q.x*.76-uTime*.21))*.85;
  float field = sin(q.x+sin(q.y*1.13+uTime*.19))
              + sin(q.y+cos(q.x*.91-uTime*.23));
  float ridge = 1.0-smoothstep(.03,.32,abs(field-.65));
  return ridge * (.45+.55*sin(q.x*.41+q.y*.37+uTime*.21)*sin(q.x*.41+q.y*.37+uTime*.21));
}
void main() {
  vec2 local = vTextureCoord * uInputSize.xy / uViewport;
  vec2 p = local * vec2(1536.0,1024.0);
  vec2 edge = abs((local-.5)/vec2(.488,.482));
  float mask = 1.0-smoothstep(.78,1.03,pow(edge.x,6.0)+pow(edge.y,6.0));
  vec2 slope = vec2(
    .028*cos(p.x*.013+p.y*.009+uTime*.7)+.019*sin(p.y*.019-uTime*.43),
    .025*sin(p.y*.014+p.x*.006-uTime*.58)+.020*cos(p.x*.016+uTime*.39)
  );
  float waveLight = 0.0;
  for(int i=0;i<16;i++) {
    vec4 r = uRipples[i];
    if(r.w>.001) {
      vec2 delta = p-r.xy;
      float d = max(length(delta),.5);
      float front = d-r.z*170.0;
      float width = 43.0+r.z*14.0;
      float envelope = exp(-front*front/(width*width))*exp(-r.z*.58)*r.w;
      envelope *= smoothstep(0.0,.09,r.z);
      float phase = front*.105;
      float gradient = (cos(phase)*.105-sin(phase)*2.0*front/(width*width))*envelope*9.5;
      slope += delta/d * gradient;
      waveLight += sin(phase)*envelope;
    }
  }
  vec2 offset = slope*17.0 * mask * mix(1.0,.52,uSketch);
  vec2 uv = vTextureCoord + offset/vec2(1536.0,1024.0)*uViewport*uInputSize.zw;
  vec4 color = texture(uTexture, clamp(uv,uInputClamp.xy,uInputClamp.zw));
  float cells = caustic(p+offset*1.8);
  float lightSlope = dot(slope,vec2(-.42,-.7));
  vec3 water = color.rgb * vec3(.93,1.0,.985);
  water += vec3(.83,.98,.75)*cells*.021;
  water += max(0.0,lightSlope)*vec3(.68,.83,.75)*.18;
  water -= max(0.0,-lightSlope)*vec3(.11,.15,.13);
  water += max(0.0,waveLight)*.018;
  vec2 pixel = uInputSize.zw;
  vec3 l = texture(uTexture,clamp(uv-vec2(pixel.x,0),uInputClamp.xy,uInputClamp.zw)).rgb;
  vec3 r = texture(uTexture,clamp(uv+vec2(pixel.x,0),uInputClamp.xy,uInputClamp.zw)).rgb;
  vec3 t = texture(uTexture,clamp(uv-vec2(0,pixel.y),uInputClamp.xy,uInputClamp.zw)).rgb;
  vec3 b = texture(uTexture,clamp(uv+vec2(0,pixel.y),uInputClamp.xy,uInputClamp.zw)).rgb;
  vec3 weights = vec3(.299,.587,.114);
  float detail = length(vec2(dot(r-l,weights),dot(b-t,weights)));
  float stroke = smoothstep(.025,.28,detail)*.95;
  vec2 ghostUV=uv+pixel*vec2(2.7,-1.8);
  vec3 ghostA=texture(uTexture,clamp(ghostUV,uInputClamp.xy,uInputClamp.zw)).rgb;
  vec3 ghostB=texture(uTexture,clamp(ghostUV+pixel*vec2(1,1),uInputClamp.xy,uInputClamp.zw)).rgb;
  float ghost=smoothstep(.055,.29,abs(dot(ghostA-ghostB,weights)));
  float tone=smoothstep(.12,.8,1.0-dot(color.rgb,weights));
  vec3 pencil = drawPencil(vTextureCoord*uInputSize.xy,
    max(stroke,clamp(abs(lightSlope)*.22,0.0,.23)),tone,ghost,uBlue);
  color.rgb = mix(color.rgb,mix(water,pencil,uSketch),mask);
  finalColor = color;
}`;

export function createWater() {
  const data = new Float32Array(MAX_RIPPLES * 4);
  const filter = new Filter({
    glProgram: GlProgram.from({ vertex, fragment }),
    resources: { waterUniforms: {
      uTime: { value: 0, type: 'f32' },
      uViewport: { value: new Float32Array([960,640]), type: 'vec2<f32>' },
      uSketch: { value: 0, type: 'f32' }, uBlue: { value: 0, type: 'f32' },
      uRipples: { value: data, type: 'vec4<f32>', size: 16 },
    } },
    padding: 0, resolution: 1,
  });
  return { filter,
    update(state: PondState, width: number, height: number, sketch: number, blue: number) {
      const uniforms = filter.resources.waterUniforms.uniforms;
      uniforms.uTime = state.time;
      uniforms.uViewport[0] = width; uniforms.uViewport[1] = height;
      uniforms.uSketch = sketch; uniforms.uBlue = blue;
      data.fill(0);
      state.ripples.forEach((r,i) => { data[i*4]=r.x; data[i*4+1]=r.y; data[i*4+2]=r.age; data[i*4+3]=r.strength; });
    },
  };
}

const inkFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform float uMix;
uniform float uBlue;
${pencilMaterial}
float luminance(vec4 c) { return dot(c.rgb/max(c.a,.01),vec3(.299,.587,.114)); }
void main() {
  vec4 color = texture(uTexture,vTextureCoord);
  if(uMix<.001){finalColor=color;return;}
  vec2 pixel = uInputSize.zw*1.05;
  vec4 left = texture(uTexture,clamp(vTextureCoord-vec2(pixel.x,0),uInputClamp.xy,uInputClamp.zw));
  vec4 right = texture(uTexture,clamp(vTextureCoord+vec2(pixel.x,0),uInputClamp.xy,uInputClamp.zw));
  vec4 up = texture(uTexture,clamp(vTextureCoord-vec2(0,pixel.y),uInputClamp.xy,uInputClamp.zw));
  vec4 down = texture(uTexture,clamp(vTextureCoord+vec2(0,pixel.y),uInputClamp.xy,uInputClamp.zw));
  float outline = length(vec2(right.a-left.a,down.a-up.a));
  float detail = length(vec2(luminance(right)-luminance(left),luminance(down)-luminance(up)));
  float stroke = clamp(outline*1.35 + smoothstep(.075,.43,detail)*.83,0.0,.94);
  vec2 ghostUV=vTextureCoord+pixel*vec2(2.7,-1.8);
  vec4 ghostA=texture(uTexture,clamp(ghostUV,uInputClamp.xy,uInputClamp.zw));
  vec4 ghostB=texture(uTexture,clamp(ghostUV+pixel*vec2(1,1),uInputClamp.xy,uInputClamp.zw));
  float ghost=smoothstep(.075,.40,abs(luminance(ghostA)-luminance(ghostB))+abs(ghostA.a-ghostB.a));
  float tone=smoothstep(.12,.8,1.0-luminance(color));
  vec4 sketch = vec4(drawPencil(vTextureCoord*uInputSize.xy,stroke,tone,ghost,uBlue)*color.a,color.a);
  finalColor = mix(color,sketch,uMix);
}`;

export function createInk() {
  const filter = new Filter({ glProgram: GlProgram.from({ vertex, fragment: inkFragment }),
    resources: { inkUniforms: { uMix: { value: 0, type: 'f32' }, uBlue: { value: 0, type: 'f32' } } },
    padding: 2, resolution: 1,
  });
  return { filter, update(mix: number, blue: number) {
    filter.resources.inkUniforms.uniforms.uMix = mix;
    filter.resources.inkUniforms.uniforms.uBlue = blue;
  } };
}

// Enrich the existing painted texture and collect a little pigment at its edge.
// Sampling alpha keeps the irregular fins and transparent brushwork intact.
const pigmentFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform float uAmount;
uniform float uGold;
uniform float uDepth;
void main() {
  vec4 color = texture(uTexture,vTextureCoord);
  vec2 pixel = uInputSize.zw*1.15;
  float a = texture(uTexture,clamp(vTextureCoord-vec2(pixel.x,0),uInputClamp.xy,uInputClamp.zw)).a;
  float b = texture(uTexture,clamp(vTextureCoord+vec2(pixel.x,0),uInputClamp.xy,uInputClamp.zw)).a;
  float c = texture(uTexture,clamp(vTextureCoord-vec2(0,pixel.y),uInputClamp.xy,uInputClamp.zw)).a;
  float d = texture(uTexture,clamp(vTextureCoord+vec2(0,pixel.y),uInputClamp.xy,uInputClamp.zw)).a;
  float edge = smoothstep(.02,.40,max(0.0,color.a-min(min(a,b),min(c,d))));
  vec3 rgb = color.rgb/max(color.a,.001);
  float lum = dot(rgb,vec3(.299,.587,.114));
  vec3 pigment = mix(vec3(lum),rgb,1.10);
  pigment = (pigment-.48)*1.07+.48;
  // A touch of ochre makes the yellow koi distinct from the green pond bed.
  float yellow = smoothstep(.08,.30,min(rgb.r,rgb.g)-rgb.b)*uGold;
  pigment *= mix(vec3(1.0),vec3(1.0,.95,.87),yellow);
  // A warmer vermilion reads as painted pigment against the jade water.
  float red=smoothstep(.20,.55,rgb.r-max(rgb.g,rgb.b));
  pigment=mix(pigment,pigment*vec3(.96,1.0,1.0)+vec3(0.0,.022,.013),red);
  pigment *= 1.0-edge*.19;
  // Water gently veils deeper fish; retain opaque bodies and airy fin tips.
  pigment=mix(pigment,vec3(.39,.57,.48),uDepth*.085);
  float alpha=color.a+color.a*(1.0-color.a)*.28*uAmount;
  finalColor = vec4(mix(rgb,clamp(pigment,0.0,1.0),uAmount)*alpha,alpha);
}`;

export function createPigment(gold: boolean) {
  const filter = new Filter({ glProgram: GlProgram.from({ vertex, fragment: pigmentFragment }),
    resources: { pigmentUniforms: {
      uAmount: { value: 1, type: 'f32' }, uGold: { value: gold ? 1 : 0, type: 'f32' },
      uDepth: { value: 0, type: 'f32' },
    } }, padding: 2, resolution: 1 });
  return { filter, update(sketch: number, depth: number) {
    filter.resources.pigmentUniforms.uniforms.uAmount = 1-sketch;
    filter.resources.pigmentUniforms.uniforms.uDepth = depth;
  } };
}




