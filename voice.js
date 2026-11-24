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
  const voiceProfile = $("#voice-profile");
  let savedProfile = localStorage.getItem("dina_voice_profile");
  let selectedProfile = ["dina", "jarvis", "fish", "fish2", "fish3"].includes(savedProfile) ? savedProfile : "dina";
  if (voiceProfile) voiceProfile.value = selectedProfile;
  if (!micButton || !status || !transcript || !room) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let recognition = null;
  let active = false;
  let muted = false;
  let speaking = false;
  let restartAfterSpeech = false;
  let permissionStream = null;
  // Envia a fala após 650 ms sem novas palavras, sem esperar a pausa longa do navegador.
  let speechSilenceTimer = null;
  let lastVoiceSubmission = "";
  let currentAudio = null;
  let currentAudioUrl = "";
  let fishAudioContext = null;
  let fishAudioSource = null;
  let recognitionStarting = false;
  let recognitionRunning = false;
  let ttsController = null;
  let speechRun = 0;

  // Diagnóstico visível: registra etapas e erros sem coletar mensagens ou chaves.
  const diag = document.createElement("section");
  diag.id = "voice-diagnostics";
  diag.style.cssText = "width:min(100%,560px);margin:18px auto 0;text-align:left;background:#111827;border:1px solid #374151;border-radius:12px;padding:12px;color:#e5e7eb;font:12px/1.45 monospace";
  diag.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><strong>Diagnóstico do áudio</strong><span style="display:flex;gap:6px"><button type="button" id="voice-test-mic" style="padding:6px 10px;border-radius:8px">Testar microfone</button><button type="button" id="voice-copy-log" style="padding:6px 10px;border-radius:8px">Copiar log</button></span></div><pre id="voice-log" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;margin:0">Aguardando teste…</pre>';
  room.querySelector(".voice-room-inner")?.appendChild(diag);
  const logOutput = diag.querySelector("#voice-log");
  const logLines = [];
  function logAudio(label, detail = "") {
    const line = new Date().toLocaleTimeString("pt-BR") + " | " + label + (detail ? " | " + detail : "");
    logLines.push(line);
    if (logLines.length > 80) logLines.shift();
    if (logOutput) logOutput.textContent = logLines.join("\\n");
    console.info("[DINA-VOICE]", line);
  }
  diag.querySelector("#voice-test-mic")?.addEventListener("click", async () => {
    logAudio("Teste independente iniciado", "getUserMedia({audio:true})");
    if (!navigator.mediaDevices?.getUserMedia) {
      logAudio("Teste independente indisponível", "mediaDevices.getUserMedia ausente");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      logAudio("CAPTURA DE MICROFONE OK", "tracks=" + tracks.length + "; label=" + (tracks[0]?.label || "sem identificação") + "; readyState=" + (tracks[0]?.readyState || "desconhecido"));
      stream.getTracks().forEach(track => track.stop());
      logAudio("Teste independente finalizado", "stream encerrada após confirmação");
    } catch (error) {
      logAudio("FALHA NA CAPTURA DO MICROFONE", error.name + ": " + error.message);
    }
  });
  diag.querySelector("#voice-copy-log")?.addEventListener("click", async () => {
    const report = [
      "DINA - DIAGNÓSTICO DE ÁUDIO",
      "Navegador: " + navigator.userAgent,
      "HTTPS seguro: " + window.isSecureContext,
      "SpeechRecognition: " + Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      "MediaDevices: " + Boolean(navigator.mediaDevices),
      ...logLines
    ].join("\\n");
    try {
      await navigator.clipboard.writeText(report);
      diag.querySelector("#voice-copy-log").textContent = "Copiado!";
    } catch (error) {
      logAudio("Falha ao copiar log", error.name + ": " + error.message);
      logOutput.textContent = report;
    }
  });
  logAudio("Script de voz carregado", "secureContext=" + window.isSecureContext +
    "; SpeechRecognition=" + Boolean(window.SpeechRecognition || window.webkitSpeechRecognition) +
    "; mediaDevices=" + Boolean(navigator.mediaDevices));
  window.addEventListener("error", e => logAudio("Erro JavaScript", (e.message || "sem mensagem") + " em " + (e.filename || "") + ":" + (e.lineno || "")));
  window.addEventListener("unhandledrejection", e => logAudio("Promise rejeitada", e.reason?.name + ": " + e.reason?.message));

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
    if (permissionStream) { permissionStream.getTracks().forEach(track => track.stop()); permissionStream = null; }
    speaking = false;
    if (recognition) { try { recognition.stop(); } catch {} }
    stopCurrentSpeech();
    if (room.open) room.close();
    micButton.textContent = "🎙️";
    muteButton?.classList.remove("is-muted");
    if (muteButton) muteButton.textContent = "🎙️";
    setStatus("Microfone desligado.");
  }

  function choosePortugueseVoice(profile = selectedProfile) {
    const voices = synth ? synth.getVoices() : [];
    const pt = voices.filter(v => /^pt(-|_)/i.test(v.lang));
    const brazilian = pt.filter(v => /^pt[-_]BR$/i.test(v.lang));
    const pool = brazilian.length ? brazilian : pt;
    const names = {
      dina: /female|feminina|woman|mulher|francisca|maria|luciana|camila|fernanda|heloisa|helena|leticia|bruna/i,
      jarvis: /male|mascul|homem|daniel|ricardo|antonio|carlos|jorge|felipe|thiago|bruno|guilherme|google português do brasil/i,
      fish: /female|feminina|woman|mulher|francisca|maria|luciana|camila|fernanda|heloisa|helena|leticia|bruna/i,
    };
    const natural = /natural|online|neural|google/i;
    const matching = pool.filter(v => names[profile]?.test(v.name));
    return matching.find(v => natural.test(v.name)) || matching[0]
      || pool.find(v => natural.test(v.name)) || pool[0] || voices[0] || null;
  }

  function applyVoiceProfile() {
    if (!voiceProfile) return;
    selectedProfile = voiceProfile.value;
    localStorage.setItem("dina_voice_profile", selectedProfile);
    const labels = {
      dina: "DINA feminina selecionada",
      jarvis: "Perfil JARVIS selecionado",
      fish: "Fish Audio — Voz 1 selecionada",
      fish2: "Fish Audio — Voz 2 selecionada",
      fish3: "Fish Audio — Voz 3 selecionada",
    };
    logAudio("Perfil de voz alterado", labels[selectedProfile] || selectedProfile);
    if (active && speaking) {
      const current = roomTranscript.textContent.replace(/^DINA:\s*/, "");
      stopCurrentSpeech();
      speak(current);
    }
  }
  voiceProfile?.addEventListener("change", applyVoiceProfile);

  function stopCurrentSpeech() {
    speechRun++;
    if (ttsController) { ttsController.abort(); ttsController = null; }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeAttribute("src");
      currentAudio.load();
      currentAudio = null;
    }
    if (fishAudioSource) {
      try { fishAudioSource.stop(); } catch {}
      fishAudioSource.onended = null;
      fishAudioSource = null;
    }
    if (fishAudioContext) {
      try { fishAudioContext.close(); } catch {}
      fishAudioContext = null;
    }
    if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = ""; }
    if (synth) synth.cancel();
    speaking = false;
  }

  function finishSpeech(run) {
    if (run !== speechRun) return;
    speaking = false;
    currentAudio = null;
    fishAudioSource = null;
    if (fishAudioContext) {
      const finishedContext = fishAudioContext;
      fishAudioContext = null;
      finishedContext.close().catch(() => {});
    }
    if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = ""; }
    if (active && restartAfterSpeech && !muted) {
      setStatus("Sua vez! Pode falar.", "listening");
      logAudio("DINA terminou de falar", "reativando escuta");
      startRecognition();
    } else if (active) {
      setStatus("Microfone pausado.", "idle");
    }
  }

  function speakWithBrowser(clean, run) {
    if (!synth || run !== speechRun || !active) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 7000));
    utterance.lang = "pt-BR";
    const profiles = {
      dina: { rate: 1.0, pitch: 1.16 },
      jarvis: { rate: 0.88, pitch: 0.72 },
    };
    const profile = profiles[selectedProfile] || profiles.dina;
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = 1;
    const voice = choosePortugueseVoice(selectedProfile);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (run === speechRun) setStatus("A DINA está respondendo por voz…", "speaking");
    };
    utterance.onend = () => finishSpeech(run);
    utterance.onerror = () => {
      if (run === speechRun) {
        speaking = false;
        if (active) setStatus("Não foi possível reproduzir a resposta.", "error");
      }
    };
    synth.speak(utterance);
  }

  async function speak(text) {
    if (!text || !active) return;
    const clean = String(text).replace(/https?:\/\/\S+/g, "link disponível na conversa")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, "")
      .replace(/[*_#`]/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();
    if (!clean) return;

    if (!["fish", "fish2", "fish3"].includes(selectedProfile)) {
      stopCurrentSpeech();
      const browserRun = speechRun;
      speaking = true;
      restartAfterSpeech = active && !muted;
      speakWithBrowser(clean, browserRun);
      return;
    }

    stopCurrentSpeech();
    const run = speechRun;
    speaking = true;
    restartAfterSpeech = active && !muted;
    setStatus("Preparando a voz da DINA…", "speaking");
    ttsController = new AbortController();

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DINA-ACCESS-CODE": sessionStorage.getItem("dina_access_code") || ""
        },
        body: JSON.stringify({ text: clean.slice(0, 5000), profile: selectedProfile }),
        signal: ttsController.signal
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || "Fish Audio HTTP " + response.status);
      }
      const audioBlob = await response.blob();
      logAudio("Resposta TTS recebida", "content-type=" + (response.headers.get("Content-Type") || "não informado") + "; blob.type=" + audioBlob.type + "; bytes=" + audioBlob.size);
      if (run !== speechRun || !active) return;
      if (!audioBlob.size) throw new Error("Fish Audio retornou um áudio vazio.");
      // Decodifica o MP3 diretamente com Web Audio, evitando falhas do elemento HTMLAudio.
      const audioBytes = await audioBlob.arrayBuffer();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Este navegador não oferece AudioContext para decodificar o MP3.");
      fishAudioContext = new AudioContextClass();
      await fishAudioContext.resume();
      let decodedAudio;
      try {
        decodedAudio = await fishAudioContext.decodeAudioData(audioBytes.slice(0));
      } catch (decodeError) {
        const head = Array.from(new Uint8Array(audioBytes.slice(0, 12)))
          .map(value => value.toString(16).padStart(2, "0")).join(" ");
        throw new Error("Chrome não conseguiu decodificar o MP3 (" + decodeError.name + "). bytes iniciais: " + head);
      }
      if (run !== speechRun || !active) return;
      fishAudioSource = fishAudioContext.createBufferSource();
      fishAudioSource.buffer = decodedAudio;
      fishAudioSource.connect(fishAudioContext.destination);
      fishAudioSource.onended = () => finishSpeech(run);
      setStatus("A DINA está falando…", "speaking");
      fishAudioSource.start(0);
      logAudio("Fish Audio ativo", "perfil=" + selectedProfile + "; duração=" + decodedAudio.duration.toFixed(2) + "s; canais=" + decodedAudio.numberOfChannels);
    } catch (error) {
      if (run !== speechRun || error.name === "AbortError") return;
      logAudio("Fish Audio indisponível", (error.message || "falha") + "; usando voz nativa");
      ttsController = null;
      speakWithBrowser(clean, run);
    } finally {
      if (run === speechRun) ttsController = null;
    }
  }

  function startRecognition() {
    if (!recognition || !active || muted || recognitionStarting || recognitionRunning) return;
    recognitionStarting = true;
    try { recognition.start(); }
    catch (error) {
      recognitionStarting = false;
      if (error.name !== "InvalidStateError") {
        logAudio("Exceção em recognition.start()", error.name + ": " + error.message);
        setStatus("Falha ao iniciar reconhecimento: " + error.message, "error");
      } else {
        logAudio("Início duplicado bloqueado", "SpeechRecognition já estava ativo");
      }
    }
  }

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      recognitionStarting = false;
      recognitionRunning = true;
      logAudio("SpeechRecognition onstart", "reconhecimento iniciado");
      setStatus("Estou ouvindo…", "listening");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += phrase + " ";
        else interimText += phrase;
      }
      // Enquanto a DINA fala, só aceitamos a palavra de ativação; ignoramos o eco da própria voz.
      if (speaking) {
        const heard = (finalText + " " + interimText).toLocaleLowerCase("pt-BR");
        if (/(^|\\W)dina(\\W|$)/i.test(heard)) {
          logAudio("Palavra de ativação detectada", "DINA");
          restartAfterSpeech = false;
          stopCurrentSpeech();
          setStatus("Pode falar. Estou ouvindo…", "listening");
          startRecognition();
        }
        return;
      }
      if (interimText) {
        roomTranscript.textContent = interimText;
        transcript.textContent = "Reconhecendo: " + interimText;
        // Reinicia o contador a cada palavra reconhecida: 650 ms de silêncio = fim da frase.
        if (speechSilenceTimer) window.clearTimeout(speechSilenceTimer);
        speechSilenceTimer = window.setTimeout(() => {
          const phrase = (roomTranscript.textContent || "").trim();
          if (active && !speaking && phrase && phrase !== lastVoiceSubmission && !phrase.startsWith("Você:")) {
            lastVoiceSubmission = phrase;
            $("#message").value = phrase;
            roomTranscript.textContent = "Você: " + phrase;
            transcript.textContent = "Você: " + phrase;
            $("#chat-form").requestSubmit();
          }
        }, 650);
      }
      if (finalText.trim()) {
        if (speechSilenceTimer) window.clearTimeout(speechSilenceTimer);
        speechSilenceTimer = null;
        const phrase = finalText.trim();
        if (phrase !== lastVoiceSubmission) {
          lastVoiceSubmission = phrase;
          $("#message").value = phrase;
          roomTranscript.textContent = "Você: " + phrase;
          transcript.textContent = "Você: " + phrase;
          $("#chat-form").requestSubmit();
        }
      }
    };
    recognition.onerror = (event) => {
      logAudio("SpeechRecognition onerror", "error=" + event.error + "; message=" + (event.message || "não informado") + "; readyState=" + document.readyState);
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
      recognitionStarting = false;
      recognitionRunning = false;
      logAudio("SpeechRecognition onend", "active=" + active + "; muted=" + muted + "; speaking=" + speaking);
      // O Chrome pode encerrar o reconhecimento sozinho; mantém a conversa viva.
      if (active && !muted) window.setTimeout(startRecognition, 150);
    };
  }

  async function openVoiceRoom() {
    logAudio("Clique no microfone", "secureContext=" + window.isSecureContext + "; permission API=" + Boolean(navigator.permissions));
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "microphone" }).then(p => {
        logAudio("Permissão do navegador", "state=" + p.state);
        p.onchange = () => logAudio("Permissão alterada", "state=" + p.state);
      }).catch(e => logAudio("Consulta de permissão indisponível", e.name + ": " + e.message));
    }
    // A sala deve abrir mesmo quando o navegador não oferece reconhecimento de fala.
    try {
      if (!room.open) room.showModal();
    } catch (error) {
      room.setAttribute("open", "");
    }
    roomTranscript.textContent = "Preparando a conversa por voz…";
    setStatus("Preparando o microfone…", "idle");

    if (!SpeechRecognition) {
      logAudio("API ausente", "SpeechRecognition não está disponível neste navegador");
      setStatus("A tela de voz abriu, mas este navegador não oferece reconhecimento de fala. Teste no Chrome ou Edge atualizado.", "error");
      roomTranscript.textContent = "Reconhecimento de voz indisponível neste navegador.";
      return;
    }
    // Solicita a permissão explicitamente durante o clique do usuário.
    // A stream é encerrada após a autorização; o SpeechRecognition assume em seguida.
    if (!navigator.mediaDevices?.getUserMedia) {
      logAudio("getUserMedia indisponível", "navigator.mediaDevices.getUserMedia ausente");
      setStatus("Este navegador não permite acessar o microfone. Atualize o Chrome.", "error");
      return;
    }
    setStatus("Solicitando autorização para usar o microfone…", "idle");
    logAudio("Solicitando permissão explícita", "getUserMedia({audio:true})");
    try {
      permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = permissionStream.getAudioTracks();
      logAudio("PERMISSÃO CONCEDIDA", "tracks=" + tracks.length + "; label=" + (tracks[0]?.label || "sem identificação"));
      permissionStream.getTracks().forEach(track => track.stop());
      permissionStream = null;
    } catch (error) {
      logAudio("PERMISSÃO DO MICROFONE RECUSADA", error.name + ": " + error.message);
      active = false;
      micButton.textContent = "🎙️";
      setStatus(error.name === "NotAllowedError"
        ? "O Chrome bloqueou o acesso ao microfone para este site. Verifique a permissão específica de dina-ai.pages.dev."
        : "Não foi possível acessar o microfone: " + error.message, "error");
      roomTranscript.textContent = "A DINA não recebeu autorização para acessar o microfone. Consulte o diagnóstico.";
      return;
    }
    active = true;
    muted = false;
    micButton.textContent = "🔴";
    setStatus("Autorização concedida. Iniciando reconhecimento…", "idle");
    logAudio("Solicitando início do reconhecimento", "idioma=pt-BR; continuous=true");
    startRecognition();
  }

  function interruptAndListen() {
    if (!active) { openVoiceRoom(); return; }
    // Interrompe imediatamente a síntese e mantém a sala aberta para ouvir o usuário.
    restartAfterSpeech = false;
    stopCurrentSpeech();
    muted = false;
    if (muteButton) {
      muteButton.textContent = "🎙️";
      muteButton.classList.remove("is-muted");
    }
    setStatus("Pode falar. Estou ouvindo…", "listening");
    startRecognition();
    logAudio("Interrupção manual", "DINA parou de falar e voltou a ouvir");
  }

  micButton.addEventListener("click", openVoiceRoom);
  orb?.addEventListener("click", interruptAndListen);
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
  if (synth) synth.onvoiceschanged = () => choosePortugueseVoice(selectedProfile);
  setStatus("Microfone desligado.");
})();