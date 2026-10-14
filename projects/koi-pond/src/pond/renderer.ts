import { Application, Assets, BlurFilter, Container, Graphics, Mesh, MeshPlane, Rectangle, Sprite, Texture } from 'pixi.js';
import { clamp, createPond, feed, ripple, step, WORLD, type Fish, type Point, type PondState } from './simulation';
import { createInk, createPigment, createWater } from './water';

export type PondStyle = 'watercolor' | 'graphite' | 'blue';
export type PondStats = { time: number; ripples: number; fps: number };
type Rig = { mesh: MeshPlane; shadow: Mesh; centerY: number; height: number; pigment: ReturnType<typeof createPigment> };
export type PondRenderer = {
  setStyle: (style: PondStyle) => void;
  setPaused: (paused: boolean) => void;
  disturb: (point?: Point, strength?: number) => void;
  feed: (point?: Point) => void;
  destroy: () => void;
};
const assetNames = ['pond-bed.webp', 'koi-natural.webp', 'pond-objects.webp'];

export async function createRenderer(host: HTMLElement, options: {
  assetBase: string; style: PondStyle; paused: boolean;
  onStats: (stats: PondStats) => void; signal: AbortSignal;
}): Promise<PondRenderer | null> {
  const app = new Application();
  let initialized = false;
  try {
    await app.init({ width: host.clientWidth || 960, height: (host.clientWidth || 960) * 2 / 3,
      backgroundAlpha: 0, antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 1.75), preference: 'webgl',
      powerPreference: 'high-performance', autoStart: false });
    initialized = true;
    if (options.signal.aborted) { app.destroy(true); return null; }
    const textures = await Promise.all(assetNames.map(name => Assets.load<Texture>(`${options.assetBase}/${name}`)));
    textures.forEach(texture => { texture.source.autoGenerateMipmaps = true; texture.source.scaleMode = 'linear'; });
    if (options.signal.aborted) { app.destroy(true); return null; }
    return setup(app, host, textures, options);
  } catch (error) {
    if (initialized) app.destroy(true, { children: true });
    if (options.signal.aborted) return null;
    throw error;
  }
}

