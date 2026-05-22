// api/analyze.js (Vercel Serverless 精简版)
export default async function handler(req, res) {
    // 1. 设置跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: '请使用POST请求' });

    try {
        const { url, platform, comments } = req.body;
        
        if (!url) return res.status(400).json({ error: '缺少链接参数' });

        // 2. 构建Prompt（精简版）
        const systemPrompt = `你是一个专业的竞品评论分析师。请根据提供的评论区内容，进行简要分析。
        返回纯JSON格式：{"summary":"30字内总结","topics":["选题1","选题2","选题3"]}`;

        const userMessage = comments 
            ? `链接：${url}\n评论区内容：${comments}`
            : `链接：${url}\n（未提供评论）`;

        // 3. 调用DeepSeek API
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
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(500).json({ error: 'AI调用失败: ' + (errData.error?.message || '未知错误') });
        }

        const data = await response.json();
        const cleanText = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        
        // 尝试解析JSON
        try {
            const result = JSON.parse(cleanText);
            return res.status(200).json(result);
        } catch (parseError) {
            // 解析失败则返回原始文本
            return res.status(200).json({ summary: cleanText, topics: [] });
        }

    } catch (e) {
        return res.status(500).json({ error: '服务器内部错误: ' + e.message });
    }
}