export const WORLD = { width: 1536, height: 1024 };
export const SPINE_POINTS = 29;
export const MAX_RIPPLES = 16;
export const MAX_FOOD = 18;
export type Point = { x: number; y: number };
export type Ripple = Point & { age: number; strength: number };
export type Food = Point & { id: number; age: number };
export type Fish = Point & {
  id: number; angle: number; turn: number; speed: number; length: number;
  phase: number; effort: number; burst: number; depth: number;
  target: Point; wanderAt: number; wakeAt: number; spine: Point[];
  threat: Point | null; fleeUntil: number;
  foodId: number | null; surface: number;
};
export type PondState = { time: number; fish: Fish[]; ripples: Ripple[]; food: Food[]; nextFoodId: number; fed: number; lastFeedAt: number; random: () => number };

export function seededRandom(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function angleDifference(target: number, current: number) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createPond(seed = 82): PondState {
  const starts = [
    { x: 570, y: 355, angle: 0.65, length: 365 },
    { x: 1070, y: 450, angle: 2.4, length: 315 },
    { x: 695, y: 720, angle: -0.48, length: 345 },
  ];
  return { time: 0, ripples: [], food: [], nextFoodId: 0, fed: 0, lastFeedAt: -1, random: seededRandom(seed),
    fish: starts.map((f, id) => ({ ...f, id, turn: 0, speed: 58 + id * 4,
      phase: id * 2.1, effort: 0.7, burst: 0, depth: 0.3 + id * 0.15,
      threat: null, fleeUntil: 0,
      foodId: null, surface: 0,
      target: waterPoint(f.x + Math.cos(f.angle) * 430, f.y + Math.sin(f.angle) * 430),
      wanderAt: 5 + id * 2.7, wakeAt: id * 0.8,
      spine: Array.from({ length: SPINE_POINTS }, (_, i) => ({
        x: f.x - Math.cos(f.angle) * f.length * i / (SPINE_POINTS - 1),
        y: f.y - Math.sin(f.angle) * f.length * i / (SPINE_POINTS - 1),
      })),
    })),
  };
}

export function waterPoint(x: number, y: number): Point {
  const dx = x - 780, dy = y - 520;
  const r = Math.hypot(dx / 515, dy / 315);
  return { x: 780 + dx / Math.max(1, r), y: 520 + dy / Math.max(1, r) };
}

export function feed(state: PondState, point: Point = {x:780,y:520}) {
  if(state.time-state.lastFeedAt<.22)return;
  state.lastFeedAt=state.time;
  const inner=waterPoint(780+(point.x-780)/.77,520+(point.y-520)/.77);
  const center={x:780+(inner.x-780)*.77,y:520+(inner.y-520)*.77};
  for(let i=0;i<3;i++){
    if(state.food.length>=MAX_FOOD)state.food.shift();
    const angle=state.nextFoodId*2.39996;
    state.food.push({id:state.nextFoodId++,x:center.x+Math.cos(angle)*(12+i*9),
      y:center.y+Math.sin(angle)*(10+i*7),age:0});
  }
  ripple(state,center,.36,false);
}

/** Choose an escape destination once, with enough room to complete the dart. */
function escapeTarget(f: Fish, point: Point, away: number): Point {
  let best=waterPoint(f.x+Math.cos(away)*440,f.y+Math.sin(away)*440),score=-Infinity;
  for(let i=0;i<18;i++){
    const angle=i===0?away:i===1?f.angle:(i-2)*Math.PI/8;
    const target=waterPoint(f.x+Math.cos(angle)*440,f.y+Math.sin(angle)*440);
    const distance=Math.hypot(target.x-f.x,target.y-f.y);
    if(distance<160)continue;
    const heading=Math.atan2(target.y-f.y,target.x-f.x);
    const value=Math.hypot(target.x-point.x,target.y-point.y)+distance*.25
      -Math.abs(angleDifference(heading,f.angle))*65;
    if(value>score){score=value;best=target;}
  }
  return best;
}

/** A physical disturbance, independent of fish behaviour and renderer resolution. */
export function ripple(state: PondState, point: Point, strength = 1, react = true) {
  if (state.ripples.length >= MAX_RIPPLES) state.ripples.shift();
  state.ripples.push({ ...point, age: 0, strength });
  if (!react || strength < 0.65) return;
  for (const f of state.fish) {
    // Distance to the entire articulated animal, including its tail and fins.
    const distance = Math.max(0, Math.min(...f.spine.map(bone =>
      Math.hypot(bone.x - point.x, bone.y - point.y))) - f.length * .085);
    if (distance > 290) continue;
    const dx = f.x - point.x, dy = f.y - point.y;
    const away = Math.hypot(dx, dy) < 12 ? f.angle + (f.id % 2 ? -1 : 1) * 1.2 : Math.atan2(dy, dx);
    const intensity = (1 - distance / 350) * Math.min(strength, 1.4);
    f.burst = Math.max(f.burst, intensity);
    // Repeated taps reinforce the existing dart; they must not reset its turn,
    // threat or destination on every pointer-down.
    if(state.time<f.fleeUntil && f.threat!==null)continue;
    // Offset an exact head hit so its escape heading is well-defined.
    f.threat = Math.hypot(dx, dy) < 12
      ? { x: f.x - Math.cos(away) * 30, y: f.y - Math.sin(away) * 30 } : { ...point };
    f.fleeUntil = state.time + 1.1 + intensity * .75;
    f.target = escapeTarget(f,point,away);
    f.wanderAt = f.fleeUntil + 1.2;
    f.wakeAt = state.time;
  }
}

export function step(state: PondState, delta: number) {
  const total = clamp(delta, 0, 0.1);
  const count = Math.max(1, Math.ceil(total * 120));
  for (let i = 0; i < count; i++) integrate(state, total / count);
}

function integrate(state: PondState, dt: number) {
  state.time += dt;
  for(const pellet of state.food)pellet.age+=dt;
  state.food=state.food.filter(pellet=>pellet.age<24);
  const claimed=new Set<number>();
  for(const f of state.fish){
    if(f.threat && state.time<f.fleeUntil){f.foodId=null;continue;}
    let pellet=state.food.find(p=>p.id===f.foodId&&!claimed.has(p.id));
    if(!pellet)pellet=state.food.filter(p=>!claimed.has(p.id)).sort((a,b)=>
      Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0];
    f.foodId=pellet?.id??null;
    if(pellet)claimed.add(pellet.id);
  }
  for (const f of state.fish) {
    const fleeing = state.time < f.fleeUntil && f.threat !== null;
    const food=state.food.find(p=>p.id===f.foodId);
    if(food)f.target={x:food.x,y:food.y};
    const feeding=!!food&&!fleeing;
    f.burst *= Math.exp(-dt * (fleeing ? .65 : 1.7));
    if (!fleeing) f.threat = null;
    if (!fleeing && !feeding && (state.time > f.wanderAt || Math.hypot(f.x - f.target.x, f.y - f.target.y) < 110)) {
      const theta = f.angle + (state.random() - 0.5) * 2.9;
      f.target = waterPoint(f.x + Math.cos(theta) * 510, f.y + Math.sin(theta) * 410);
      f.wanderAt = state.time + 5 + state.random() * 6;
    }
    let dx = f.target.x - f.x, dy = f.target.y - f.y;
    const targetDistance = Math.hypot(dx, dy) || 1;
    dx = dx / targetDistance; dy = dy / targetDistance;
    // Avoid the other animal's whole body, not just its head.
    for (const other of state.fish) {
      if (other.id === f.id) continue;
      for (let i = 0; i < 20; i += 5) {
        const bone = other.spine[i];
        const sx = f.x + Math.cos(f.angle) * 70 - bone.x;
        const sy = f.y + Math.sin(f.angle) * 70 - bone.y;
        const distance = Math.hypot(sx, sy);
        if (distance > 0.01 && distance < 155) {
          const push = Math.pow(1 - distance / 155, 2) * (fleeing ? .35 : feeding ? .2 : 2);
          dx += sx / distance * push; dy += sy / distance * push;
        }
      }
    }
    const lookAhead = fleeing || feeding ? 60 : 125 + f.speed * .5;
    const lookX = f.x + Math.cos(f.angle) * lookAhead;
    const lookY = f.y + Math.sin(f.angle) * lookAhead;
    const edge = Math.hypot((lookX - 780) / 520, (lookY - 520) / 330);
    const edgeStart = fleeing || feeding ? .96 : .78;
    if (edge > edgeStart) {
      const inward = Math.atan2((520 - lookY) / 330, (780 - lookX) / 520);
      const force = clamp((edge - edgeStart) * (fleeing ? 12 : 5), 0, 4);
      dx += Math.cos(inward) * force;
      dy += Math.sin(inward) * force;
    }
    const error = angleDifference(Math.atan2(dy, dx), f.angle);
    const maxTurn = (feeding ? 1.9 : .62) + f.burst * 3.8;
    f.turn += (clamp(error * (fleeing ? 5 : feeding ? 3 : 1.5), -maxTurn, maxTurn) - f.turn) * (1 - Math.exp(-dt * (fleeing ? 15 : feeding ? 6 : 3)));
    f.angle += f.turn * dt;
    f.angle = Math.atan2(Math.sin(f.angle), Math.cos(f.angle));
    // Propulsive strokes alternate with a glide; each animal has its own cadence.
    const cycle = (state.time + f.id * 2.4) % (7.7 + f.id * 1.1);
    const desiredEffort = (feeding ? .85 : cycle < 3.7 ? .95 : .12) + f.burst * 1.2;
    f.effort += (desiredEffort - f.effort) * (1 - Math.exp(-dt * (fleeing ? 12 : 3)));
    f.phase += dt * (3.0 + f.effort * 4.8);
    const push = Math.pow(Math.sin(f.phase), 2);
    const speed = (feeding ? clamp(targetDistance*.75,20,112) : 35 + f.effort * 37 + f.id * 4 + f.burst * 190) * (0.9 + push * 0.18);
    // Turn first on a frontal scare, then drive away instead of charging the tap.
    const turnBrake = fleeing ? 1 - Math.min(.76, Math.abs(error) * .32) : 1 - Math.min(.38, Math.abs(error) * .13);
    f.speed += (speed * turnBrake - f.speed) * (1 - Math.exp(-dt * (fleeing ? 9 : 1.7)));
    f.x += Math.cos(f.angle) * f.speed * dt;
    f.y += Math.sin(f.angle) * f.speed * dt;
    const surfaceTarget=feeding?clamp(1-targetDistance/230,0,1):0;
    f.surface+=(surfaceTarget-f.surface)*(1-Math.exp(-dt*2.8));
    f.depth = (0.34 + f.id * 0.13 + Math.sin(state.time * 0.23 + f.id * 2.1) * 0.15)*(1-f.surface*.8);
    if(food && !fleeing && Math.hypot(f.x-food.x,f.y-food.y)<29){
      state.food=state.food.filter(p=>p.id!==food.id);
      state.fed++;f.foodId=null;f.wanderAt=state.time;
      ripple(state,{x:f.x,y:f.y},.52,false);
    }
    // Inextensible articulated spine: head leads, successive joints follow its path.
    const spacing = f.length / (SPINE_POINTS - 1);
    f.spine[0].x = f.x; f.spine[0].y = f.y;
    let parentAngle = f.angle + Math.PI;
    for (let i = 1; i < SPINE_POINTS; i++) {
      const previous = f.spine[i - 1], bone = f.spine[i];
      const angle = Math.atan2(bone.y - previous.y, bone.x - previous.x);
      const bendLimit = .13 + Math.min(f.burst, 1.4) * .045;
      const bend = clamp(angleDifference(angle, parentAngle), -bendLimit, bendLimit);
      const followed = parentAngle + bend * (i < 3 ? i / 3 : 1);
      bone.x = previous.x + Math.cos(followed) * spacing;
      bone.y = previous.y + Math.sin(followed) * spacing;
      parentAngle = followed;
    }
    if (state.time > f.wakeAt) {
      if (state.ripples.length < (fleeing ? 12 : 7)) ripple(state, f.spine[23], Math.min(.38, 0.08 + f.effort * 0.055 + f.burst * .12), false);
      f.wakeAt = state.time + (fleeing ? .22 : 1.1 + f.id * 0.2);
    }
  }
  for (const r of state.ripples) r.age += dt;
  state.ripples = state.ripples.filter(r => r.age < 5.2);
}
