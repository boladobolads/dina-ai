const noStore = { "Cache-Control": "no-store" };

function fail(message, status = 400) {
  return Response.json({ error: message }, { status, headers: noStore });
}

export async function onRequestPost({ request, env }) {
  if (!env.DINA_ACCESS_CODE) return fail("Configure DINA_ACCESS_CODE como Secret no Cloudflare.", 503);
  if ((request.headers.get("X-DINA-ACCESS-CODE") || "") !== env.DINA_ACCESS_CODE) {
    return fail("Código de acesso inválido.", 401);
  }
  if (!env.FISH_AUDIO_API_KEY) return fail("Fish Audio ainda não está configurado no Cloudflare.", 503);

  let body;
  try { body = await request.json(); } catch { return fail("Solicitação inválida."); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const profile = body.profile === "fish" ? "fish" : "dina";
  if (!text) return fail("Não há texto para transformar em voz.");
  if (text.length > 5000) return fail("Texto muito longo para uma única geração.", 413);

  const referenceId = env.FISH_DINA_VOICE_ID;

  const payload = { text, format: "mp3" };
  if (referenceId) payload.reference_id = referenceId;

  let response;
  try {
    response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.FISH_AUDIO_API_KEY,
        "Content-Type": "application/json",
        "model": env.FISH_AUDIO_MODEL || "s2.1-pro-free"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000)
    });
  } catch (error) {
    return fail("Não foi possível conectar ao Fish Audio: " + (error?.message || "erro de rede"), 502);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 700);
    return fail("Fish Audio respondeu com HTTP " + response.status + (detail ? ": " + detail : ""), response.status === 429 ? 429 : 502);
  }

  // Fish Audio pode responder com application/octet-stream; o payload solicitado é MP3.
  // Definimos o MIME de áudio explicitamente para o elemento Audio do navegador.
  const audioBytes = await response.arrayBuffer();
  if (!audioBytes.byteLength) return fail("Fish Audio retornou um arquivo de áudio vazio.", 502);
  const bytes = new Uint8Array(audioBytes);
  const isMp3 = (bytes.length > 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (!isMp3) {
    const preview = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 180))).replace(/[\\x00-\\x1f]/g, " ");
    return fail("A resposta do Fish Audio não parece ser MP3. Content-Type recebido: " + (response.headers.get("Content-Type") || "não informado") + (preview ? ". Resposta: " + preview : ""), 502);
  }
  return new Response(audioBytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBytes.byteLength),
      "Cache-Control": "no-store",
      "X-DINA-TTS": "fish-audio"
    }
  });
}
