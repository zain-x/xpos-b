export default {
  async fetch(request, env, ctx) {
    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS (Preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const { prompt, modelId } = await request.json();
      const apiKey = env.OPENROUTER_KEY; // Accessed via env parameter in Cloudflare

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Configuration Error: Missing API Key" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://xpostr.workers.dev",
          "X-Title": "xPostr Cloudflare",
        },
        body: JSON.stringify({
          model: modelId || "google/gemini-2.0-flash-exp:free",
          messages: [
            {
              role: "system",
              content: "You are an expert social media content generator. Output ONLY the raw tweet text. No intro, no quotes."
            },
            { role: "user", content: prompt }
          ]
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'OpenRouter API Error');
      }

      const content = data.choices[0].message.content;

      return new Response(JSON.stringify({ content }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },
};
