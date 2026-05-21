export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, platform, comments } = req.body;
  if (!url) return res.status(400).json({ error: '缺少链接' });

  const isXhs = platform !== 'douyin';

  let commentContext = '';
  if (comments && comments.trim().length > 0) {
    commentContext = `以下是该笔记/视频的真实评论区内容（节选）：\n${comments}\n请严格基于以上评论进行分析。`;
  } else {
    commentContext = '（未提供实际评论内容，请基于URL关键词推测，并在分析中说明“基于推测”）';
  }

  const systemPrompt = isXhs ? `你是小红书竞品评论区分析师...` : `你是抖音竞品评论区分析师...`;
  // 完整prompt与之前相同，保持返回JSON结构一致

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `链接：${url}\n${commentContext}` }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || '分析失败' });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content.trim();
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}