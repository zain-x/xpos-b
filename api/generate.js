export default async function handler(req, res) {
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  };

  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!req.body) {
       return res.status(400).json({ error: 'Missing request body' });
    }
    
    const { prompt, modelId } = req.body;

    if (!prompt) {
       return res.status(400).json({ error: 'Missing prompt in request body' });
    }
    
    // Support multiple keys: split by comma if OPENROUTER_KEY has multiple, or use OPENROUTER_KEYS
    const rawKeys = process.env.OPENROUTER_KEYS || process.env.OPENROUTER_KEY || "";
    let apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k);

    if (apiKeys.length === 0) {
      return res.status(500).json({ error: 'Server configuration error: Missing API Keys' });
    }

    // Shuffle keys to distribute load (random load balancing)
    apiKeys = apiKeys.sort(() => Math.random() - 0.5);

    let lastError = null;

    // Try keys one by one
    for (const apiKey of apiKeys) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://xpostr.vercel.app",
            "X-Title": "xPostr",
          },
          body: JSON.stringify({
            "model": modelId || "xiaomi/mimo-v2-flash:free",
            "messages": [
              {
                "role": "system",
                "content": "You are an expert social media content generator. Output ONLY the raw tweet text. No intro, no quotes, no labels (like 'Tweet:'). If the prompt is in Arabic, reply in Arabic only."
              },
              { "role": "user", "content": prompt }
            ]
          })
        });

        const data = await response.json();

        // If specific rate limit error, throw to catch block and try next key
        if (data.error) {
           // Check for rate limit or credit limit messages
           const errMsg = (data.error.message || "").toLowerCase();
           if (errMsg.includes("rate limit") || errMsg.includes("credits") || errMsg.includes("quota")) {
               console.warn(`Key ...${apiKey.slice(-4)} hit limit: ${errMsg}. Switching key.`);
               throw new Error(`Rate limit exceeded: ${errMsg}`); // This triggers the catch block below
           }
           // For other errors (e.g. invalid model), might not help to switch keys, but let's be safe and throw anyway
           throw new Error(data.error.message || 'OpenRouter API Error');
        }
        
        if (!data.choices || data.choices.length === 0) {
           throw new Error('No content generated');
        }

        const content = data.choices[0].message.content;
        return res.status(200).json({ content });

      } catch (keyError) {
        lastError = keyError;
        // Continue to next key in loop
        continue;
      }
    }

    // If we exit the loop, all keys failed
    console.error('All keys failed. Last error:', lastError);
    return res.status(500).json({ error: lastError ? lastError.message : "All API keys failed" });

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
