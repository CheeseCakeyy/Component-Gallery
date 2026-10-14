import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlowers } from '../src/scene/Flowers.js';
import { CoordinateMapper } from '../src/utils/CoordinateMapper.js';
import { AssetLoader } from '../src/utils/AssetLoader.js';
import { RippleSimulation } from '../src/water/RippleSimulation.js';
import { waterSettings } from '../src/config/scene.js';

test('flower asset swaps preserve UV placement and physics while respecting texture proportions', async () => {
  const scene = new THREE.Scene(), mapper = new CoordinateMapper(1600,900);
  let height = .1;
  const simulation = {
    sample(u,v,out) { Object.assign(out,{height,dx:height*3,dy:height*2,velocity:height}); },
    sampleMask() { return 1; },
  };
  const requested=[];
  const loader={async texture(path) {
    requested.push(path);
    return new THREE.Texture({width:path==='wide.webp'?200:100,height:100});
  }};
  const base={id:'test',uv:[.4,.6],scale:.12,rotation:.2};
  for(const asset of ['wide.webp','square.webp']) {
    const flowers=await createFlowers(scene,[{...base,asset}],loader,mapper,simulation);
    const flower=scene.children.find(item=>item.renderOrder===3);
    assert.equal(flower.geometry.parameters.width,asset==='wide.webp'?.24:.12);
    flowers.update(0);
    assert.equal(flower.position.x,(.4-.5)*mapper.aspect);
    assert.ok(Math.abs(flower.position.y-(.5-.6))<1e-10);
    height=.1;
    for(let i=0;i<120;i++)flowers.update(1/120);
    assert.ok(Math.abs(flower.rotation.x)>0 && Math.abs(flower.rotation.x)<.1);
    const displaced=Math.abs(flower.rotation.x);
    height=0;
    for(let i=0;i<1200;i++)flowers.update(1/120);
    assert.ok(Math.abs(flower.rotation.x)<displaced*.01);
    flowers.dispose();
    assert.equal(scene.children.length,0);
  }
  assert.deepEqual(requested,['wide.webp','square.webp']);
});

test('mismatched image and mask dimensions are rejected before rendering', async () => {
  const loader=new AssetLoader();
  loader.texture=async path=>({image:path==='image'?{width:100,height:50}:{width:50,height:50}});
  await assert.rejects(loader.environment({image:'image',waterMask:'mask'}),/identical pixel dimensions/);
});

test('an actual traveling ripple makes a foreground flower bob and turn, then settle', async () => {
  const scene=new THREE.Scene(),mapper=new CoordinateMapper(1000,1000);
  const sim=new RippleSimulation(1,()=>1,{...waterSettings,resolution:96});
  sim.microHeight=()=>0;
  const flowers=await createFlowers(scene,[{id:'side',asset:'side.png',uv:[.55,.5],scale:.1,rotation:.2}],
    {texture:async()=>new THREE.Texture({width:100,height:100})},mapper,sim);
  flowers.update(0);
  const mesh=scene.children.find(o=>o.renderOrder===3);
  sim.disturb(.5,.5,.13);
  let peakTurn=0,peakBob=0;
  for(let i=0;i<360;i++){sim.update(1/120);flowers.update(1/120);peakTurn=Math.max(peakTurn,Math.abs(mesh.rotation.z-.2));peakBob=Math.max(peakBob,Math.abs(mesh.position.y));}
  assert.ok(peakTurn>.0001,'wave must rotate the flower');
  assert.ok(peakBob>.00001,'wave must lift the flower');
  for(let i=0;i<2400;i++){sim.update(1/120);flowers.update(1/120);}
  assert.ok(Math.abs(mesh.rotation.z-.2)<peakTurn*.1,'rotation must settle');
  assert.ok(Math.abs(mesh.position.y)<peakBob*.1,'bobbing must settle');
  flowers.dispose();
});
