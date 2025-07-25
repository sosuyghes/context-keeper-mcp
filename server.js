// server.js - Proper MCP Protocol Server
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let projects = {};

// MCP Standard endpoints
app.get('/', (req, res) => {
  res.json({
    name: "Context Keeper",
    version: "1.0.0",
    description: "Project context management server",
    protocol: "mcp"
  });
});

// MCP Tools list
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: "save_context",
        description: "Proje durumunu kaydet",
        inputSchema: {
          type: "object",
          properties: {
            project: { type: "string", description: "Proje adı" },
            status: { type: "string", description: "Mevcut durum" },
            completed: { type: "string", description: "Ne tamamlandı" },
            working_on: { type: "string", description: "Şu an ne üzerinde" },
            next: { type: "string", description: "Sırada ne var" },
            notes: { type: "string", description: "Özel notlar" }
          },
          required: ["project", "status"]
        }
      },
      {
        name: "get_context", 
        description: "Proje durumunu getir",
        inputSchema: {
          type: "object",
          properties: {
            project: { type: "string", description: "Proje adı" }
          },
          required: ["project"]
        }
      }
    ]
  });
});

// MCP Tool execution
app.post('/tools/call', (req, res) => {
  const { name, arguments: args } = req.body;
  
  try {
    if (name === 'save_context') {
      projects[args.project] = {
        ...args,
        timestamp: new Date().toISOString()
      };
      
      res.json({
        content: [{
          type: "text",
          text: `✅ ${args.project} durumu kaydedildi!\n📍 Durum: ${args.status}`
        }]
      });
    }
    
    else if (name === 'get_context') {
      const project = projects[args.project];
      if (!project) {
        res.json({
          content: [{
            type: "text",
            text: `❌ ${args.project} projesi bulunamadı`
          }]
        });
        return;
      }
      
      res.json({
        content: [{
          type: "text",
          text: `🎯 **${project.project}**\n\n📍 **Durum:** ${project.status}\n\n✅ **Tamamlanan:** ${project.completed || 'Belirtilmemiş'}\n\n🔄 **Üzerinde çalışılan:** ${project.working_on || 'Belirtilmemiş'}\n\n📋 **Sırada:** ${project.next || 'Belirtilmemiş'}\n\n💭 **Notlar:** ${project.notes || 'Yok'}\n\n🕒 **Son güncelleme:** ${project.timestamp}`
        }]
      });
    }
    
    else {
      res.status(400).json({ error: "Unknown tool" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    projects: Object.keys(projects),
    mcp: true
  });
});

// MCP Auth endpoints (Claude için)
app.get('/auth', (req, res) => {
  res.json({ authenticated: true });
});

app.post('/auth', (req, res) => {
  res.json({ authenticated: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP Context Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Tools: http://localhost:${PORT}/tools`);
});
