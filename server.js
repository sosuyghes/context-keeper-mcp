// server.js - Full OAuth 2.0 MCP Server
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();

app.use(cors());
app.use(express.json());

// Simple in-memory storage
let projects = {};
let clients = {};
let tokens = {};

// Generate secret key
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex');

// OAuth 2.0 Endpoints
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    scopes_supported: ["read", "write", "mcp"],
    code_challenge_methods_supported: ["S256"]
  });
});

// Dynamic Client Registration (RFC 7591)
app.post('/oauth/register', (req, res) => {
  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomBytes(32).toString('hex');
  
  clients[clientId] = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: req.body.redirect_uris || [],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "read write mcp",
    created_at: Date.now()
  };

  res.json({
    client_id: clientId,
    client_secret: clientSecret,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "read write mcp"
  });
});

// Authorization Endpoint
app.get('/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, state, code_challenge, response_type } = req.query;
  
  if (!clients[client_id]) {
    return res.status(400).json({ error: "invalid_client" });
  }

  // Generate authorization code
  const authCode = crypto.randomBytes(32).toString('hex');
  
  // Store auth code with client info
  tokens[authCode] = {
    client_id,
    redirect_uri,
    code_challenge,
    scope: "read write mcp",
    expires_at: Date.now() + 600000 // 10 minutes
  };

  // Auto-approve for development (in production, show user consent form)
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state);
  
  res.redirect(redirectUrl.toString());
});

// Token Endpoint
app.post('/oauth/token', (req, res) => {
  const { grant_type, code, client_id, client_secret, code_verifier } = req.body;
  
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  const authData = tokens[code];
  if (!authData || authData.expires_at < Date.now()) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  const client = clients[client_id];
  if (!client || client.client_secret !== client_secret) {
    return res.status(400).json({ error: "invalid_client" });
  }

  // Generate access token
  const accessToken = crypto.randomBytes(32).toString('hex');
  
  tokens[accessToken] = {
    client_id,
    scope: authData.scope,
    expires_at: Date.now() + 3600000 // 1 hour
  };

  // Clean up auth code
  delete tokens[code];

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: authData.scope
  });
});

// User Info Endpoint
app.get('/oauth/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const token = authHeader.substring(7);
  const tokenData = tokens[token];
  
  if (!tokenData || tokenData.expires_at < Date.now()) {
    return res.status(401).json({ error: "invalid_token" });
  }

  res.json({
    sub: "user123",
    name: "MCP User",
    preferred_username: "mcp_user"
  });
});

// Middleware to verify access token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = authHeader.substring(7);
  const tokenData = tokens[token];
  
  if (!tokenData || tokenData.expires_at < Date.now()) {
    return res.status(401).json({ error: "invalid_token" });
  }

  req.tokenData = tokenData;
  next();
}

// MCP Root Endpoint
app.get('/', (req, res) => {
  res.json({
    name: "Context Keeper MCP",
    version: "1.0.0",
    description: "OAuth 2.0 protected MCP server for project context management",
    protocol: "mcp",
    oauth: {
      authorization_endpoint: "/oauth/authorize",
      token_endpoint: "/oauth/token",
      registration_endpoint: "/oauth/register"
    }
  });
});

// MCP Tools (Protected)
app.get('/tools', verifyToken, (req, res) => {
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

// MCP Tool Execution (Protected)
app.post('/tools/call', verifyToken, (req, res) => {
  const { name, arguments: args } = req.body;
  
  try {
    if (name === 'save_context') {
      projects[args.project] = {
        ...args,
        timestamp: new Date().toISOString(),
        client_id: req.tokenData.client_id
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

// Health Check (Public)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    projects: Object.keys(projects).length,
    oauth: true,
    mcp: true,
    timestamp: new Date().toISOString()
  });
});

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(tokens).forEach(token => {
    if (tokens[token].expires_at < now) {
      delete tokens[token];
    }
  });
}, 300000); // Every 5 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OAuth 2.0 MCP Server running on port ${PORT}`);
  console.log(`🔒 OAuth endpoints configured`);
  console.log(`📋 Health: /health`);
  console.log(`🔧 Tools: /tools (requires auth)`);
});
