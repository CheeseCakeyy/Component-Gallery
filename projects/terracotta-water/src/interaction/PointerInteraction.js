export function addPointerInteraction(canvas, mapper, simulation, settings) {
  const uv = {};
  let lastTime = -Infinity, lastU = null, lastV = null;
  function disturb(event, strong) {
    if (!strong && event.timeStamp-lastTime < 32) return;
    const rect = canvas.getBoundingClientRect();
    mapper.screenToUV((event.clientX-rect.left)*mapper.width/rect.width,
      (event.clientY-rect.top)*mapper.height/rect.height, uv);
    if (strong) {
      simulation.disturb(uv.u, uv.v, settings.clickStrength);
    } else {
      const distance = lastU === null ? 0 : Math.hypot((uv.u-lastU)*mapper.aspect,uv.v-lastV);
      if(lastU !== null && distance < .003) return;
      const steps = Math.min(12,Math.max(1,Math.ceil(distance/.012)));
      for(let i=1;i<=steps;i++) {
        const t=i/steps;
        simulation.disturb(lastU===null?uv.u:lastU+(uv.u-lastU)*t,
          lastV===null?uv.v:lastV+(uv.v-lastV)*t,settings.pointerStrength/Math.sqrt(steps));
      }
    }
    lastU=uv.u;lastV=uv.v;lastTime=event.timeStamp;
  }
  const move=event=>disturb(event,false),down=event=>disturb(event,true);
  const leave=()=>{lastU=null;lastV=null;};
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointerleave',leave);
  return()=>{
    canvas.removeEventListener('pointermove',move);
    canvas.removeEventListener('pointerdown',down);
    canvas.removeEventListener('pointerleave',leave);
  };
}
