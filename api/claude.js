export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured in Vercel environment variables' });
  }

  try {
    const { messages, max_tokens = 1000, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const body = {
      model: 'llama-3.3-70b-versatile',
      max_tokens,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      temperature: 0.2,
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || `Groq error ${response.status}` });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: data.choices[0].message.content }]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
