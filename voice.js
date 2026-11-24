(() => {
  const $ = (s) => document.querySelector(s);
  const micButton = $("#voice-start");
  const status = $("#voice-status");
  const transcript = $("#voice-transcript");
  const room = $("#voice-room");
  const roomStatus = $("#voice-room-status");
  const roomTitle = $("#voice-room-title");
  const roomTranscript = $("#voice-room-transcript");
  const orb = $("#voice-orb");
  const muteButton = $("#voice-mute");
  if (!micButton || !status || !transcript || !room) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let recognition = null;
  let active = false;
  let muted = false;
  let speaking = false;
  let restartAfterSpeech = false;

  function setStatus(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
    micButton.classList.toggle("is-active", active);
    micButton.setAttribute("aria-label", active ? "Abrir conversa por voz" : "Abrir conversa por voz");
    if (roomStatus) roomStatus.textContent = message;
    if (orb) {
      orb.classList.toggle("is-listening", state === "listening");
      orb.classList.toggle("is-speaking", state === "speaking");
    }
    if (roomTitle) {
      roomTitle.textContent = state === "speaking" ? "A DINA está falando…" :
        state === "listening" ? "Estou ouvindo. Pode falar." :
        state === "error" ? "Vamos verificar o áudio" : "Estou aqui. Pode falar.";
    }
  }

  function closeRoom() {
    active = false;
    muted = false;
    restartAfterSpeech = false;
    speaking = false;
    if (recognition) { try { recognition.stop(); } catch {} }
    if (synth) synth.cancel();
    if (room.open) room.close();
    micButton.textContent = "🎙️";
    muteButton?.classList.remove("is-muted");
    if (muteButton) muteButton.textContent = "🎙️";
    setStatus("Microfone desligado.");
  }

  function choosePortugueseVoice() {
    const voices = synth ? synth.getVoices() : [];
    const pt = voices.filter(v => /^pt(-|_)/i.test(v.lang));
    const hints = /female|feminina|mulher|francisca|maria|luciana|camila|fernanda|google português do brasil/i;
    return pt.find(v => hints.test(v.name)) || pt.find(v => /br/i.test(v.lang)) || pt[0] || null;
  }

  function speak(text) {
    if (!synth || !text || !active) return;
    const clean = String(text).replace(/https?:\/\/\S+/g, "link disponível na conversa")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_#`]/g, "").trim();
    if (!clean) return;
    speaking = true;
    restartAfterSpeech = active && !muted;
    if (recognition) { try { recognition.stop(); } catch {} }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 7000));
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1.04;
    const voice = choosePortugueseVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus("A DINA está respondendo por voz…", "speaking");
    utterance.onend = () => {
      speaking = false;
      if (active && restartAfterSpeech && !muted) {
        setStatus("Estou ouvindo…", "listening");
        window.setTimeout(() => { if (active && !muted && recognition) { try { recognition.start(); } catch {} } }, 400);
      } else if (active) setStatus("Microfone pausado.", "idle");
    };
    utterance.onerror = () => { speaking = false; if (active) setStatus("Não foi possível reproduzir a resposta.", "error"); };
    synth.speak(utterance);
  }

  function startRecognition() {
    if (!recognition || !active || muted || speaking) return;
    try { recognition.start(); }
    catch (error) { if (error.name !== "InvalidStateError") setStatus("Falha ao iniciar reconhecimento: " + error.message, "error"); }
  }

  if (SpeechRecognition) {
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
      if (interimText) {
        roomTranscript.textContent = interimText;
        transcript.textContent = "Reconhecendo: " + interimText;
      }
      if (finalText.trim()) {
        const phrase = finalText.trim();
        $("#message").value = phrase;
        roomTranscript.textContent = "Você: " + phrase;
        transcript.textContent = "Você: " + phrase;
        $("#chat-form").requestSubmit();
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        active = false;
        setStatus("Permita o microfone nas configurações do navegador.", "error");
      } else if (event.error === "audio-capture") {
        setStatus("Não encontrei um microfone disponível no dispositivo.", "error");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus("Erro no áudio: " + event.error, "error");
      }
    };
    recognition.onend = () => {
      if (active && !speaking && !muted) window.setTimeout(startRecognition, 300);
    };
  }

  async function openVoiceRoom() {
    // A sala deve abrir mesmo quando o navegador não oferece reconhecimento de fala.
    try {
      if (!room.open) room.showModal();
    } catch (error) {
      room.setAttribute("open", "");
    }
    roomTranscript.textContent = "Preparando a conversa por voz…";
    setStatus("Preparando o microfone…", "idle");

    if (!SpeechRecognition) {
      setStatus("A tela de voz abriu, mas este navegador não oferece reconhecimento de fala. Teste no Chrome ou Edge atualizado.", "error");
      roomTranscript.textContent = "Reconhecimento de voz indisponível neste navegador.";
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("O navegador não liberou áudio. Abra a DINA em HTTPS.", "error");
      roomTranscript.textContent = "Não foi possível acessar o recurso de áudio do navegador.";
      return;
    }
    setStatus("Solicitando acesso ao microfone…", "idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      active = true;
      muted = false;
      micButton.textContent = "🔴";
      setStatus("Estou ouvindo…", "listening");
      startRecognition();
    } catch (error) {
      active = false;
      const reason = error?.name || error?.message || "erro desconhecido";
      const messages = {
        NotAllowedError: "Acesso bloqueado. Autorize o microfone nas permissões do site e do Windows.",
        PermissionDeniedError: "Acesso negado. Autorize o microfone nas permissões do site e do Windows.",
        NotFoundError: "Nenhum microfone foi encontrado. Conecte ou habilite um dispositivo.",
        NotReadableError: "O microfone está sendo usado por outro aplicativo.",
        SecurityError: "O navegador bloqueou o microfone. Abra a DINA em HTTPS."
      };
      setStatus(messages[reason] || ("Falha ao acessar o microfone: " + reason), "error");
      roomTranscript.textContent = "Falha ao iniciar o áudio: " + reason;
    }
  }

  micButton.addEventListener("click", openVoiceRoom);
  $("#voice-close")?.addEventListener("click", closeRoom);
  $("#voice-end")?.addEventListener("click", closeRoom);
  room.addEventListener("cancel", (event) => { event.preventDefault(); closeRoom(); });
  muteButton?.addEventListener("click", () => {
    if (!active) { openVoiceRoom(); return; }
    muted = !muted;
    if (muted) {
      if (recognition) { try { recognition.stop(); } catch {} }
      muteButton.textContent = "🔇";
      muteButton.classList.add("is-muted");
      setStatus("Microfone pausado.", "idle");
    } else {
      muteButton.textContent = "🎙️";
      muteButton.classList.remove("is-muted");
      setStatus("Voltando a ouvir…", "listening");
      startRecognition();
    }
  });

  document.addEventListener("dina:assistant-response", event => {
    if (active && event.detail?.text) {
      roomTranscript.textContent = "DINA: " + event.detail.text;
      speak(event.detail.text);
    }
  });
  if (synth) synth.onvoiceschanged = choosePortugueseVoice;
  setStatus("Microfone desligado.");
})();