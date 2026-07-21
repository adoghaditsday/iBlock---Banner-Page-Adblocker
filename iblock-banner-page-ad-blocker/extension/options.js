const DEFAULTS={enabled:true,mode:'regular',whitelist:[],videoSafe:true,detectedVideoAdSites:[]};
let s={};init();
async function init(){s={...DEFAULTS,...await chrome.storage.local.get(Object.keys(DEFAULTS))};bind();render();}
function bind(){
 enabled.onchange=()=>save({enabled:enabled.checked});
 videoSafe.onchange=()=>save({videoSafe:videoSafe.checked});
 mode.onchange=()=>save({mode:mode.value});
 add.onclick=()=>addHost();
 clearLog.onclick=()=>save({detectedVideoAdSites:[]});
}
async function save(patch){await chrome.storage.local.set(patch);s={...s,...patch};render();}
function render(){
 enabled.checked=!!s.enabled; videoSafe.checked=s.videoSafe!==false; mode.value=s.mode||'regular';
 count.textContent=`(${(s.whitelist||[]).length}/50)`;
 whitelist.innerHTML='';
 (s.whitelist||[]).forEach(h=>{const li=document.createElement('li');li.textContent=h;const b=document.createElement('button');b.textContent='Remove';b.onclick=()=>save({whitelist:s.whitelist.filter(x=>x!==h)});li.appendChild(b);whitelist.appendChild(li);});
 log.innerHTML='';
 (s.detectedVideoAdSites||[]).forEach(h=>{const li=document.createElement('li');li.textContent=h;log.appendChild(li);});
}
function norm(v){return (v||'').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');}
function addHost(){const h=norm(newHost.value); if(!h)return; if((s.whitelist||[]).length>=50&&!s.whitelist.includes(h)){alert('Whitelist limit is 50 sites.');return;} save({whitelist:Array.from(new Set([...(s.whitelist||[]),h])).slice(0,50)}); newHost.value='';}
