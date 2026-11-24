(() => {
  const $ = (s) => document.querySelector(s);
  const micButton = $("#voice-start");
  const status = $("#voice-status");
  const transcript = $("#voice-transcript");
  if (!micButton || !status || !transcript) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let recognition = null;
  let active = false;
  let speaking = false;
  let restartAfterSpeech = false;

  function setStatus(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
    micButton.classList.toggle("is-active", active);
    micButton.setAttribute("aria-label", active ? "Desativar microfone" : "Ativar microfone");
    micButton.title = active ? "Desativar microfone" : "Ativar microfone";
  }

  function stopVoice() {
    active = false;
    restartAfterSpeech = false;
    speaking = false;
    if (recognition) { try { recognition.stop(); } catch {} }
    if (synth) synth.cancel();
    micButton.disabled = false;
    micButton.textContent = "🎙️";
    setStatus("Microfone desligado.");
  }

  function chooseFemalePortugueseVoice() {
    const voices = synth ? synth.getVoices() : [];
    const pt = voices.filter(v => /^pt(-|_)/i.test(v.lang));
    const femaleHints = /female|feminina|mulher|francisca|maria|luciana|camila|fernanda|google português do brasil/i;
    return pt.find(v => femaleHints.test(v.name)) || pt.find(v => /br/i.test(v.lang)) || pt[0] || voices.find(v => femaleHints.test(v.name)) || null;
  }

  function speak(text) {
    if (!synth || !text || !active) return;
    const clean = String(text)
      .replace(/https?:\/\/\S+/g, "link disponível na conversa")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_#`]/g, "")
      .trim();
    if (!clean) return;
    speaking = true;
    restartAfterSpeech = active;
    if (recognition) { try { recognition.stop(); } catch {} }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 7000));
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1.04;
    const voice = chooseFemalePortugueseVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus("DINA está falando…", "speaking");
    utterance.onend = () => {
      speaking = false;
      if (active && restartAfterSpeech) {
        setStatus("Estou ouvindo…", "listening");
        window.setTimeout(() => { if (active && recognition) { try { recognition.start(); } catch {} } }, 350);
      }
    };
    utterance.onerror = () => { speaking = false; if (active) setStatus("Não foi possível reproduzir a voz.", "error"); };
    synth.speak(utterance);
  }

  if (!SpeechRecognition) {
    micButton.disabled = true;
    setStatus("Reconhecimento de voz indisponível. Use Chrome ou Edge atualizado.", "error");
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setStatus("Estou ouvindo…", "listening");
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += phrase + " ";
        else interimText += phrase;
      }
      if (interimText) transcript.textContent = "Reconhecendo: " + interimText;
      if (finalText.trim()) {
        $("#message").value = finalText.trim();
        transcript.textContent = "Você: " + finalText.trim();
        $("#chat-form").requestSubmit();
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        active = false;
        micButton.textContent = "🎙️";
        setStatus("Permita o acesso ao microfone no navegador.", "error");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus("Erro no microfone: " + event.error, "error");
      }
    };
    recognition.onend = () => {
      if (active && !speaking) window.setTimeout(() => {
        if (active && !speaking) { try { recognition.start(); } catch {} }
      }, 250);
    };
  }

  micButton.addEventListener("click", async () => {
    if (active) { stopVoice(); return; }
    if (!recognition) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Use uma conexão HTTPS para acessar o microfone.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      active = true;
      micButton.textContent = "🔴";
      transcript.textContent = "Aguardando sua fala…";
      setStatus("Preparando o microfone…", "listening");
      recognition.start();
    } catch (error) {
      active = false;
      micButton.textContent = "🎙️";
      const reason = error?.name || error?.message || "erro desconhecido";
      const messages = {
        NotAllowedError: "Acesso bloqueado. Autorize o microfone nas permissões do site e do Windows.",
        PermissionDeniedError: "Acesso negado. Autorize o microfone nas permissões do site e do Windows.",
        NotFoundError: "Nenhum microfone foi encontrado. Conecte ou habilite um dispositivo.",
        NotReadableError: "O microfone está sendo usado por outro aplicativo ou não pode ser acessado.",
        OverconstrainedError: "O microfone disponível não atende aos requisitos do navegador.",
        SecurityError: "O navegador bloqueou o microfone. Abra a DINA em HTTPS."
      };
      setStatus(messages[reason] || ("Falha ao iniciar o microfone: " + reason), "error");
    }
  });

  document.addEventListener("dina:assistant-response", event => {
    if (active && event.detail?.text) speak(event.detail.text);
  });
  if (synth) synth.onvoiceschanged = () => chooseFemalePortugueseVoice();
  setStatus("Microfone desligado.");
})();