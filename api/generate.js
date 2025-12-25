export default async function handler(req, res) {
  // CORS headers - allow requests from your app
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, modelId } = req.body;
    
    // Get the key from Vercel Environment Variables
    const apiKey = process.env.OPENROUTER_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://xpostr.app", // Optional: Change to your app URL
        "X-Title": "xPostr", // Optional: Change to your app name
      },
      body: JSON.stringify({
        model: modelId || "mistralai/mistral-7b-instruct:free",
        messages: [
          {
            role: "system",
            content: "You are an expert social media content generator. Your task is to output ONLY the raw tweet text. Do not include any introductory text, explanations, or quotes. Do not repeat the prompt. Ensure the tweet is within the character limit."
          },
          {
            role: "user",
            content: prompt
          }
        ],
      })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'OpenRouter API error');
    }

    // Return just the content string to match what the app expects
    const content = data.choices[0].message.content;
    return res.status(200).json({ content });

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
