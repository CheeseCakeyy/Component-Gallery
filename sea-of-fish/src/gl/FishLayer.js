import { drawSprite, view } from '../art/sprites.js';
import { theme } from '../theme.js';

// Draws every fish sprite in a frame with a handful of instanced WebGL calls instead of
// thousands of Canvas2D drawImage calls. It sits on its own canvas above the 2D line-art
// canvas (sky, moon, boat). Sprites keep their submission order, so overlaps look the same.
// Without WebGL2 it falls back to drawing straight onto the 2D canvas.

const VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aMat;    // 2x2 transform: a b c d (canvas setTransform order)
layout(location = 2) in vec2 aPos;    // translation, device px
layout(location = 3) in vec4 aSrc;    // atlas rect: x y w h, texels
layout(location = 4) in vec3 aAnchor; // anchor x y, alpha
uniform vec2 uView;
uniform vec2 uTex;
out vec2 vUv;
out float vA;
void main() {
  vec2 local = aCorner * aSrc.zw - aAnchor.xy;
  vec2 p = vec2(aMat.x * local.x + aMat.z * local.y, aMat.y * local.x + aMat.w * local.y) + aPos;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vUv = (aSrc.xy + aCorner * aSrc.zw) / uTex;
  vA = aAnchor.z;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vA;
uniform sampler2D uImg;
out vec4 o;
void main() {
  o = texture(uImg, vUv) * vA;
}`;

const FLOATS = 13;
const CAP = 8192;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export class FishLayer {
  constructor(canvas, ctx2d) {
    this.canvas = canvas;
    this.ctx2d = ctx2d;
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
      if (gl) this.init(gl);
    } catch (err) {
      console.warn('WebGL fish layer unavailable, using 2D canvas', err);
      gl = null;
    }
    this.gl = gl;
    if (!gl) canvas.style.display = 'none';

    this.solids = new Map(); // one 1x1 texture per fill colour (paper changes with the theme)
  }

  init(gl) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.uView = gl.getUniformLocation(prog, 'uView');
    this.uTex = gl.getUniformLocation(prog, 'uTex');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.data = new Float32Array(FLOATS * CAP);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const attr = (loc, size, offset) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr(1, 4, 0);
    attr(2, 2, 4);
    attr(3, 4, 6);
    attr(4, 3, 10);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.n = 0;
    this.cur = null;
  }

  resize(wDev, hDev) {
    if (!this.gl) return;
    this.canvas.width = wDev;
    this.canvas.height = hDev;
    this.gl.viewport(0, 0, wDev, hDev);
    this.gl.uniform2f(this.uView, wDev, hDev);
  }

  begin() {
    if (!this.gl) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.n = 0;
    this.cur = null;
  }

  texture(atlas) {
    if (atlas.glTex) return atlas.glTex;
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    atlas.glTex = tex;
    return tex;
  }

  // Same arguments as drawSprite, plus an alpha.
  sprite(spr, x, y, angle, scale, flip, alpha = 1) {
    if (alpha <= 0.003) return;
    if (!this.gl) {
      const ctx = this.ctx2d;
      ctx.globalAlpha = alpha;
      drawSprite(ctx, spr, x, y, angle, scale, flip);
      ctx.globalAlpha = 1;
      return;
    }
    if (spr.atlas !== this.cur) {
      this.flush();
      this.cur = spr.atlas;
    } else if (this.n === CAP) {
      this.flush();
    }
    const k = (scale * view.s * view.dpr) / spr.res;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const f = flip && c < 0 ? -1 : 1;
    const d = this.data;
    let i = this.n * FLOATS;
    d[i++] = c * k;
    d[i++] = s * k;
    d[i++] = -s * k * f;
    d[i++] = c * k * f;
    d[i++] = (x * view.s + view.x) * view.dpr;
    d[i++] = (y * view.s + view.y) * view.dpr;
    d[i++] = spr.sx;
    d[i++] = spr.sy;
    d[i++] = spr.sw;
    d[i++] = spr.sh;
    d[i++] = spr.ax;
    d[i++] = spr.ay;
    d[i] = alpha;
    this.n++;
  }

  solid(color) {
    let spr = this.solids.get(color);
    if (!spr) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 0, 1, 1);
      spr = { atlas: { img: c, canvas: c }, sx: 0, sy: 0, sw: 1, sh: 1, ax: 0, ay: 0, res: 1 };
      this.solids.set(color, spr);
    }
    return spr;
  }

  // A paper-coloured rectangle in CSS px (screen space).
  rect(x, y, w, h, alpha = 1) {
    if (alpha <= 0.003) return;
    if (!this.gl) {
      const ctx = this.ctx2d;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = theme.paper;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      return;
    }
    const saved = { s: view.s, x: view.x, y: view.y };
    view.s = 1;
    view.x = 0;
    view.y = 0;
    const spr = this.solid(theme.paper);
    if (spr.atlas !== this.cur) {
      this.flush();
      this.cur = spr.atlas;
    } else if (this.n === CAP) {
      this.flush();
    }
    const d = this.data;
    let i = this.n * FLOATS;
    d[i++] = w * view.dpr;
    d[i++] = 0;
    d[i++] = 0;
    d[i++] = h * view.dpr;
    d[i++] = x * view.dpr;
    d[i++] = y * view.dpr;
    d[i++] = 0;
    d[i++] = 0;
    d[i++] = 1;
    d[i++] = 1;
    d[i++] = 0;
    d[i++] = 0;
    d[i] = alpha;
    this.n++;
    Object.assign(view, saved);
  }

  flush() {
    if (!this.gl || this.n === 0) return;
    const gl = this.gl;
    const atlas = this.cur;
    gl.bindTexture(gl.TEXTURE_2D, this.texture(atlas));
    gl.uniform2f(this.uTex, atlas.canvas.width, atlas.canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    this.n = 0;
  }

  end() {
    this.flush();
  }
}
