const noStore = { "Cache-Control": "no-store" };

function json(data, status = 200) {
  return Response.json(data, { status, headers: noStore });
}
function authorized(request, env) {
  return Boolean(env.DINA_ACCESS_CODE) &&
    (request.headers.get("X-DINA-ACCESS-CODE") || "") === env.DINA_ACCESS_CODE;
}
function engineBase(env) {
  const raw = String(env.DINA_VIDEO_ENGINE_URL || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return json({ error: "Código de acesso inválido." }, 401);
  const base = engineBase(env);
  if (!base) {
    return json({
      engine: "ComfyUI",
      configured: false,
      connected: false,
      state: "not_configured",
      message: env.DINA_VIDEO_ENGINE_URL
        ? "A URL do motor precisa ser HTTPS e válida."
        : "O servidor ComfyUI ainda não foi conectado.",
      target: "Wan 2.2 TI2V-5B · 720p"
    });
  }
  try {
    const headers = {};
    if (env.DINA_VIDEO_ENGINE_TOKEN) headers.Authorization = "Bearer " + env.DINA_VIDEO_ENGINE_TOKEN;
    const response = await fetch(base + "/system_stats", {
      headers,
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      return json({
        engine: "ComfyUI", configured: true, connected: false,
        state: "unavailable", message: "O servidor ComfyUI respondeu com HTTP " + response.status + "."
      }, 502);
    }
    const data = await response.json();
    const devices = Array.isArray(data.devices) ? data.devices.map(device => ({
      name: String(device.name || device.type || "GPU").slice(0, 100),
      vramTotal: Number.isFinite(device.vram_total) ? device.vram_total : null,
      vramFree: Number.isFinite(device.vram_free) ? device.vram_free : null
    })) : [];
    return json({
      engine: "ComfyUI",
      configured: true,
      connected: true,
      state: "online",
      version: String(data.system?.comfyui_version || "conectado").slice(0, 40),
      devices,
      target: "Wan 2.2 TI2V-5B · 720p",
      generationEnabled: false,
      message: "Conexão confirmada. A fila de geração será habilitada após instalar e validar o workflow Wan 2.2."
    });
  } catch {
    return json({
      engine: "ComfyUI", configured: true, connected: false,
      state: "connection_error",
      message: "Não foi possível alcançar o servidor. Verifique URL, túnel, token e disponibilidade da GPU."
    }, 502);
  }
}
