// api/claude.js
// Vercel Serverless Function — secure proxy to Groq API (free tier)
// Your Groq API key lives ONLY here in Vercel environment variables
// The frontend never sees the key — users just click and it works

export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`Request from: ${ip}`);

  try {
    const { messages, max_tokens = 1000, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Build Groq request — OpenAI-compatible format
    const body = {
      model: 'llama-3.3-70b-versatile',  // Groq's best free model
      max_tokens,
      messages: system
        ? [{ role: 'system', content: system }, ...messages]
        : messages,
      temperature: 0.3,
    };

    // Call Groq — key comes from Vercel environment variable GROQ_API_KEY
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,  // ← never exposed to frontend
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }

    // Convert Groq response format to match what the frontend expects
    // Groq uses OpenAI format: data.choices[0].message.content
    // We return it in a consistent shape
    return res.status(200).json({
      content: [{
        type: 'text',
        text: data.choices[0].message.content
      }]
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