function setup(app: Application, host: HTMLElement, textures: Texture[], options: {
  style: PondStyle; paused: boolean; onStats: (stats: PondStats) => void;
}): PondRenderer {
  host.appendChild(app.canvas);
  app.canvas.setAttribute('aria-hidden', 'true');
  const model = createPond();
  const world = new Container(), submerged = new Container();
  const shadows = new Container(), objects = new Container(), floating = new Container();
  objects.sortableChildren = true;
  const reeds = new Graphics(), waterMarks = new Graphics(), padWaterlines = new Graphics();
  reeds.zIndex = 25;
  const paper = new Graphics().rect(0,0,WORLD.width,WORLD.height).fill(0xf6f2e9);
  const bed = new Sprite(textures[0]); bed.width=WORLD.width; bed.height=WORLD.height;
  submerged.addChild(paper,bed,shadows,objects);
  objects.addChild(reeds);
  world.addChild(submerged,floating,waterMarks);
  floating.addChild(padWaterlines);
  app.stage.addChild(world);
  const water = createWater(), ink = createInk();
  const shadowSoftness=new BlurFilter({strength:5,quality:3,resolution:1});
  shadows.filters=[shadowSoftness];


  submerged.filters = [water.filter];
  floating.filters = [ink.filter];

  const ownedTextures: Texture[] = [];
  const frame = (atlas: Texture, x:number,y:number,width:number,height:number) => {
    const result=new Texture({source:atlas.source,frame:new Rectangle(x,y,width,height)});
    ownedTextures.push(result); return result;
  };
  const rows = [[0,376,217],[384,279,151],[689,329,158]];
  const rigs: Rig[] = model.fish.map((_,i) => {
    const [y,height,centerY]=rows[i];
    const mesh = new MeshPlane({ texture:frame(textures[1],120,y,1310,height),verticesX:57,verticesY:15 });
    const shadow = new Mesh({geometry:mesh.geometry,texture:mesh.texture});
    const pigment = createPigment(i===1);
    mesh.filters=[pigment.filter];
    shadow.tint=0x244a3b; shadow.alpha=.23;
    objects.addChild(mesh); shadows.addChild(shadow);
    return {mesh,shadow,centerY,height,pigment};
  });

  const half=textures[2].width/2;
  const propTextures = [frame(textures[2],0,0,half,half),frame(textures[2],half,0,half,half),
    frame(textures[2],0,half,half,half),frame(textures[2],half,half,half,half)];
  const rockData = [[1245,800,250,-.3],[1360,737,170,.6],[1130,881,112,-.9],[1340,908,138,.25],[205,770,85,1.1]];
  for(const [x,y,size,rotation] of rockData) {
    const rock=new Sprite(propTextures[3]); rock.anchor.set(.5); rock.position.set(x,y);
    rock.width=size; rock.height=size*.9; rock.rotation=rotation; rock.tint=0xc9d9c5;
    rock.zIndex=10; objects.addChild(rock);
    const shadow=new Sprite(propTextures[3]); shadow.anchor.set(.5); shadow.position.set(x+8,y+15);
    shadow.width=size;shadow.height=size*.9;shadow.rotation=rotation;shadow.tint=0x254630;shadow.alpha=.32;
    shadows.addChild(shadow);
  }
  const padData = [[268,199,243,0,.1],[431,151,142,1,-.7],[170,355,169,0,1.5],
    [369,323,127,1,.5],[234,326,141,2,.1],[1279,235,103,1,-1.1],
    [1218,191,58,0,.6],[1323,291,67,1,-2.2]];
  const pads=padData.map(([x,y,size,kind,rotation],i) => {
    const sprite=new Sprite(propTextures[kind]);sprite.anchor.set(.5);sprite.width=size;sprite.height=size;
    sprite.position.set(x,y);sprite.rotation=rotation;
    sprite.tint=kind===2?0xffffff:(i%2===0?0xe7efdb:0xf0edda);floating.addChild(sprite);
    const shadow=new Sprite(propTextures[kind]);shadow.anchor.set(.5);shadow.width=size;shadow.height=size;
    shadow.tint=0x284c3f;shadow.alpha=kind===2?.18:.27;shadows.addChild(shadow);
    return {sprite,shadow,x,y,size,kind,rotation,phase:i*1.7};
  });

  const petals=Array.from({length:7},(_,i)=>{
    const petal=new Graphics().moveTo(-8,0).bezierCurveTo(-2,-9,11,-5,9,1)
      .bezierCurveTo(6,7,-3,5,-8,0).fill({color:i%3===0?0xdfb8a4:0xf1d4cc,alpha:.9})
      .moveTo(-6,0).quadraticCurveTo(0,-1,6,1).stroke({color:0xb78079,width:.65,alpha:.45});
    const x=410+(i*173)%730,y=285+(i*137)%465;
    petal.scale.set(.72+(i%3)*.17);floating.addChild(petal);
    return {petal,x,y,phase:i*2.3};
  });

  let style=options.style, paused=options.paused, disposed=false, isVisible=true;
  let sketch=style==='watercolor'?0:1,blue=style==='blue'?1:0;
  let statsTimer=0, averageFps=60;
  const syncTicker=()=>{if(!document.hidden&&isVisible)app.start();else app.stop();};
  const resize=()=>{
    if(disposed)return;
    const width=Math.max(1,host.clientWidth);
    app.renderer.resize(width,width*2/3);world.scale.set(width/WORLD.width);
    submerged.filterArea=new Rectangle(0,0,WORLD.width,WORLD.height);
    draw(0);app.render();
  };
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  const visibilityObserver=new IntersectionObserver(([entry])=>{isVisible=entry.isIntersecting;syncTicker();},{rootMargin:'100px'});
  visibilityObserver.observe(host);
  document.addEventListener('visibilitychange',syncTicker);

  function draw(dt:number) {
    sketch+=((style==='watercolor'?0:1)-sketch)*Math.min(1,dt*5);
    blue+=((style==='blue'?1:0)-blue)*Math.min(1,dt*5);
    bed.alpha=1-sketch;
    shadows.alpha=1-sketch*.93;
    ink.update(sketch,blue);
    water.update(model,app.screen.width,app.screen.height,sketch,blue);
    model.fish.forEach((fish,i)=>updateFish(rigs[i],fish,sketch));
    padWaterlines.clear();
    pads.forEach(pad=>{
      let bob=0;
      for(const r of model.ripples){
        const d=Math.hypot(pad.x-r.x,pad.y-r.y)-r.age*170;
        bob+=Math.sin(d*.07)*Math.exp(-d*d/4900)*Math.exp(-r.age*.7)*r.strength*3;
      }
      const t=model.time;
      pad.sprite.position.set(pad.x+Math.sin(t*.32+pad.phase)*3.5+ bob,pad.y+Math.cos(t*.25+pad.phase)*2.5+bob*.4);
      pad.sprite.rotation=pad.rotation+Math.sin(t*.27+pad.phase)*.025+bob*.005;
      pad.shadow.position.set(pad.sprite.x+8,pad.sprite.y+13);pad.shadow.rotation=pad.sprite.rotation;
      if(pad.kind!==2){
        const x=pad.sprite.x,y=pad.sprite.y,r=pad.size*.43;
        const breath=Math.sin(t*.38+pad.phase)*1.7;
        // Short, disconnected menisci keep the leaves sitting on the surface.
        padWaterlines.moveTo(x-r*.92,y+r*.46+breath)
          .bezierCurveTo(x-r*.77,y+r*.85+breath,x-r*.30,y+r*1.05,x+r*.06,y+r*.99)
          .stroke({width:1.5,color:0xe9ecd5,alpha:.34});
        padWaterlines.moveTo(x+r*.53,y-r*.80-breath)
          .quadraticCurveTo(x+r*.98,y-r*.47,x+r*1.01,y-r*.09)
          .stroke({width:1,color:0x658879,alpha:.28});
      }
    });
    petals.forEach(({petal,x,y,phase})=>{
      const t=model.time;
      let px=x+Math.sin(t*.045+phase)*45,py=y+Math.cos(t*.038+phase)*27,spin=0;
      for(const r of model.ripples){
        const dx=px-r.x,dy=py-r.y,d=Math.hypot(dx,dy)||1,front=d-r.age*170;
        const push=Math.exp(-front*front/5200)*Math.exp(-r.age*.7)*r.strength*12;
        px+=dx/d*push;py+=dy/d*push;spin+=push*.025;
      }
      petal.position.set(px,py);petal.rotation=phase+t*.026+Math.sin(t*.18+phase)*.16+spin;
    });
    drawReeds(reeds,model.time);
    drawSurface(waterMarks,model,sketch,blue);
  }
  function report(){options.onStats({time:model.time,ripples:model.ripples.filter(r=>r.strength>.3).length,fps:averageFps});}
  app.ticker.maxFPS=60;
  app.ticker.add(ticker=>{
    const dt=Math.min(ticker.deltaMS/1000,.05);
    if(!paused)step(model,dt);
    draw(dt);
    averageFps+=(Math.min(60,1000/Math.max(ticker.elapsedMS,1))-averageFps)*.025;
    statsTimer+=dt;if(statsTimer>.5){statsTimer=0;report();}
    if(paused&&Math.abs(sketch-(style==='watercolor'?0:1))<.001&&Math.abs(blue-(style==='blue'?1:0))<.001){report();app.stop();}
  });
  resize();syncTicker();report();
  return {
    setStyle(value){style=value;syncTicker();},
    setPaused(value){paused=value;syncTicker();},
    disturb(point={x:790,y:520},strength=1.3){ripple(model,point,strength,strength>.65);report();draw(0);app.render();},
    feed(point){if(paused)return;feed(model,point);draw(0);app.render();},
    destroy(){
      disposed=true;resizeObserver.disconnect();visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange',syncTicker);app.stop();
      const geometries=rigs.map(r=>r.mesh.geometry);
      submerged.filters=null;objects.filters=null;floating.filters=null;shadows.filters=null;
      water.filter.destroy();ink.filter.destroy();shadowSoftness.destroy();
      rigs.forEach(r=>{r.mesh.filters=null;r.pigment.filter.destroy();});
      app.destroy(true,{children:true,texture:false,textureSource:false});
      geometries.forEach(g=>g.destroy());ownedTextures.forEach(t=>t.destroy(false));
    },
  };
}

