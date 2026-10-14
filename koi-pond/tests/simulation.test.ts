import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPond, step, ripple, feed, waterPoint, angleDifference, MAX_RIPPLES, MAX_FOOD } from '../src/pond/simulation.ts';

test('ten minutes of swimming remains bounded with an unstretched articulated spine', () => {
  const pond = createPond(); let distance=0;
  for(let frame=0;frame<36000;frame++) {
    const {x,y}=pond.fish[0]; step(pond,1/60);
    distance+=Math.hypot(pond.fish[0].x-x,pond.fish[0].y-y);
    for(const fish of pond.fish) {
      assert.ok(Number.isFinite(fish.x+fish.y+fish.angle));
      assert.ok(fish.x>150&&fish.x<1400&&fish.y>80&&fish.y<950, `outside pond: ${fish.x}, ${fish.y}`);
      for(let i=1;i<fish.spine.length;i++) {
        const a=fish.spine[i-1],b=fish.spine[i];
        assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-fish.length/28)<1e-8);
      }
    }
  }
  assert.ok(distance>10000);
});

test('a nearby disturbance triggers a temporary escape response', () => {
  const pond=createPond(), fish=pond.fish[0];
  ripple(pond,{x:fish.x-20,y:fish.y},1.3);
  assert.ok(fish.burst>1);
  assert.ok(fish.target.x>fish.x);
  for(let i=0;i<360;i++) step(pond,1/60);
  assert.ok(fish.burst<.01);
});

test('wave storage is capped and user waves expire', () => {
  const pond=createPond();
  for(let i=0;i<100;i++) ripple(pond,{x:700,y:500},1,false);
  assert.equal(pond.ripples.length,MAX_RIPPLES);
  for(let i=0;i<360;i++) step(pond,1/60);
  assert.ok(pond.ripples.every(r=>r.strength<.3));
});

test('targets outside the paper are projected to open water', () => {
  for(const point of [{x:0,y:0},{x:1536,y:1024},{x:20,y:1000}]) {
    const p=waterPoint(point.x,point.y);
    assert.ok(Math.hypot((p.x-780)/515,(p.y-520)/315)<1.0001);
  }
});

test('angle wrapping and a resumed tab cannot teleport a fish', () => {
  assert.ok(Math.abs(angleDifference(-Math.PI+.01,Math.PI-.01)-.02)<.001);
  const pond=createPond(),before={...pond.fish[0]};step(pond,60);
  assert.ok(Math.hypot(pond.fish[0].x-before.x,pond.fish[0].y-before.y)<10);
});

test('30 and 60 fps follow the same paths', () => {
  const a=createPond(),b=createPond();
  for(let i=0;i<1800;i++)step(a,1/60);
  for(let i=0;i<900;i++)step(b,1/30);
  for(let i=0;i<3;i++)assert.ok(Math.hypot(a.fish[i].x-b.fish[i].x,a.fish[i].y-b.fish[i].y)<1);
});

test('tail hits and nearby water startle fish, while hover and distant taps do not', () => {
  const pond=createPond(),fish=pond.fish[0];
  ripple(pond,{...fish.spine[27]},1.35);
  assert.ok(fish.burst>1, 'tail contact should feel like a direct hit');
  assert.ok(fish.fleeUntil>pond.time+1);
  const nearby=createPond(),head=nearby.fish[0];
  ripple(nearby,{x:head.x+80,y:head.y+60},1.35);
  assert.ok(head.burst>.5);
  const quiet=createPond();
  ripple(quiet,{...quiet.fish[0]},.3);
  ripple(quiet,{x:1536,y:0},1.35);
  assert.ok(quiet.fish.every(f=>f.burst===0&&f.threat===null));
});

