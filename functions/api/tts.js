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
  const profile = body.profile === "jarvis" ? "jarvis" : "dina";
  if (!text) return fail("Não há texto para transformar em voz.");
  if (text.length > 5000) return fail("Texto muito longo para uma única geração.", 413);

  const referenceId = profile === "jarvis"
    ? env.FISH_JARVIS_VOICE_ID
    : env.FISH_DINA_VOICE_ID;

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

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "no-store",
      "X-DINA-TTS": "fish-audio"
    }
  });
}
