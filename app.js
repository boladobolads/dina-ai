const $ = s => document.querySelector(s);
const history = [];
let busy = false;
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function addMessage(role,text,extra=""){ $("#welcome").hidden=true;const row=document.createElement("article");row.className="message "+role;const avatar=document.createElement("div");avatar.className="message-avatar";avatar.textContent=role==="assistant"?"D":"W";const content=document.createElement("div");content.className="message-content "+extra;content.textContent=text;row.append(avatar,content);$("#messages").append(row);$("#conversation").scrollTop=$("#conversation").scrollHeight;return content;}
function setBusy(value){busy=value;$("#send").disabled=value;$("#message").disabled=value;}
async function sendMessage(value){const message=value.trim();if(!message||busy)return;addMessage("user",message);history.push({role:"user",content:message});$("#message").value="";$("#message").style.height="auto";setBusy(true);const pending=addMessage("assistant","A DINA está pensando…","typing");
try{const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","X-DINA-ACCESS-CODE":sessionStorage.getItem("dina_access_code")||""},body:JSON.stringify({messages:history})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Não foi possível falar com a IA.");const answer=data.answer||"Não recebi uma resposta desta vez.";pending.classList.remove("typing");pending.textContent=answer;history.push({role:"assistant",content:answer});}
catch(error){pending.classList.remove("typing");pending.classList.add("error");pending.textContent=error.message;history.pop();}
finally{setBusy(false);$("#message").focus();$("#conversation").scrollTop=$("#conversation").scrollHeight;}}
$("#chat-form").addEventListener("submit",e=>{e.preventDefault();sendMessage($("#message").value);});
$("#message").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chat-form").requestSubmit();}});
$("#message").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px";});
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>sendMessage(b.dataset.prompt)));
function reset(){history.length=0;$("#messages").replaceChildren();$("#welcome").hidden=false;}
$("#new-chat").addEventListener("click",()=>{reset();$("#message").focus();$("#sidebar").classList.remove("open");});
$("#menu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
document.querySelectorAll("[data-soon]").forEach(b=>b.addEventListener("click",()=>toast("O módulo "+b.dataset.soon+" será desenvolvido na próxima etapa.")));
$("#access-form").addEventListener("submit",e=>{e.preventDefault();sessionStorage.setItem("dina_access_code",$("#access-code").value);$("#access").close();toast("Código salvo nesta sessão.");});
(async()=>{try{const r=await fetch("/api/status");const d=await r.json();if(d.accessRequired&&!sessionStorage.getItem("dina_access_code"))$("#access").showModal();}catch{}})();
