const $ = s => document.querySelector(s);
const history = [];
let busy = false;
let toastTimer;
let currentVideoId = "";
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function addMessage(role, text, extra = "") {
  $("#welcome").hidden = true;
  const row = document.createElement("article");
  row.className = "message " + role;
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "assistant" ? "D" : "W";
  const content = document.createElement("div");
  content.className = "message-content " + extra;
  content.textContent = text;
  row.append(avatar, content);
  $("#messages").append(row);
  $("#conversation").scrollTop = $("#conversation").scrollHeight;
  return content;
}
function setBusy(value) {
  busy = value;
  $("#send").disabled = value;
  $("#message").disabled = value;
  $("#provider").disabled = value;
}
const providerNames = { gemini: "Gemini", openrouter: "OpenRouter", ollama: "Ollama", openai: "OpenAI", auto: "Automático" };
async function sendMessage(value) {
  const message = value.trim();
  if (!message || busy) return;
  addMessage("user", message);
  history.push({ role: "user", content: message });
  $("#message").value = "";
  $("#message").style.height = "auto";
  setBusy(true);
  const pending = addMessage("assistant", "A DINA está pensando…", "typing");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-DINA-ACCESS-CODE": sessionStorage.getItem("dina_access_code") || "" },
      body: JSON.stringify({ messages: history, provider: $("#provider").value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível falar com a IA.");
    pending.classList.remove("typing");
    pending.textContent = data.answer || "Não recebi uma resposta desta vez.";
    if (data.provider) {
      const tag = document.createElement("small");
      tag.className = "provider-tag";
      tag.textContent = "Motor: " + (providerNames[data.provider] || data.provider);
      pending.append(document.createElement("br"), tag);
    }
    history.push({ role: "assistant", content: data.answer || "" });
  } catch (error) {
    pending.classList.remove("typing");
    pending.classList.add("error");
    pending.textContent = error.message;
    history.pop();
  } finally {
    setBusy(false);
    $("#message").focus();
    $("#conversation").scrollTop = $("#conversation").scrollHeight;
  }
}
$("#chat-form").addEventListener("submit", e => {
  e.preventDefault();
  sendMessage($("#message").value);
});
$("#message").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#chat-form").requestSubmit();
  }
});
$("#message").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
});
document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => sendMessage(button.dataset.prompt)));
function reset() {
  history.length = 0;
  $("#messages").replaceChildren();
  $("#welcome").hidden = false;
}
$("#new-chat").addEventListener("click", () => {
  reset();
  $("#message").focus();
  $("#sidebar").classList.remove("open");
});
$("#menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.querySelectorAll("[data-soon]").forEach(button => button.addEventListener("click", () => toast("O módulo " + button.dataset.soon + " será desenvolvido na próxima etapa.")));
$("#access-form").addEventListener("submit", e => {
  e.preventDefault();
  sessionStorage.setItem("dina_access_code", $("#access-code").value);
  $("#access").close();
  toast("Código salvo nesta sessão.");
});
(async () => {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    const select = $("#provider");
    for (const provider of ["gemini", "openrouter", "ollama", "openai"]) {
      const option = select.querySelector('option[value="' + provider + '"]');
      option.disabled = !data.providers?.[provider];
      if (option.disabled) option.textContent += " (não configurado)";
    }
    const videoNav = $("#video-nav");
    if (videoNav) { videoNav.classList.toggle("configured", Boolean(data.video)); videoNav.title = data.video ? "Gerador de vídeo conectado" : "Configure NURETA_API_KEY no Cloudflare"; }
    const available = Object.values(data.providers || {}).some(Boolean);
    if (!available) toast("Configure pelo menos um motor de IA no Cloudflare para conversar.");
    if (data.accessRequired && !sessionStorage.getItem("dina_access_code")) $("#access").showModal();
  } catch {
    toast("Não foi possível verificar os motores de IA.");
  }
})();

