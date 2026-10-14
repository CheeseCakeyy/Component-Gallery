export const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function addDays(date,amount){const next=new Date(date);next.setDate(next.getDate()+amount);return next;}
export function parseDate(value){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return null;const [,y,m,d]=match.map(Number);const date=new Date(y,m-1,d,12);return dateKey(date)===value?date:null;}
export function hidingSpot(date){return 235+((date.getFullYear()*13+date.getMonth()*17+date.getDate()*37)%155);}
