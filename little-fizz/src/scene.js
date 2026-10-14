import { quadVertex, backgroundFragment, copyFragment, puppyVertex, puppyFragment, bubbleVertex, bubbleFragment } from './shaders.js';
import { iceFragment } from './ice-shader.js';
import { IceWorld } from './ice-physics.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

/** Raw WebGL2, texture-based 2.5D renderer. No Three.js or runtime dependencies. */
export class FizzScene {
  constructor(canvas, { onError = console.error, reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.onError = onError;
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!this.gl) throw new Error('WebGL2 is unavailable');
    this.reducedMotion = reducedMotion;
    this.paused = reducedMotion;
    this.pointer = { x: .58, y: .53, active: false };
    this.dog = { x: .58, y: .53, vx: 0, vy: 0, tilt: 0 };
    this.gaze = [0, 0];
    this.time = 0;
    this.energy = 0;
    this.boost = 0;
    this.ripple = [.5, .5, -100];
    this.bubbles = [];
    this.resources = [];
    this.running = false;
    this.disposed = false;
    this.contextLost = false;
    this.lastTime = 0;
    this.frameCount = 0;
    this.needsDraw = true;
    this.onLost = event => {
      event.preventDefault();
      this.contextLost = true;
      cancelAnimationFrame(this.raf);
    };
    this.onRestored = () => {
      if (this.disposed) return;
      try {
        this.resources = [];
        this.setup();
        this.contextLost = false;
        this.resize(true);
        this.lastTime = 0;
        this.raf = requestAnimationFrame(this.frame);
      } catch (error) { this.onError(error); }
    };
    this.onVisibility = () => {
      this.lastTime = 0;
      if (document.hidden) cancelAnimationFrame(this.raf);
      else if (this.running && !this.contextLost) this.raf = requestAnimationFrame(this.frame);
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.frame = this.frame.bind(this);
  }

  async init() {
    [this.backgroundImage, this.puppyImage] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/cola-liquid.webp`),
      loadImage(`${import.meta.env.BASE_URL}assets/puppy.webp`),
    ]);
    if (this.disposed) return;
    this.setup();
    this.resize(true);
    for (let i = 0; i < 175; i++) this.bubbles.push(this.newBubble(true));
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  program(vertex, fragment) {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const v = compile(gl.VERTEX_SHADER, vertex), f = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.resources.push(['Program', program]);
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { id: program, uniforms };
  }

  texture(image) {
    const gl = this.gl;
    const tex = gl.createTexture();
    this.resources.push(['Texture', tex]);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (image) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    return tex;
  }

  setup() {
    const gl = this.gl;
    this.backgroundProgram = this.program(quadVertex, backgroundFragment);
    this.copyProgram = this.program(quadVertex, copyFragment);
    this.puppyProgram = this.program(puppyVertex, puppyFragment);
    this.bubbleProgram = this.program(bubbleVertex, bubbleFragment);
    this.iceProgram = this.program(puppyVertex, iceFragment);
    this.quad = gl.createBuffer();
    this.resources.push(['Buffer', this.quad]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    this.particleBuffer = gl.createBuffer();
    this.resources.push(['Buffer', this.particleBuffer]);
    this.particleData = new Float32Array(720 * 5);
    this.backgroundTexture = this.texture(this.backgroundImage);
    this.puppyTexture = this.texture(this.puppyImage);
    this.sceneTexture = this.texture();
    this.framebuffer = gl.createFramebuffer();
    this.resources.push(['Framebuffer', this.framebuffer]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTexture, 0);
    this.compositeTexture = this.texture();
    this.compositeFramebuffer = gl.createFramebuffer();
    this.resources.push(['Framebuffer', this.compositeFramebuffer]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize(force = false) {
    if (this.contextLost || this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.needsDraw = true;
    this.height = Math.max(1, rect.height);
    // Limit fill rate on large / retina displays without making edges fuzzy.
    this.dpr = Math.min(devicePixelRatio || 1, 1.75, Math.sqrt(3400000 / (this.width * this.height)));
    const w = Math.round(this.width * this.dpr), h = Math.round(this.height * this.dpr);
    this.mobile = this.width < 600;
    this.home = { x: this.mobile ? .53 : .60, y: this.mobile ? .60 : .54 };
    this.dogHeight = this.mobile ? Math.min(this.height * .42, this.width * .9) : Math.min(this.height * .59, this.width * .40, 610);
    this.dogWidth = this.dogHeight * this.puppyImage.width / this.puppyImage.height;
    if (force || this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Could not create the refraction buffer');
      gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Could not create the ice refraction buffer');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    if (!this.pointer.active) {
      this.pointer.x = this.home.x; this.pointer.y = this.home.y;
      this.dog.x = this.home.x; this.dog.y = this.home.y;
    }
    if (this.iceWorld) this.iceWorld.resize(this.width, this.height);
    else this.iceWorld = new IceWorld(this.width, this.height);
  }

  newBubble(scattered = false, x, y, burst = false) {
    const near = Math.random() > .78;
    return {
      x: x ?? Math.random(), y: y ?? (scattered ? Math.random() * 1.1 : -.03),
      vx: burst ? (Math.random() - .5) * .22 : (Math.random() - .5) * .009,
      vy: burst ? .03 + Math.random() * .09 : .012 + Math.random() * .045,
      size: near ? 5 + Math.random() * 10 : 1.5 + Math.random() * 5,
      opacity: .25 + Math.random() * .65, phase: Math.random() * Math.PI * 2,
      near, burst, life: 0,
    };
  }

  move(x, y) { this.pointer = { x: clamp(x, 0, 1), y: clamp(y, 0, 1), active: true }; }
  leave() { this.pointer.active = false; }
  reset() {
    this.pointer.active = false;
    this.pointer.x = this.home.x; this.pointer.y = this.home.y;
    this.energy = 0;
    if (this.paused) {
      Object.assign(this.dog, this.home, { vx: 0, vy: 0, tilt: 0 });
      this.gaze = [0, 0];
      this.needsDraw = true;
    }
  }
  setPaused(value) { this.paused = value; this.needsDraw = true; }
  boop(x = this.dog.x, y = this.dog.y) {
    if (this.paused) return;
    this.energy = 1;
    this.dog.vy += .17;
    this.ripple = [x, y, this.time];
    for (let i = 0; i < 35 && this.bubbles.length < 700; i++) this.bubbles.push(this.newBubble(false, x + (Math.random() - .5) * .07, y, true));
  }
  moreFizz() {
    if (this.paused) return;
    this.boost = 1;
    this.energy = .75;
    for (let i = 0; i < 150 && this.bubbles.length < 700; i++) this.bubbles.push(this.newBubble(false, Math.random(), -.05 - Math.random() * .4, true));
  }

  update(dt) {
    this.time += dt;
    this.energy = damp(this.energy, 0, 2.2, dt);
    this.boost = damp(this.boost, 0, .35, dt);
    const dog = this.dog;
    const marginX = this.dogWidth * .56 / this.width;
    const marginY = this.dogHeight * .53 / this.height;
    let targetX = this.home.x, targetY = this.home.y;
    if (this.pointer.active) {
      targetX = clamp(this.pointer.x, marginX + .025, 1 - marginX - .025);
      targetY = clamp(this.pointer.y, marginY + .08, 1 - marginY - .09);
    } else {
      targetX += Math.sin(this.time * .45) * .022;
      targetY += Math.sin(this.time * .73) * .014;
    }
    // A damped spring gives weight without a sluggish lerp or runaway overshoot.
    dog.vx += ((targetX - dog.x) * 15 - dog.vx * 6.5) * dt;
    dog.vy += ((targetY - dog.y) * 15 - dog.vy * 6.5) * dt;
    dog.x += dog.vx * dt;
    dog.y += dog.vy * dt;
    dog.x = clamp(dog.x, marginX, 1 - marginX);
    dog.y = clamp(dog.y, marginY + .045, 1 - marginY - .04);
    dog.tilt = damp(dog.tilt, clamp(-dog.vx * .65, -.20, .20) + Math.sin(this.time * .9) * .025 + Math.sin(this.time * 12) * this.energy * .10, 5, dt);
    this.gaze[0] = damp(this.gaze[0], this.pointer.active ? clamp((this.pointer.x - dog.x) * 5, -1, 1) : Math.sin(this.time * .5) * .12, 5, dt);
    this.gaze[1] = damp(this.gaze[1], this.pointer.active ? clamp((this.pointer.y - dog.y) * 5, -1, 1) : 0, 5, dt);
    this.iceWorld.step(dt, this.time, {
      x: dog.x * this.width, y: dog.y * this.height,
      vx: dog.vx * this.width, vy: dog.vy * this.height,
      width: this.dogWidth, height: this.dogHeight, angle: dog.tilt,
    });
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      bubble.life += dt;
      bubble.y += bubble.vy * dt * (1 + this.boost * 1.5);
      bubble.x += (bubble.vx + Math.sin(this.time * 1.3 + bubble.phase) * .006) * dt;
      bubble.vx *= Math.exp(-dt * .4);
      if (bubble.y > 1.08 || bubble.x < -.08 || bubble.x > 1.08 || (bubble.burst && bubble.life > 14)) {
        if (bubble.burst) this.bubbles.splice(i, 1);
        else Object.assign(bubble, this.newBubble());
      }
    }
  }

  bindTexture(texture, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  useQuad(program) {
    const gl = this.gl;
    gl.useProgram(program.id);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const position = gl.getAttribLocation(program.id, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    return program.uniforms;
  }

  drawBubbles(near) {
    const gl = this.gl, program = this.bubbleProgram;
    let count = 0;
    for (const bubble of this.bubbles) {
      if (bubble.near !== near) continue;
      const i = count++ * 5;
      this.particleData[i] = bubble.x * this.width;
      this.particleData[i+1] = bubble.y * this.height;
      this.particleData[i+2] = bubble.size;
      this.particleData[i+3] = 0;
      this.particleData[i+4] = bubble.opacity * (bubble.burst ? Math.min(1, bubble.life * 3) * Math.min(1, (14 - bubble.life) / 2) : 1);
    }
    if (!count) return;
    gl.useProgram(program.id);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleData.subarray(0, count * 5), gl.DYNAMIC_DRAW);
    const position = gl.getAttribLocation(program.id, 'a_bubble');
    const opacity = gl.getAttribLocation(program.id, 'a_opacity');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(opacity);
    gl.vertexAttribPointer(opacity, 1, gl.FLOAT, false, 20, 16);
    gl.uniform2f(program.uniforms.u_resolution, this.width, this.height);
    gl.uniform1f(program.uniforms.u_dpr, this.dpr);
    this.bindTexture(this.sceneTexture, 0);
    gl.uniform1i(program.uniforms.u_scene, 0);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.disableVertexAttribArray(position);
    gl.disableVertexAttribArray(opacity);
  }

  draw() {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    let u = this.useQuad(this.backgroundProgram);
    this.bindTexture(this.backgroundTexture, 0);
    gl.uniform1i(u.u_image, 0);
    gl.uniform2f(u.u_resolution, w, h);
    gl.uniform2f(u.u_imageSize, this.backgroundImage.width, this.backgroundImage.height);
    gl.uniform2f(u.u_pointer, this.dog.x, this.dog.y);
    gl.uniform1f(u.u_time, this.time);
    gl.uniform3fv(u.u_ripple, this.ripple);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
    u = this.useQuad(this.copyProgram);
    this.bindTexture(this.sceneTexture, 0);
    gl.uniform1i(u.u_image, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.BLEND);
    this.drawBubbles(false);
    this.drawIce(false, this.sceneTexture);
    u = this.useQuad(this.puppyProgram);
    this.bindTexture(this.puppyTexture, 0);
    this.bindTexture(this.sceneTexture, 1);
    gl.uniform1i(u.u_puppy, 0);
    gl.uniform1i(u.u_scene, 1);
    // Vertices use physical pixels, matching gl_FragCoord in the refraction pass.
    gl.uniform2f(u.u_resolution, w, h);
    gl.uniform2f(u.u_center, this.dog.x * w, this.dog.y * h);
    gl.uniform2f(u.u_size, this.dogWidth * this.dpr, this.dogHeight * this.dpr);
    gl.uniform1f(u.u_tilt, this.dog.tilt);
    gl.uniform1f(u.u_squash, Math.sin(this.time * 2) * .014 + Math.sin(this.time * 14) * this.energy * .07);
    gl.uniform2fv(u.u_gaze, this.gaze);
    gl.uniform1f(u.u_time, this.time);
    gl.uniform1f(u.u_energy, this.energy);
    const blinkPhase = this.time % 5.7;
    gl.uniform1f(u.u_blink, blinkPhase > 5.35 ? Math.pow(Math.sin((blinkPhase - 5.35) / .35 * Math.PI), 2) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    u = this.useQuad(this.copyProgram);
    this.bindTexture(this.compositeTexture, 0);
    gl.uniform1i(u.u_image, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.BLEND);
    this.drawIce(true, this.compositeTexture);
    this.drawBubbles(true);
    gl.disable(gl.BLEND);
  }

  drawIce(front, source) {
    const gl = this.gl;
    const u = this.useQuad(this.iceProgram);
    this.bindTexture(source, 0);
    gl.uniform1i(u.u_scene, 0);
    gl.uniform2f(u.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_time, this.time);
    gl.uniform1f(u.u_squash, 0);
    for (const cube of this.iceWorld.bodies) {
      if (cube.front !== front) continue;
      gl.uniform2f(u.u_center, cube.x * this.dpr, cube.y * this.dpr);
      gl.uniform2f(u.u_size, cube.size * this.dpr, cube.size * this.dpr);
      gl.uniform1f(u.u_tilt, cube.angle);
      gl.uniform1f(u.u_seed, cube.seed);
      gl.uniform1f(u.u_contact, cube.contact);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  frame(now) {
    if (!this.running || this.disposed || this.contextLost) return;
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, .033) : 1 / 60;
    this.lastTime = now;
    if (!this.paused) this.update(dt);
    if (!this.paused || this.needsDraw) {
      this.draw();
      this.needsDraw = false;
    }
    this.frameCount++;
    if (import.meta.env.DEV && this.frameCount % 15 === 0) {
      this.canvas.dataset.diagnostics = JSON.stringify({
        x: +this.dog.x.toFixed(3), y: +this.dog.y.toFixed(3),
        time: +this.time.toFixed(2), bubbles: this.bubbles.length,
        paused: this.paused, width: this.width, height: this.height,
        frameMs: +(dt * 1000).toFixed(1), glError: this.gl.getError(),
        iceContacts: this.iceWorld.contacts,
        ice: this.iceWorld.bodies.map(b => ({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), angle: +b.angle.toFixed(2), speed: +Math.hypot(b.vx, b.vy).toFixed(1) })),
      });
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const [type, resource] of this.resources) this.gl[`delete${type}`](resource);
    this.resources = [];
  }
}
