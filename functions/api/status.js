export async function onRequestGet({ env }) {
  const providers = {
    gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL),
    ollama: Boolean(env.OLLAMA_BASE_URL && env.OLLAMA_MODEL),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL)
  };
  const order = (env.DINA_PROVIDER_ORDER || "gemini,openrouter,ollama,openai").split(",").map(s => s.trim()).filter(p => providers[p]);
  return Response.json({
    assistant: "DINA",
    accessRequired: Boolean(env.DINA_ACCESS_CODE),
    providers,
    defaultProvider: "auto",
    providerOrder: order,
    webSearch: env.DINA_WEB_SEARCH !== "false" || env.ENABLE_WEB_SEARCH === "true",
    video: Boolean(env.NURETA_API_KEY),
    videoEngine: Boolean(env.DINA_VIDEO_ENGINE_URL),
    ready: Boolean(env.DINA_ACCESS_CODE && order.length)
  }, { headers: { "Cache-Control": "no-store" } });
}