function updateFish(rig:Rig,fish:Fish,sketch:number){
  const positions=rig.mesh.geometry.getBuffer('aPosition').data as Float32Array;
  const spine=fish.spine, count=spine.length;
  const depthScale=1.015-fish.depth*.07;
  for(let col=0;col<57;col++){
    const u=col/56,at=u*(count-1),a=Math.min(count-2,Math.floor(at)),blend=at-a;
    const p=spine[a],q=spine[a+1];
    let cx=p.x+(q.x-p.x)*blend,cy=p.y+(q.y-p.y)*blend;
    const before=spine[Math.max(0,a-1)],after=spine[Math.min(count-1,a+2)];
    const tangent=Math.atan2(after.y-before.y,after.x-before.x);
    const nx=-Math.sin(tangent),ny=Math.cos(tangent);
    const travel=Math.pow(clamp((u-.13)/.87,0,1),1.65);
    const wave=Math.sin(fish.phase-u*7.1)*travel*fish.length*(.012+fish.effort*.034);
    cx+=nx*wave;cy+=ny*wave;
    for(let row=0;row<15;row++){
      const v=row/14;
      let across=(v*rig.height-rig.centerY)/1310*fish.length;
      const fin=Math.exp(-Math.pow((u-.215)/.08,2));
      const finEdge=clamp((Math.abs(across)-fish.length*.055)/(fish.length*.035),0,1);
      const paddle=Math.sin(fish.phase*.66+Math.sign(across)*1.1+fish.id*.7)*fin*finEdge;
      // Open the translucent fins without widening the body or tail peduncle.
      const tailFan=clamp((u-.81)/.19,0,1);
      across*=1+fin*finEdge*.15+tailFan*tailFan*.20+paddle*.24;
      const along=paddle*Math.abs(across)*.16;
      const index=(row*57+col)*2;
      positions[index]=fish.x+(cx+nx*across+Math.cos(tangent)*along-fish.x)*depthScale;
      positions[index+1]=fish.y+(cy+ny*across+Math.sin(tangent)*along-fish.y)*depthScale;
    }
  }
  rig.mesh.geometry.getBuffer('aPosition').update();
  rig.pigment.update(sketch,fish.depth);
  rig.mesh.alpha=1-fish.depth*.045*(1-sketch);
  rig.mesh.zIndex=100-fish.depth*30;
  rig.mesh.tint=0xffffff;
  rig.shadow.position.set(7+fish.depth*12,10+fish.depth*20);
  rig.shadow.alpha=.21-fish.depth*.10;
}

