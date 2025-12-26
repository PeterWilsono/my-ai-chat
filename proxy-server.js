// proxy-server.js - CORS 代理服务器
// 部署建议: Vercel / Railway / Render 等免费平台

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// 允许所有来源的跨域请求
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI Chat Proxy Server Running',
    timestamp: new Date().toISOString()
  });
});

// 代理转发路由
app.post('/api/chat', async (req, res) => {
  try {
    const { endpoint, apiKey, model, messages, max_completion_tokens, temperature } = req.body;

    // 参数验证
    if (!endpoint || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required parameters: endpoint or apiKey' 
      });
    }

    console.log(`[${new Date().toISOString()}] Proxying request to: ${endpoint}`);

    // 转发请求到实际的 AI API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'mimo-v2-flash',
        messages: messages || [],
        max_completion_tokens: max_completion_tokens || 1024,
        temperature: temperature || 0.3
      })
    });

    // 获取响应数据
    const data = await response.json();

    // 返回给客户端
    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] API Error:`, data);
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Proxy Error:`, error.message);
    res.status(500).json({ 
      error: 'Proxy server error', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📡 Ready to handle requests at /api/chat`);
});