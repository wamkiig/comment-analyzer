// api/analyze.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: '请使用POST请求' });

    try {
        const { url, platform, comments } = req.body;
        if (!url) return res.status(400).json({ error: '缺少链接参数' });

        const systemPrompt = `你是评论区分析师，请根据提供的评论内容，给出用户画像、痛点、选题建议等。返回JSON。`;
        const userMsg = comments ? `链接：${url}\n评论：${comments}` : `链接：${url}`;

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
                    { role: 'user', content: userMsg }
                ],
                temperature: 0.7,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(500).json({ error: errData.error?.message || 'AI调用失败' });
        }

        const data = await response.json();
        const raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        const result = JSON.parse(raw);
        return res.status(200).json(result);

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}