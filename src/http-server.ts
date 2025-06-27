import express from 'express';
import cors from 'cors';
import { RobloxStudioTools } from './tools/index.js';
import { BridgeService } from './bridge-service.js';

export function createHttpServer(tools: RobloxStudioTools, bridge: BridgeService) {
  const app = express();
  let pluginConnected = false;
  let mcpServerActive = false;
  let lastMCPActivity = 0;
  let mcpServerStartTime = 0;

  // Track MCP server lifecycle
  const setMCPServerActive = (active: boolean) => {
    mcpServerActive = active;
    if (active) {
      mcpServerStartTime = Date.now();
      lastMCPActivity = Date.now();
    } else {
      mcpServerStartTime = 0;
      lastMCPActivity = 0;
    }
  };

  const trackMCPActivity = () => {
    if (mcpServerActive) {
      lastMCPActivity = Date.now();
    }
  };

  const isMCPServerActive = () => {
    return mcpServerActive && (Date.now() - lastMCPActivity < 15000); // 15 second timeout
  };

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'robloxstudio-mcp',
      pluginConnected,
      mcpServerActive: isMCPServerActive(),
      uptime: mcpServerActive ? Date.now() - mcpServerStartTime : 0
    });
  });

  // Plugin readiness endpoint
  app.post('/ready', (req, res) => {
    pluginConnected = true;
    res.json({ success: true });
  });

  // Enhanced status endpoint
  app.get('/status', (req, res) => {
    res.json({ 
      pluginConnected,
      mcpServerActive: isMCPServerActive(),
      lastMCPActivity,
      uptime: mcpServerActive ? Date.now() - mcpServerStartTime : 0
    });
  });

  // Enhanced polling endpoint for Studio plugin
  app.get('/poll', (req, res) => {
    if (!isMCPServerActive()) {
      res.status(503).json({ 
        error: 'MCP server not connected',
        pluginConnected: true,
        mcpConnected: false,
        request: null
      });
      return;
    }
    
    trackMCPActivity();
    
    const pendingRequest = bridge.getPendingRequest();
    if (pendingRequest) {
      res.json({ 
        request: pendingRequest.request, 
        requestId: pendingRequest.requestId,
        mcpConnected: true,
        pluginConnected: true
      });
    } else {
      res.json({ 
        request: null,
        mcpConnected: true,
        pluginConnected: true
      });
    }
  });

  // Response endpoint for Studio plugin
  app.post('/response', (req, res) => {
    const { requestId, response, error } = req.body;
    
    if (error) {
      bridge.rejectRequest(requestId, error);
    } else {
      bridge.resolveRequest(requestId, response);
    }
    
    res.json({ success: true });
  });

  // Middleware to track MCP activity for all MCP endpoints
  app.use('/mcp/*', (req, res, next) => {
    trackMCPActivity();
    next();
  });

  // MCP tool proxy endpoints - these will be called by AI tools
  app.post('/mcp/get_file_tree', async (req, res) => {
    try {
      const result = await tools.getFileTree(req.body.path);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  app.post('/mcp/search_files', async (req, res) => {
    try {
      const result = await tools.searchFiles(req.body.query, req.body.searchType);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  app.post('/mcp/get_place_info', async (req, res) => {
    try {
      const result = await tools.getPlaceInfo();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_services', async (req, res) => {
    try {
      const result = await tools.getServices(req.body.serviceName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  app.post('/mcp/search_objects', async (req, res) => {
    try {
      const result = await tools.searchObjects(req.body.query, req.body.searchType, req.body.propertyName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_instance_properties', async (req, res) => {
    try {
      const result = await tools.getInstanceProperties(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_instance_children', async (req, res) => {
    try {
      const result = await tools.getInstanceChildren(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/search_by_property', async (req, res) => {
    try {
      const result = await tools.searchByProperty(req.body.propertyName, req.body.propertyValue);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_class_info', async (req, res) => {
    try {
      const result = await tools.getClassInfo(req.body.className);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_set_property', async (req, res) => {
    try {
      const result = await tools.massSetProperty(req.body.paths, req.body.propertyName, req.body.propertyValue);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_get_property', async (req, res) => {
    try {
      const result = await tools.massGetProperty(req.body.paths, req.body.propertyName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/create_object_with_properties', async (req, res) => {
    try {
      const result = await tools.createObjectWithProperties(req.body.className, req.body.parent, req.body.name, req.body.properties);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_create_objects', async (req, res) => {
    try {
      const result = await tools.massCreateObjects(req.body.objects);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_create_objects_with_properties', async (req, res) => {
    try {
      const result = await tools.massCreateObjectsWithProperties(req.body.objects);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_project_structure', async (req, res) => {
    try {
      const result = await tools.getProjectStructure(req.body.path, req.body.maxDepth, req.body.scriptsOnly);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });



  // Add methods to control and check server status
  (app as any).isPluginConnected = () => pluginConnected;
  (app as any).setMCPServerActive = setMCPServerActive;
  (app as any).isMCPServerActive = isMCPServerActive;
  (app as any).trackMCPActivity = trackMCPActivity;

  return app;
}