function drawReeds(g:Graphics,time:number){
  g.clear();
  const clusters=[{x:1390,y:914,n:10,length:260,sign:-1},{x:138,y:738,n:7,length:175,sign:1}];
  clusters.forEach((c,k)=>{
    for(let i=0;i<c.n;i++){
      const f=i/(c.n-1),phase=i*1.93+k*3;
      const x=c.x+(f-.5)*63,y=c.y+Math.sin(phase)*24;
      const sway=Math.sin(time*.7+phase)*9+Math.sin(time*.23+i)*6;
      const tx=x+c.sign*(28+f*120)+sway,ty=y-c.length*(.52+.48*Math.sin(1+f*1.5));
      const width=5+Math.sin(i*2.4)*2;
      g.moveTo(x,y).bezierCurveTo(x-width*2,y-70,tx-c.sign*30,ty+55,tx,ty)
        .bezierCurveTo(tx+c.sign*8,ty+70,x+width*2,y-85,x,y)
        .fill({color:i%3===0?0x486548:0x294c3e,alpha:.76});
      g.moveTo(x,y).quadraticCurveTo(x+sway*.5,y-95,tx,ty)
        .stroke({width:.8,color:0xabb98b,alpha:.4});
    }
  });
}

function drawSurface(g:Graphics,model:PondState,sketch:number,blue:number){
  g.clear();
  for(const food of model.food){
    const alpha=clamp(food.age*5,0,1)*clamp((24-food.age)/3,0,1);
    const y=food.y+Math.sin(model.time*1.3+food.id)*1.1;
    const color=sketch>.5?(blue>.5?0x567fa1:0x77736b):0xb58a46;
    g.ellipse(food.x,y,3.8,2.7).fill({color,alpha:alpha*.85});
    g.moveTo(food.x-1.5,y-1).lineTo(food.x+.8,y-1.4).stroke({width:.8,color:0xf7eed5,alpha:alpha*.65});
  }
  // A fleeting meniscus at the point of contact, not a stack of drawn circles.
  for(const r of model.ripples){
    if(r.strength<.4||r.age>.65)continue;
    const fade=(1-r.age/.65)*r.strength;
    const radius=3+r.age*28;
    g.circle(r.x,r.y,radius).stroke({width:1.2,color:sketch>.5?(blue>.5?0x467799:0x686b61):0xe6f5d7,alpha:fade*.45});
  }
  if(sketch<.8){
    // Broken, asymmetric brush glints drift along the flanks with each stroke.
    for(const fish of model.fish){
      const movement=clamp((fish.speed-28)/105,0,1);
      for(let j=0;j<3;j++){
        const phase=model.time*.68+fish.id*1.73+j*2.3;
        const fade=Math.pow(Math.max(0,Math.sin(phase)),2);
        const at=5+j*5,p=fish.spine[at],q=fish.spine[at+2];
        const angle=Math.atan2(q.y-p.y,q.x-p.x),tx=Math.cos(angle),ty=Math.sin(angle);
        const side=j===1?-1:1,offset=fish.length*(j===0?.105:.082)+Math.sin(phase)*3;
        const nx=-ty*side,ny=tx*side;
        const x=p.x+nx*offset,y=p.y+ny*offset,length=11+j*4;
        const alpha=fade*movement*(1-sketch)*(.22-fish.depth*.08);
        g.moveTo(x-tx*length*.5,y-ty*length*.5)
          .quadraticCurveTo(x+nx*2.5,y+ny*2.5,x+tx*length*.5,y+ty*length*.5)
          .stroke({width:1.5+j*.3,color:0xf4efda,alpha,cap:'round'});
      }
    }
    for(let i=0;i<17;i++){
      const x=285+(i*127.71)%980+Math.sin(model.time*.14+i)*12;
      const y=220+(i*91.23)%575+Math.cos(model.time*.11+i)*9;
      g.circle(x,y,.65+(i%3)*.35).fill({color:0xeaf1d5,alpha:(.07+Math.sin(model.time*.4+i)*.025)*(1-sketch)});
    }
  }
}