test('a frontal tap turns the fish away, accelerates, then recovers', () => {
  const pond=createPond(),fish=pond.fish[0];
  pond.fish=[fish];
  const tap={x:fish.x+Math.cos(fish.angle)*65,y:fish.y+Math.sin(fish.angle)*65};
  ripple(pond,tap,1.35);
  let peak=0;
  for(let i=0;i<90;i++){step(pond,1/60);peak=Math.max(peak,fish.speed);}
  assert.ok(Math.hypot(fish.x-tap.x,fish.y-tap.y)>130, 'must actually escape the tap');
  assert.ok(peak>140, `escape should be visibly faster: ${peak}`);
  for(let i=0;i<480;i++)step(pond,1/60);
  assert.equal(fish.threat,null);
  assert.ok(fish.burst<.01);
  assert.ok(fish.speed<110);
});

test('repeated head and tail scares stay finite, inside the pond, and preserve spine length', () => {
  const pond=createPond();
  for(let frame=0;frame<3600;frame++) {
    if(frame%36===0){const fish=pond.fish[(frame/36)%3];ripple(pond,{...fish.spine[frame%72===0?0:26]},1.35);}
    step(pond,1/60);
    for(const fish of pond.fish){
      assert.ok(Number.isFinite(fish.x+fish.y+fish.angle));
      assert.ok(fish.x>150&&fish.x<1400&&fish.y>80&&fish.y<950,`escaped pond: ${fish.x}, ${fish.y}`);
      for(let i=1;i<fish.spine.length;i++)assert.ok(Math.abs(Math.hypot(fish.spine[i].x-fish.spine[i-1].x,fish.spine[i].y-fish.spine[i-1].y)-fish.length/28)<1e-8);
    }
  }
});

test('rapid clicks on alternating sides preserve the escape path and make forward progress', () => {
  for(const id of [0,1,2]){
    const pond=createPond(),fish=pond.fish[id],start={x:fish.x,y:fish.y};
    ripple(pond,{x:fish.x,y:fish.y},1.35);
    const target={...fish.target},until=fish.fleeUntil,threat={...fish.threat!};
    for(let frame=0;frame<90;frame++){
      if(frame%6===0)ripple(pond,{x:fish.x+(frame%12===0?45:-45),y:fish.y},1.35);
      step(pond,1/60);
      assert.deepEqual(fish.target,target,'rapid taps must not redirect the current escape');
      assert.deepEqual(fish.threat,threat);
      assert.equal(fish.fleeUntil,until,'rapid taps must not restart the escape clock');
    }
    assert.ok(Math.hypot(fish.x-start.x,fish.y-start.y)>180,'fish should dart away despite repeated clicks');
    for(let frame=0;frame<480;frame++)step(pond,1/60);
    assert.equal(fish.threat,null);
    assert.ok(fish.burst<.01);
    ripple(pond,{x:fish.x,y:fish.y},1.35);
    assert.ok(fish.fleeUntil>pond.time,'a new click after recovery should trigger another escape');
  }
});

test('food draws koi in, is eaten, and leaves them swimming calmly', () => {
  const pond=createPond();feed(pond);
  assert.equal(pond.food.length,3);
  assert.ok(pond.fish.every(f=>f.burst===0));
  for(let frame=0;frame<1200;frame++)step(pond,1/60);
  assert.equal(pond.fed,3,'all three morsels should be eaten before they expire');
  assert.equal(pond.food.length,0);
  assert.ok(pond.fish.every(f=>f.foodId===null&&f.threat===null));
});

test('food is bounded, expires, and never overrides an active escape', () => {
  const pond=createPond();
  for(let i=0;i<40;i++){feed(pond,{x:0,y:0});for(let j=0;j<15;j++)step(pond,1/60);}
  assert.ok(pond.food.length<=MAX_FOOD);
  assert.ok(pond.food.every(p=>Math.hypot((p.x-780)/515,(p.y-520)/315)<.9));
  const fish=pond.fish[0];ripple(pond,{x:fish.x,y:fish.y},1.35);
  const target={...fish.target};feed(pond);step(pond,1/60);
  assert.deepEqual(fish.target,target);assert.equal(fish.foodId,null);
  pond.fish=[];
  for(let i=0;i<1500;i++)step(pond,1/60);
  assert.equal(pond.food.length,0);
});
