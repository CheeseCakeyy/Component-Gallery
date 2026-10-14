/* One articulated 3D dragon, rasterized directly to a low-resolution pixel buffer. */
(function(global){
'use strict';
const TAU=Math.PI*2;
const color=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const palettes={skin:['#080e19','#101725','#192130','#273043','#3b4254'].map(color),wing:['#0b1120','#151c2c','#24283b','#353247','#514052'].map(color),gold:['#61452f','#94653c','#be8b4c','#e4b46d','#ffe1a0'].map(color),bone:['#161a27','#292b3a','#454050','#706071','#a17c78'].map(color),eye:['#ffda74','#ffda74','#fff0bb','#fff0bb','#fff0bb'].map(color)};
const lerp=(a,b,t)=>a+(b-a)*t;
const vlerp=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function rand(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
class PixelFlight{
 constructor(w,h){this.resize(w,h);this.clouds=Array.from({length:25},(_,i)=>({x:rand(i+3),y:rand(i+29),size:18+rand(i+11)*55,layer:i%3,seed:i+8}));this.makeTerrain();}
 resize(w,h){this.w=w;this.h=h;this.pixels=new Uint8ClampedArray(w*h*4);this.background=new Uint8ClampedArray(w*h*4);this.depth=new Float32Array(w*h);}
 pixel(x,y,c){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=this.w||y>=this.h)return;const k=(y*this.w+x)*4;this.pixels[k]=c[0];this.pixels[k+1]=c[1];this.pixels[k+2]=c[2];this.pixels[k+3]=255;}
 rect(x,y,w,h,c){x=Math.round(x);y=Math.round(y);for(let yy=Math.max(0,y);yy<Math.min(this.h,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(this.w,x+w);xx++){const k=(yy*this.w+xx)*4;this.pixels[k]=c[0];this.pixels[k+1]=c[1];this.pixels[k+2]=c[2];this.pixels[k+3]=255;}}
 sky(t,cam){
 const u=Math.max(0,Math.min(1,(Math.abs(cam.elevation)-.23)/.93)),blend=u*u*(3-2*u);
 if(blend<1){this.sideSky(t,cam);if(blend>0)this.background.set(this.pixels);}
 if(blend>0){if(cam.elevation>0)this.groundSky(t,cam);else this.overheadSky(t,cam);
 if(blend<1)for(let i=0;i<this.pixels.length;i+=4)for(let k=0;k<3;k++)this.pixels[i+k]=Math.round(lerp(this.background[i+k],this.pixels[i+k],blend));}
 }
 makeTerrain(){
 // Seamless aerial landscape, sampled in world coordinates as the dragon advances.
 const n=768;this.terrainSize=n;this.terrain=new Uint8Array(n*n*3);
 const water=['#315967','#3a6874','#447984'].map(color),land=['#465f57','#536c5b','#61785e','#74856a','#8c9476'].map(color);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
 const river=n*.48+Math.sin(z/n*TAU)*72+Math.sin(z/n*TAU*3+.7)*21;
 const dist=Math.abs(x-river),width=16+Math.sin(z/n*TAU*2)*7;
 const h=Math.sin(x/n*TAU*3+Math.sin(z/n*TAU*2))*Math.cos(z/n*TAU*3)+Math.sin((x+z)/n*TAU*7)*.2;
 const cellX=Math.floor(x/6),cellZ=Math.floor(z/6),hash=(Math.imul(cellX,374761393)^Math.imul(cellZ,668265263))>>>0;
 const treeX=1+hash%3,treeZ=1+(hash>>>4)%3,tree=Math.abs(x%6-treeX)+(Math.abs(z%6-treeZ)*.6)<1.7;
 const grain=((Math.imul(x,374761393)^Math.imul(z,668265263))>>>0)%19;
 let c=land[Math.max(0,Math.min(4,Math.floor((h+1.2)*1.8)))];
 if(dist<width)c=water[dist<width*.55?0:dist<width*.83?1:2];
 else if(dist<width+3)c=[165,155,112];
 else if(h<.3&&tree)c=z%6<treeZ?[68,100,74]:[49,80,66];
 else if(h>.9&&grain<4)c=[167,167,133];
 const k=(z*n+x)*3;this.terrain[k]=c[0];this.terrain[k+1]=c[1];this.terrain[k+2]=c[2];
 }
 }
 groundSky(t,cam){
 const w=this.w,h=this.h,n=this.terrainSize,cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),pitch=Math.max(.3,Math.sin(cam.elevation)),step=1.45/cam.zoom;
 for(let y=0;y<h;y++){const py=(y-h*.5)*step/pitch;for(let x=0;x<w;x++){
 const px=(x-w*.5)*step;const wx=px*cy-py*sy+n*.47,wz=px*sy+py*cy-t*44+n*.38;
 const ix=((Math.floor(wx)%n)+n)%n,iz=((Math.floor(wz)%n)+n)%n,k=(iz*n+ix)*3,q=(y*w+x)*4;
 this.pixels[q]=this.terrain[k];this.pixels[q+1]=this.terrain[k+1];this.pixels[q+2]=this.terrain[k+2];this.pixels[q+3]=255;
 }}
 this.cloudDeck(t,cam,false);
 }
 overheadSky(t,cam){
 const w=this.w,h=this.h;for(let y=0;y<h;y++){
 const f=Math.floor(y/h*14)/14,c=[lerp(39,102,f),lerp(47,84,f),lerp(79,124,f)];this.rect(0,y,w,1,c);
 }
 // Sparse distant stars stay fixed while nearby cloud layers sweep overhead.
 for(let i=0;i<65;i++){const x=((rand(i+971)*w-cam.yaw*17)%w+w)%w,y=rand(i+445)*h;this.pixel(x,y,i%7===0?[226,207,201]:[136,145,174]);}
 this.cloudDeck(t,cam,true);
 }
 cloudDeck(t,cam,below){
 const w=this.w,h=this.h,cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),pitch=Math.sin(cam.elevation);
 // Three cloud altitudes have different speeds and sizes; all move in world +Z.
 for(let layer=0;layer<3;layer++){
 const spacing=layer===0?155:layer===1?230:340,speed=layer===0?30:layer===1?57:94;
 const travel=t*speed,cz=Math.floor(-travel/spacing),range=Math.ceil(Math.hypot(w,h)/spacing)+2;
 for(let iz=cz-range;iz<=cz+range;iz++)for(let ix=-range;ix<=range;ix++){
 const seed=ix*37+iz*151+layer*419;
 if(rand(seed+21)<(below?.4:.56))continue;
 const wx=ix*spacing+(rand(seed+3)-.5)*spacing*.7,wz=iz*spacing+travel+(rand(seed+12)-.5)*spacing*.7;
 const sx=w*.5+wx*cy+wz*sy,syScreen=h*.5+(wz*cy-wx*sy)*pitch;
 const radius=(20+rand(seed+91)*28)*(1+layer*.45);
 if(sx<-radius*3||sx>w+radius*3||syScreen<-radius*2||syScreen>h+radius*2)continue;
 if(!below)this.cloudMass(sx+13,syScreen+20,radius,seed,layer,true);
 this.cloudMass(sx,syScreen,radius,seed,layer,false,below);
 }
 }
 }
 cloudMass(x,y,r,seed,layer,shadow=false,below=false){
 const palette=below?[[95,86,125],[132,111,147],[171,144,169]]:[[142,165,158],[184,199,181],[222,223,197]];
 const lobes=[];for(let i=0;i<5;i++)lobes.push([x+(i-2)*r*.38,y+Math.sin(i*2+seed)*r*.18,r*(.47+rand(seed+i)*.24)]);
 for(const [cx,cy,rad] of lobes){for(let yy=-rad*.7;yy<rad*.7;yy+=2){const half=Math.floor(Math.sqrt(Math.max(0,1-(yy/(rad*.72))**2))*rad/2)*2;const left=Math.round((cx-half)/2)*2,top=Math.round((cy+yy)/2)*2;
 if(shadow){for(let py=Math.max(0,top);py<Math.min(this.h,top+2);py++)for(let px=Math.max(0,left);px<Math.min(this.w,left+half*2);px++){const k=(py*this.w+px)*4;this.pixels[k]=Math.round(this.pixels[k]*.88);this.pixels[k+1]=Math.round(this.pixels[k+1]*.88);this.pixels[k+2]=Math.round(this.pixels[k+2]*.92);}}
 else{const band=yy<-rad*.3?2:yy<rad*.25?1:0;const c=palette[band].map(v=>v+(layer-1)*7);this.rect(left,top,half*2,2,c);}
 }}
 }
 sideSky(t,cam){
 const w=this.w,h=this.h;const bands=['#26263f','#32304c','#463750','#634357','#8b545e','#b77670','#d99b83','#ebbd98'].map(color);
 for(let y=0;y<h;y++){const v=Math.min(6.99,y/h*6.7+.4),i=Math.floor(v),f=Math.floor((v-i)*4)/4;const c=bands[i].map((n,k)=>Math.round(lerp(n,bands[i+1][k],f)));this.rect(0,y,w,1,c);}
 const sx=w*.77-cam.yaw*8,sy=h*.34+cam.elevation*4,r=Math.min(w,h)*.145;
 for(let y=-r;y<r;y++){const half=Math.floor(Math.sqrt(r*r-y*y));if(y>r*.28&&Math.floor(y)%9>5)continue;this.rect(sx-half,sy+y,half*2,1,y<0?[249,210,155]:[239,178,133]);}
 for(let i=0;i<45;i++){const x=(rand(i+95)*w-cam.yaw*4+w)%w,y=rand(i+173)*h*.33;this.pixel(x,y,[132,112,140]);if(i%11===0){this.pixel(x+1,y,[208,163,164]);this.pixel(x,y+1,[208,163,164]);}}
 for(let layer=0;layer<3;layer++)for(const c of this.clouds){if(c.layer!==layer)continue;const speed=4+layer*8;const x=((c.x*(w+220)+t*speed*Math.sin(cam.yaw)-cam.yaw*13)%(w+220)+w+220)%(w+220)-110;const y=((c.y*(h+110)+t*speed*Math.sin(cam.elevation)*Math.cos(cam.yaw))%(h+110)+h+110)%(h+110)-35;this.cloud(x,y,c.size*(.7+layer*.2),c.seed,layer);}
 }
 cloud(x,y,size,seed,layer){
 const cols=[[[76,59,83],[113,75,94],[167,110,119]],[[99,70,89],[148,94,108],[203,142,140]],[[161,105,116],[204,145,143],[239,185,163]]][layer];
 const lobes=[];for(let i=0;i<6;i++)lobes.push([x+size*i/6,y-rand(seed+i*3)*size*.11,size*(.15+rand(seed+i)*.08)]);
 const ellipse=(cx,cy,r,c)=>{for(let yy=-r*.6;yy<r*.5;yy+=3){const half=Math.floor(Math.sqrt(Math.max(0,1-(yy/(r*.65))**2))*r/3)*3;this.rect(Math.round((cx-half)/3)*3,Math.round((cy+yy)/3)*3,half*2,3,c);}};
 for(const [cx,cy,r] of lobes)ellipse(cx,cy+4,r,cols[0]);
 for(const [cx,cy,r] of lobes)ellipse(cx,cy,r*.91,cols[1]);
 for(const [cx,cy,r] of lobes)this.rect(cx-r*.45,cy-r*.47,r*.75,3,cols[2]);
 this.rect(x-size*.17,y+size*.08,size*1.27,3,cols[0]);this.rect(x+size*.06,y+size*.13,size*.84,2,cols[0]);
 }
 tri(a,b,c,material='skin',bias=0){this.tris.push({a,b,c,material,bias,part:this.part||'body'});}
 tube(points,radii,material='skin',sides=8){
 const rings=points.map((p,j)=>{const prev=points[Math.max(0,j-1)],next=points[Math.min(points.length-1,j+1)],d=next.map((n,i)=>n-prev[i]);const length=Math.hypot(...d)||1;const tangent=d.map(n=>n/length);let side=[tangent[2],0,-tangent[0]];let sl=Math.hypot(...side);if(sl<.001){side=[1,0,0];sl=1;}side=side.map(n=>n/sl);const up=[tangent[1]*side[2]-tangent[2]*side[1],tangent[2]*side[0]-tangent[0]*side[2],tangent[0]*side[1]-tangent[1]*side[0]];const rad=Array.isArray(radii[j])?radii[j]:[radii[j],radii[j]];return Array.from({length:sides},(_,i)=>{const a=i/sides*TAU;return p.map((n,k)=>n+side[k]*Math.cos(a)*rad[0]+up[k]*Math.sin(a)*rad[1]);});});
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){const k=(i+1)%sides;this.tri(rings[j][i],rings[j+1][i],rings[j+1][k],material);this.tri(rings[j][i],rings[j+1][k],rings[j][k],material);}
 for(let i=0;i<sides;i++){this.tri(points[0],rings[0][(i+1)%sides],rings[0][i],material);const n=rings.length-1;this.tri(points[n],rings[n][i],rings[n][(i+1)%sides],material);}
 }
 spike(base,tip,r,mat='gold'){this.tube([base,tip],[r,.08],mat,5);}
 dragon(t,bank=0){
 this.tris=[];this.part='body';const phase=t*TAU*.78;
 const lap=t%12,glide=smooth((lap-8)/.8)*(1-smooth((lap-10.3)/1.2));
 this.motion={t,phase,glide,bank};
 this.bob=(Math.sin(phase-.9)*3.3+Math.sin(phase*2-.4)*.65)*(1-glide*.75)+Math.sin(t*.85)*1.4;
 this.tube([[0,0,35],[0,0,24],[0,1,10],[0,2,-4],[0,4,-17],[0,6,-29],[0,8,-41],[0,8,-52],[0,6,-61]],[[3,3],[5,5],[8,6],[10,7],[8,6],[5,5],[4,4],[5,4],[2,2]],'skin',10);
 this.tube([[0,8,-48],[0,8,-54],[0,6,-62],[0,5.5,-68]],[[4,4],[6,4.5],[4.2,2.5],[3,2]],'skin',8);
 this.tube([[0,3,-50],[0,2.7,-59],[0,3.5,-67]],[[3,1.2],[3,1.2],[1,1]],'bone',6);
 for(const s of [-1,1]){
 this.tube([[s*3,10,-48],[s*7,16,-41],[s*10,20,-37]],[2.3,1.2,.05],'bone',6);this.spike([s*4,7,-53],[s*10,10,-45],2,'skin');
 this.tube([[s*3.8,11.7,-54],[s*3.3,10.2,-59]],[.8,.55],'eye',4);
 this.tube([[s*5.65,8.8,-54],[s*5.1,8,-57]],[.65,.4],'eye',4);
 this.part='hindleg';
 this.tube([[s*5,-1,17],[s*13,-6,23],[s*10,-9,33],[s*14,-8,36]],[3.2,3,1.7,1.2],'skin',6);
 for(let c=0;c<3;c++)this.spike([s*(12+c*1.5),-8,34],[s*(12+c*1.7),-9,40],.7,'gold');
 this.part='foreleg';
 this.tube([[s*7,0,-14],[s*13,-5,-5],[s*10,-9,1]],[2.4,1.6,1],'skin',6);
 for(let c=0;c<3;c++)this.spike([s*(9+c),-9,1],[s*(9+c),-9,5],.6,'gold');
 this.part='body';
 }
 for(let z=-30;z<27;z+=5){const width=z<0?3.5:4.5;const yy=z<-20?10:z<0?9:7;this.tri([-width,yy,z],[0,yy+1,z+4],[width,yy,z],'gold',.1);}
 for(let z=-35;z<30;z+=7)this.spike([0,z<-20?10:8,z],[0,z<-20?15:13,z+3],1.7,'gold');
 this.tri([-2,10,-9],[-20,5,1],[-15,6,-12],'gold');this.tri([-2,10,-9],[-9,8,-20],[-15,6,-12],'gold');
 this.tri([2,10,-9],[20,5,1],[15,6,-12],'gold');this.tri([2,10,-9],[9,8,-20],[15,6,-12],'gold');
 for(let z=-27;z<27;z+=5){const yy=z<-17?1:-5;this.tri([-3,yy,z],[3,yy,z],[0,yy-1,z+4],'gold',-.1);}
 this.part='tail';
 const tail=[],radii=[];for(let i=0;i<=25;i++){const f=i/25;let x=Math.sin(f*6-phase*.65)*f*f*11+bank*f*f*28,z=31+f*70,y=Math.sin(f*6-phase*.8)*f*6;if(f>.55){const curl=Math.PI*(1.5+.22*Math.sin(t*.9)),a=(f-.55)/.45*curl,r=18+3*Math.sin(t*1.1);x+=r*(1-Math.cos(a));z=69.5+r*Math.sin(a);}tail.push([x,y,z]);radii.push(Math.max(.65,3.5*(1-f)));}
 this.tube(tail,radii,'skin',7);const tip=tail[tail.length-1];this.tube([[tip[0],tip[1],tip[2]-3],[tip[0],tip[1],tip[2]],[tip[0],tip[1],tip[2]+4]],[2.5,4.5,.8],'skin',8);
 for(let i=0;i<7;i++){const a=i/7*TAU;this.spike([tip[0]+Math.cos(a)*3,tip[1],tip[2]+Math.sin(a)*3],[tip[0]+Math.cos(a)*7,tip[1]+1,tip[2]+Math.sin(a)*7],1.4,'bone');}
 this.part='wing';for(const s of [-1,1])this.wing(s,phase);
 // Apply each joint deformation once to shared mesh vertices, keeping seams closed.
 const visited=new Set();for(const tri of this.tris)for(const p of [tri.a,tri.b,tri.c])if(!visited.has(p)){visited.add(p);this.poseVertex(p,tri.part);}
 this.part='body';
 }
 poseVertex(p,part){
 const {t,phase,glide,bank}=this.motion;let [x,y,z]=p;
 if(part==='body'){
 const neck=smooth((-z-21)/34),turn=Math.sin(t*.73)*.07+bank*.14;
 const a=turn*neck;const dz=z+21;
 x=x*Math.cos(a)+dz*Math.sin(a);z=-21+dz*Math.cos(a);
 y+=neck*(Math.sin(phase-.9)*1.5+Math.sin(t*.83)*2);
 const chest=Math.max(0,1-Math.abs(z+4)/30);x*=1+chest*Math.sin(phase-.4)*.025;
 }
 if(part==='hindleg'||part==='foreleg'){
 const hind=part==='hindleg',root=hind?17:-14,weight=smooth((z-root)/19),lag=hind?1.6:.8;
 const flex=Math.sin(phase-lag+Math.sign(x)*.22)*(1-glide*.65);
 y+=weight*(flex*2.8+glide*2);z+=weight*(flex*1.8+Math.sin(t*1.1)*1.2);
 }
 // Small whole-body pitch and roll connect the strokes to lift and turns.
 const roll=Math.sin(t*.81)*.06+Math.sin(phase-.35)*.025*(1-glide)+bank;
 const pitch=Math.sin(phase-.7)*.028*(1-glide)+Math.sin(t*.6)*.018;
 const ry=y*Math.cos(pitch)-z*Math.sin(pitch),rz=y*Math.sin(pitch)+z*Math.cos(pitch);
 p[0]=x*Math.cos(roll)-ry*Math.sin(roll);p[1]=x*Math.sin(roll)+ry*Math.cos(roll);p[2]=rz;
 }
 stroke(cycle){const f=((cycle%1)+1)%1;return f<.36?lerp(.96,-.76,smooth(f/.36)):lerp(-.76,.96,smooth((f-.36)/.64));}
 wing(s,phase){
 const {t,glide,bank}=this.motion,cycle=phase/TAU+s*.009;
 const flap=lerp(this.stroke(cycle),.12,glide)+s*(Math.sin(t*.81)*.025+bank*.12);
 const bend=lerp(this.stroke(cycle-.095)*.32,.025*Math.sin(t*3+s),glide);
 const recovery=smooth((this.stroke(cycle+.018)-this.stroke(cycle-.018))/.24);
 const transform=([x,y,z])=>{const span=x-8,fold=Math.max(0,(span-25)/65),a=flap+bend*fold;
 const reach=span*(1-recovery*fold*.15*(1-glide)),flutter=Math.sin(phase*2.2-span*.075+s*.2)*fold*1.5;
 return[s*(8+reach*Math.cos(a)),y+reach*Math.sin(a)+flutter,z+fold*(Math.sin(phase-1)*8+recovery*7)*(1-glide*.75)];};
 const wrist=[38,1,-42];
 const edges=[[8,1,-15],[22,2,-29],[38,1,-42],[43,1,-52],[46,1,-37],[68,0,-18],[93,-1,8],[100,-1,20],[88,-2,17],[83,-3,19],[79,-3,26],[75,-2,43],[69,-3,34],[63,-4,30],[57,-3,32],[52,-2,43],[46,-3,32],[39,-4,27],[33,-3,28],[28,-2,36],[23,-3,24],[17,-3,20],[8,0,23]];
 const center=transform(wrist);
 for(let i=0;i<edges.length;i++){const a=transform(edges[i]),b=transform(edges[(i+1)%edges.length]);const mid=vlerp(a,b,.5);mid[1]-=1.6+Math.sin(phase*1.7-i*.52)*1.2;this.tri(center,a,mid,'wing',i%3===0?.1:0);this.tri(center,mid,b,'wing',i%3===0?.1:0);this.tube([a,b],[.43,.43],'skin',4);}
 this.tube([[8,3,-15],[23,3,-29],wrist].map(transform),[2.8,2.1,1.5],'skin',7);
 this.spike(transform([38,1,-42]),transform([43,1,-54]),1.5,'gold');
 const fingers=[[100,-1,20],[75,-2,43],[52,-2,43],[28,-2,36],[8,0,23]];
 for(let i=0;i<fingers.length;i++){const end=fingers[i],mid=vlerp(wrist,end,.52);mid[1]+=1.3;this.tube([wrist,mid,end].map(transform),[1.1,.7,.15],i===0?'gold':'bone',5);const branch=vlerp(mid,end,.45);branch[0]-=2;branch[2]-=2;this.tube([mid,branch].map(transform),[.35,.12],'gold',4);}
 }
 project(p,cam){const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),ce=Math.cos(cam.elevation),se=Math.sin(cam.elevation);const x=p[0]*cy+p[2]*sy,z=p[2]*cy-p[0]*sy,y=p[1]+this.bob;const depth=y*se+z*ce;const scale=Math.min(this.w/275,this.h/245)*cam.zoom,perspective=480/(480-depth);return[this.w*.5+x*scale*perspective,this.h*.48+(z*se-y*ce)*scale*perspective,depth];}
 raster(tri,cam){
 const a=this.project(tri.a,cam),b=this.project(tri.b,cam),c=this.project(tri.c,cam);
 const edge=(p,q,x,y)=>(x-p[0])*(q[1]-p[1])-(y-p[1])*(q[0]-p[0]);
 const area=edge(a,b,c[0],c[1]);if(Math.abs(area)<.015)return;
 const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(this.w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(this.h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
 const u=tri.b.map((v,i)=>v-tri.a[i]),v=tri.c.map((v,i)=>v-tri.a[i]);let nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0];const len=Math.hypot(nx,ny,nz)||1;
 const light=Math.abs((nx*.25+ny*.85-nz*.45)/len),shade=Math.max(0,Math.min(3.95,.6+light*2.8+tri.bias)),pal=palettes[tri.material];
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const w0=edge(b,c,x+.5,y+.5)/area,w1=edge(c,a,x+.5,y+.5)/area,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;const d=w0*a[2]+w1*b[2]+w2*c[2],k=y*this.w+x;if(d<this.depth[k])continue;this.depth[k]=d;const base=Math.floor(shade),dither=((x&1)+(y&1)*2)/4,col=pal[Math.min(4,base+(shade-base>dither?1:0))],q=k*4;this.pixels[q]=col[0];this.pixels[q+1]=col[1];this.pixels[q+2]=col[2];}
 }
 render(t,cam={yaw:0,elevation:1.48,zoom:1}){this.sky(t,cam);this.depth.fill(-Infinity);this.dragon(t,cam.bank||0);for(const tri of this.tris)this.raster(tri,cam);return this.pixels;}
}
global.PixelFlight=PixelFlight;if(typeof module!=='undefined')module.exports=PixelFlight;
})(typeof window!=='undefined'?window:globalThis);
