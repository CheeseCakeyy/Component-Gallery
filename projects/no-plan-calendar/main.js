import {days,dateKey,addDays,parseDate,hidingSpot} from './dates.js';
const $=id=>document.getElementById(id);
const paper='#f8f7f3', ink='#151513';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected=new Date(), liveDay=dateKey(selected), opening=1, phase='idle', last=0, frame=0, lookX=0, lookY=0;
const sayings=['No plans. Just peeking.','Monday? Never heard of it.','A little curious. A little unbusy.','Halfway to absolutely nowhere.','Just checking if it’s the weekend.','Out of office. Still at home.','Today’s agenda: nothing, together.'];
const buttons=days.map((day,index)=>{const button=document.createElement('button');button.className='day-button';button.setAttribute('aria-label',`Peek from ${day}`);button.addEventListener('click',()=>choose(addDays(selected,index-selected.getDay())));$('day-buttons').append(button);return button;});
function updateLabels(){const today=dateKey(selected)===dateKey(new Date());$('date-text').textContent=selected.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});$('relative').textContent=today?'TODAY, IN NO PARTICULAR HURRY':days[selected.getDay()].toUpperCase()+', AT YOUR OWN PACE';$('date-picker').value=dateKey(selected);$('caption').textContent=sayings[selected.getDay()];$('today').disabled=today;$('announcement').textContent=`${days[selected.getDay()]}, ${$('date-text').textContent}. ${$('caption').textContent}`;$('drawing-description').textContent=`A little character peeks through ${days[selected.getDay()]}'s paper strip.`;buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected.getDay())));}
let pending=null;
function choose(date){if(dateKey(date)===dateKey(pending||selected))return;pending=date;if(reduced.matches){selected=pending;pending=null;opening=1;updateLabels();draw();return;}phase='closing';wake();}
const stroke=`stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
function draw(){
  const day=selected.getDay(),x=hidingSpot(selected),gap=opening*79,top=30,row=33;
  // Each boundary is a continuous paper edge. The selected opening fans nearby strips.
  const edge=(i)=>{const baseline=top+i*row;const bend=i<=day?-gap*.22*Math.max(0,1-(day-i)/2):gap*Math.max(0,1-(i-day-1)/3);return {base:baseline,y:baseline+bend};};
  // Start each bend at the label seam, so it meets the correct day's boundary.
  // Curving from x=30 hid the beginning behind the labels and shifted it down a row.
  const curve=(i,reverse=false)=>{const e=edge(i),shoulder=e.base+(e.y-e.base)*.38;return reverse?`C 440 ${e.base} ${x+65} ${e.y} ${x} ${e.y} C ${x-65} ${e.y} 180 ${shoulder} 126 ${e.base} H30`:`H126 C 180 ${shoulder} ${x-65} ${e.y} ${x} ${e.y} C ${x+65} ${e.y} 440 ${e.base} 530 ${e.base}`;};
  let svg=`<path d="M30 30H530V${edge(7).base} ${curve(7,true)} Z" fill="${ink}" ${stroke}/>`;
  // Character sits behind all strips; the open day masks the lower body naturally.
  const lower=edge(day+1).y,headY=lower-94*opening,tilt=((selected.getDate()%3)-1)*5;
  const blink=!reduced.matches&&Date.now()%4800<145?0.12:1;
  svg+=`<defs><clipPath id="peek-window"><path d="M30 ${edge(day).base} ${curve(day)} L530 ${edge(day+1).base} ${curve(day+1,true)} Z"/></clipPath></defs><g clip-path="url(#peek-window)"><g transform="translate(${x} ${headY}) rotate(${tilt} 0 60)"><path d="M-63 103 L-61 40 Q-60 12-38 9 Q-4 0 37 7 Q59 10 61 39 L66 103Z" fill="${paper}" ${stroke}/><ellipse cx="${-23+lookX}" cy="${43+lookY}" rx="4.5" ry="${5*blink}" fill="${ink}"/><ellipse cx="${27+lookX}" cy="${43+lookY}" rx="4.5" ry="${5*blink}" fill="${ink}"/></g></g>`;
  for(let i=0;i<7;i++){
    if(i!==day){svg+=`<path d="M30 ${edge(i).base} ${curve(i)} L530 ${edge(i+1).base} ${curve(i+1,true)} Z" fill="${paper}" ${stroke}/>`;}
    else {svg+=`<path d="M30 ${edge(i).base} ${curve(i)} M30 ${edge(i+1).base} ${curve(i+1)}" fill="none" ${stroke}/>`;}
    // Keep the printed label on its own opaque paper tab, like the reference.
    svg+=`<path d="M30 ${top+i*row} H126 V${top+(i+1)*row} H30Z" fill="${paper}" ${stroke}/><text x="77" y="${top+i*row+23}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="25" fill="${i===0?'#b66b34':i===6?'#464c74':ink}">${days[i].slice(0,3).toUpperCase()}</text>`;
    buttons[i].style.top=`${(top+i*row)/365*100}%`;buttons[i].style.height=`${row/365*100}%`;
  }
  // Fingers overlap the paper edge so the friend visibly holds it down.
  if(opening>.02){svg+=`<g transform="translate(${x} ${lower}) scale(${opening})"><path d="M-36-10 Q-30-26-15-21 Q-7-17-6-3 L-4 10 Q-7 22-17 16Z" fill="${paper}" ${stroke}/><path d="M-18-14 Q-20-30-8-30 Q4-30 5-13 L7 10 Q6 22-5 22 Q-15 20-15 10Z" fill="${paper}" ${stroke}/><path d="M4-15 Q5-28 16-24 Q26-20 23-6 L20 13 Q17 24 8 21 Q1 18 4 8Z" fill="${paper}" ${stroke}/></g>`;}
  svg+=`<path d="M16 12H546V30H16Z" fill="${paper}" ${stroke}/>`;
  $('art').innerHTML=svg;
}
function tick(time){const dt=Math.min((time-last)/1000,.04);last=time;if(phase==='closing'){opening=Math.max(0,opening-dt*5);if(opening===0){selected=pending||selected;pending=null;updateLabels();phase='opening';}}else if(phase==='opening'){opening=Math.min(1,opening+dt*3.2);if(opening===1)phase='idle';}draw();frame=0;if(phase!=='idle')wake();}
function wake(){if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}}
$('previous').addEventListener('click',()=>choose(addDays(pending||selected,-1)));
$('next').addEventListener('click',()=>choose(addDays(pending||selected,1)));
$('today').addEventListener('click',()=>choose(new Date()));
$('date-picker').addEventListener('change',event=>{const date=parseDate(event.target.value);if(date)choose(date);});
$('calendar').parentElement.addEventListener('pointermove',event=>{if(reduced.matches)return;const box=$('calendar').getBoundingClientRect();lookX=Math.max(-4,Math.min(4,(event.clientX-box.left-box.width/2)/35));lookY=Math.max(-2,Math.min(3,(event.clientY-box.top-box.height/2)/40));if(phase==='idle')draw();});
$('calendar').parentElement.addEventListener('pointerleave',()=>{lookX=lookY=0;if(phase==='idle')draw();});
function checkDay(){const now=new Date(),key=dateKey(now);if(key!==liveDay){if(dateKey(selected)===liveDay)choose(now);liveDay=key;}}
setInterval(()=>{checkDay();if(!document.hidden&&phase==='idle'&&!reduced.matches)draw();},120);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
updateLabels();draw();

