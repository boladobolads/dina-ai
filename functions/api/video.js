const noStore = { "Cache-Control": "no-store" };
const BASE = "https://developer.nureta.ai";
function fail(message, status = 400) {
  return Response.json({ error: message }, { status, headers: noStore });
}
function auth(request, env) {
  return Boolean(env.DINA_ACCESS_CODE) &&
    (request.headers.get("X-DINA-ACCESS-CODE") || "") === env.DINA_ACCESS_CODE;
}
async function nureta(path, env, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + env.NURETA_API_KEY,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(60000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.error || `Nureta respondeu com HTTP ${response.status}`;
    throw new Error(String(message).slice(0, 500));
  }
  return data;
}
export async function onRequestPost({ request, env }) {
  if (!auth(request, env)) return fail("Código de acesso inválido.", 401);
  if (!env.NURETA_API_KEY) return fail("O gerador de vídeo ainda não está conectado. Configure NURETA_API_KEY nos Secrets do Cloudflare.", 503);
  let body;
  try { body = await request.json(); } catch { return fail("Solicitação inválida."); }
  const action = body.action;
  try {
    if (action === "balance") {
      const data = await nureta("/api/v3/account", env);
      return Response.json({ balance_usd: data.balance_usd ?? null }, { headers: noStore });
    }
    if (action === "status") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!/^cgt-[A-Za-z0-9_-]{5,100}$/.test(id)) return fail("Identificador de vídeo inválido.");
      const data = await nureta("/api/v3/contents/generations/tasks/" + encodeURIComponent(id), env);
      return Response.json({
        task: {
          id: data.id,
          status: data.status,
          prompt: data.prompt,
          content: data.content || null,
          media: data.media || [],
          error: data.error || data.failure_reason || null,
          usage: data.usage || null
        }
      }, { headers: noStore });
    }
    if (action !== "create") return fail("Ação inválida.");
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 8 || prompt.length > 1200) return fail("Descreva a cena com 8 a 1.200 caracteres.");
    if (body.adultConfirmed !== true || body.consentConfirmed !== true || body.costConfirmed !== true) {
      return fail("Confirme que todos são adultos, que há consentimento e que aceita os custos antes de gerar.");
    }
    const model = ["seahorse-480p", "seahorse-720p", "seahorse-1080p"].includes(body.model) ? body.model : null;
    if (!model) return fail("Modelo de vídeo inválido.");
    const duration = Number(body.duration);
    const allowed = duration === 5 || duration === 8 || duration === 10 || duration === 12 || duration === 15 || (Number.isInteger(duration) && duration >= 16 && duration <= 180);
    if (!allowed) return fail("Duração inválida. Use 5, 8, 10, 12, 15 ou de 16 a 180 segundos.");
    const ratio = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"].includes(body.ratio) ? body.ratio : "16:9";
    const data = await nureta("/api/v3/contents/generations/tasks", env, {
      method: "POST",
      body: JSON.stringify({
        model,
        content: [{ type: "text", text: prompt }],
        duration,
        ratio,
        generate_audio: body.generateAudio === true
      })
    });
    return Response.json({
      task: {
        id: data.id,
        status: data.status,
        prompt: data.prompt,
        content: data.content || null,
        media: data.media || [],
        usage: data.usage || null
      }
    }, { status: 201, headers: noStore });
  } catch (error) {
    return fail(error?.message || "Falha ao comunicar com o gerador de vídeo.", 502);
  }
}
