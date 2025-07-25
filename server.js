// server.js - Simple Context Keeper
const express = require('express');
const fs = require('fs').promises;
const app = express();

app.use(express.json());

let projects = {}; // Simple in-memory storage

// MCP Tools
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

// Execute tools
app.post('/call', (req, res) => {
  const { name, arguments: args } = req.body;
  
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
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', projects: Object.keys(projects) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Context MCP Server running on port ${PORT}`);
});
