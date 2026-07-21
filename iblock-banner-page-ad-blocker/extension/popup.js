let state;
init();
async function init(){
  state = await send({type:"GET_POPUP_STATE"});
  render();
  document.getElementById('regular').onclick=()=>setMode('regular');
  document.getElementById('super').onclick=()=>setMode('super');
  document.getElementById('toggleWhitelist').onclick=toggleWhitelist;
}
function render(){
  const host=state.host||'unknown';
  document.getElementById('host').textContent=host;
  document.getElementById('profile').textContent=state.profile||'-';
  document.getElementById('videoSafe').textContent=state.videoSafe?'enabled':'disabled';
  document.getElementById('regular').classList.toggle('active', state.settings.mode==='regular');
  document.getElementById('super').classList.toggle('active', state.settings.mode==='super');
  const status=document.getElementById('status');
  if(!state.settings.enabled) status.innerHTML='<span class="off">Extension disabled globally.</span>';
  else if(state.whitelisted) status.innerHTML='<span class="warn">Disabled on this whitelisted site.</span>';
  else status.innerHTML='<span class="ok">Banner and page filtering active.</span>';
  document.getElementById('toggleWhitelist').textContent=state.whitelisted?'Remove from whitelist':'Whitelist current site';
}
async function setMode(mode){ await send({type:'SET_MODE',mode}); state=await send({type:'GET_POPUP_STATE'}); render(); }
async function toggleWhitelist(){
  await send({type:state.whitelisted?'REMOVE_WHITELIST':'ADD_WHITELIST', host:state.host});
  state=await send({type:'GET_POPUP_STATE'}); render();
}
function send(msg){return new Promise((resolve,reject)=>chrome.runtime.sendMessage(msg,res=>{const e=chrome.runtime.lastError;if(e)reject(e);else resolve(res)}));}