const videoNav = $("#video-nav");
const chatConversation = $("#conversation");
const videoStudio = $("#video-studio");
const chatFooter = document.querySelector("main > footer");
const chatNav = $("#chat-nav");
if (chatNav) chatNav.addEventListener("click", () => { videoStudio.hidden = true; chatConversation.hidden = false; chatFooter.hidden = false; videoNav?.classList.remove("active"); chatNav.classList.add("active"); $("#sidebar").classList.remove("open"); });
if (videoNav) videoNav.addEventListener("click", () => {
  const show = videoStudio.hidden;
  videoStudio.hidden = !show;
  chatConversation.hidden = show;
  chatFooter.hidden = show;
  videoNav.classList.toggle("active", show);
  document.querySelectorAll(".nav").forEach(n => { if (n !== videoNav) n.classList.remove("active"); });
  $("#sidebar").classList.remove("open");
});
async function videoRequest(payload) {
  const response = await fetch("/api/video", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-DINA-ACCESS-CODE": sessionStorage.getItem("dina_access_code") || "" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha ao comunicar com o gerador.");
  return data;
}
function showVideoResult(html) { $("#video-result").innerHTML = html; }
function escapeVideoText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
$("#video-form").addEventListener("submit", async e => {
  e.preventDefault();
  const prompt = $("#video-prompt").value.trim();
  if (!prompt) return;
  const btn = $("#video-generate");
  btn.disabled = true;
  btn.textContent = "Enviando solicitação…";
  showVideoResult('<p class="result-loading">Enviando pedido ao provedor…</p>');
  try {
    const data = await videoRequest({
      action: "create",
      prompt,
      model: $("#video-model").value,
      duration: Number($("#video-duration").value),
      ratio: $("#video-ratio").value,
      generateAudio: $("#video-audio").checked,
      adultConfirmed: $("#adult-confirm").checked,
      consentConfirmed: $("#consent-confirm").checked,
      costConfirmed: $("#cost-confirm").checked
    });
    currentVideoId = data.task.id;
    $("#video-refresh").disabled = false;
    showVideoResult('<p><b>Pedido recebido</b></p><p>ID: ' + escapeVideoText(data.task.id) + '</p><p>Status: ' + escapeVideoText(data.task.status) + '</p><p>Use “Atualizar status” para acompanhar. A geração pode levar alguns minutos.</p>');
  } catch (error) {
    showVideoResult('<p class="result-error">' + escapeVideoText(error.message) + '</p>');
  } finally {
    btn.disabled = false;
    btn.textContent = "▶　Gerar vídeo";
  }
});
$("#video-refresh").addEventListener("click", async () => {
  if (!currentVideoId) return;
  const btn = $("#video-refresh");
  btn.disabled = true;
  try {
    const data = await videoRequest({ action: "status", id: currentVideoId });
    const task = data.task || {};
    const videoUrl = task.content?.video_url || task.content?.url || task.media?.find(m => /video/i.test(m.type || ""))?.url;
    let output = '<p><b>Status:</b> ' + escapeVideoText(task.status) + '</p><p><b>ID:</b> ' + escapeVideoText(task.id) + '</p>';
    if (videoUrl && task.status === "succeeded") output += '<video controls playsinline src="' + escapeVideoText(videoUrl) + '"></video><p><a href="' + escapeVideoText(videoUrl) + '" target="_blank" rel="noopener">Abrir ou salvar vídeo</a></p>';
    if (task.status === "failed") output += '<p class="result-error">' + escapeVideoText(task.error || "A geração falhou. Consulte o painel do provedor para detalhes.") + '</p>';
    if (["queued","pending","processing","running","in_progress"].includes(task.status)) output += '<p>O vídeo ainda está sendo processado. Atualize novamente em instantes.</p>';
    showVideoResult(output);
  } catch (error) {
    showVideoResult('<p class="result-error">' + escapeVideoText(error.message) + '</p>');
  } finally {
    btn.disabled = false;
  }
});
$("#video-balance").addEventListener("click", async () => {
  const btn = $("#video-balance");
  btn.disabled = true;
  try {
    const data = await videoRequest({ action: "balance" });
    toast(data.balance_usd == null ? "Saldo consultado." : "Saldo Nureta: US$ " + Number(data.balance_usd).toFixed(2));
  } catch (error) {
    toast(error.message);
  } finally { btn.disabled = false; }
});
