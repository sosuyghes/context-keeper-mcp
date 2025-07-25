const express = require('express');
const cors = require('cors');
const app = express();

// CORS ayarları - Claude'dan erişim için
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Ana endpoint - MCP protokolü için
app.get('/', (req, res) => {
  res.json({
    name: "Context Keeper MCP",
    version: "1.0.0",
    protocol: "mcp",
    methods: ["storeContext", "getContext", "listContexts"]
  });
});

// Context'leri saklamak için basit bir obje
let contexts = {};

// Context kaydetme
app.post('/context', (req, res) => {
  const { id, content } = req.body;
  contexts[id] = { content, timestamp: new Date() };
  res.json({ success: true, id });
});

// Context alma
app.get('/context/:id', (req, res) => {
  const context = contexts[req.params.id];
  if (context) {
    res.json(context);
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

// Tüm context'leri listeleme
app.get('/contexts', (req, res) => {
  res.json(Object.keys(contexts));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
