export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/claude?jobs=1  →  proxy RemoteOK (avoids browser CORS) ──
  if (req.method === 'GET') {
    if (req.query.jobs !== '1') {
      return res.status(400).json({ error: 'Unknown GET request' });
    }
    try {
      const tag   = req.query.tag   || 'software';
      const limit = parseInt(req.query.limit) || 20;
      const url   = `https://remoteok.com/api?tag=${encodeURIComponent(tag)}`;

      const r = await fetch(url, {
        headers: {
          'User-Agent': 'HireAI-JobBoard/1.0',
          'Accept': 'application/json',
        }
      });

      if (!r.ok) {
        return res.status(r.status).json({ error: `RemoteOK returned ${r.status}` });
      }

      const raw = await r.json();
      // First element is a legal notice object — skip it
      const jobs = raw
        .filter(j => j.id && j.position)
        .slice(0, limit)
        .map(j => ({
          id:       'rok_' + j.id,
          title:    j.position,
          company:  j.company || 'Unknown',
          logo:     j.company_logo || '',
          location: (j.location && j.location !== 'Anywhere') ? j.location : 'Remote',
          mode:     'Remote',
          type:     'Full-time',
          exp:      '',
          domain:   mapDomain(j.tags || []),
          salary:   j.salary || '',
          skills:   (j.tags || []).slice(0, 6),
          desc:     stripHtml(j.description || '').slice(0, 300) + '...',
          badge:    'REMOTE',
          url:      j.url || '',
          source:   'remoteok',
          date:     j.date || '',
        }));

      return res.status(200).json({ jobs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/claude  →  Groq AI proxy ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: 'GROQ_API_KEY not configured — add it in Vercel → Settings → Environment Variables'
    });
  }

  try {
    const { messages, max_tokens = 1000, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const body = {
      model: 'llama-3.3-70b-versatile',
      max_tokens,
      messages: system
        ? [{ role: 'system', content: system }, ...messages]
        : messages,
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
      return res.status(response.status).json({
        error: data.error?.message || `Groq error ${response.status}`
      });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: data.choices[0].message.content }]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// ── helpers ──
function mapDomain(tags) {
  const t = tags.map(x => x.toLowerCase()).join(' ');
  if (t.includes('design') || t.includes('ux') || t.includes('ui'))    return 'Design';
  if (t.includes('devops') || t.includes('cloud') || t.includes('aws')) return 'DevOps';
  if (t.includes('data') || t.includes('ml') || t.includes('ai'))       return 'Data Science';
  if (t.includes('product') || t.includes('manager'))                   return 'Product';
  return 'Engineering';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
