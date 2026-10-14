import test from 'node:test';
import assert from 'node:assert/strict';
import { CoordinateMapper } from '../src/utils/CoordinateMapper.js';
import { RippleSimulation } from '../src/water/RippleSimulation.js';
import { waterSettings } from '../src/config/scene.js';

test('cover mapping remains registered after resize and replacement with different aspect ratio', () => {
  for (const source of [[1672,941],[3840,2160],[1600,1200],[1000,1500]]) {
    const mapper = new CoordinateMapper(...source);
    for (const viewport of [[1920,1080],[1440,900],[2560,1080],[800,1200]]) {
      mapper.resize(...viewport);
      assert.ok(mapper.drawWidth >= viewport[0]-.00001);
      assert.ok(mapper.drawHeight >= viewport[1]-.00001);
      for (const [x,y] of [[0,0],[viewport[0]/2,viewport[1]/2],viewport]) {
        const uv=mapper.screenToUV(x,y),screen=mapper.uvToScreen(uv.u,uv.v);
        assert.ok(Math.abs(screen.x-x)<1e-8 && Math.abs(screen.y-y)<1e-8);
        const world=mapper.uvToWorld(uv.u,uv.v);
        assert.ok(Math.abs((world.x/mapper.visibleWidth+.5)*viewport[0]-x)<1e-8);
        assert.ok(Math.abs((.5-world.y/mapper.visibleHeight)*viewport[1]-y)<1e-8);
      }
    }
  }
});

test('dry clicks are rejected; waves propagate, remain finite and lose energy', () => {
  const sim=new RippleSimulation(1, (u,v)=>u>.2&&u<.8&&v>.1&&v<.9?1:0, {...waterSettings,resolution:96});
  assert.equal(sim.disturb(.1,.5,.1),false);
  assert.equal(sim.current.some(value=>value!==0),false);
  assert.equal(sim.disturb(.5,.5,.1),true);
  const energy=()=>sim.current.reduce((sum,v)=>sum+v*v,0);
  const initial=energy(), before=sim.heightAt(.57,.5);
  for(let i=0;i<75;i++)sim.update(1/120);
  assert.ok(Math.abs(sim.heightAt(.57,.5))>Math.abs(before)+.0001);
  for(let i=0;i<1800;i++)sim.update(1/120);
  assert.ok(energy()<initial*.12);
  assert.ok(sim.current.every(Number.isFinite));
  assert.ok(sim.current.every((value,i)=>sim.mask[i]||value===0));
});

test('replacement mask changes allowed interactions without simulation edits', () => {
  const a=new RippleSimulation(1, u=>u<.5?1:0,waterSettings);
  const b=new RippleSimulation(1, u=>u>.5?1:0,waterSettings);
  assert.equal(a.disturb(.25,.5,.1),true);
  assert.equal(b.disturb(.25,.5,.1),false);
  assert.equal(a.disturb(.75,.5,.1),false);
  assert.equal(b.disturb(.75,.5,.1),true);
});
