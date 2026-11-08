const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const authRoutes = require('./routes/authRoutes');
const albumRoutes = require('./routes/albumRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const photoRoutes = require('./routes/photoRoutes');

const app = express();

// Application Load Balancer (ALB) compatibility - Trust proxy configuration
if (config.TRUST_PROXY) {
  app.set('trust proxy', config.TRUST_PROXY === 'true' ? true : isNaN(config.TRUST_PROXY) ? config.TRUST_PROXY : parseInt(config.TRUST_PROXY, 10));
}

// CORS configuration driven by environment
app.use(cors({
  origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ALB & EC2 Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'photo-gallery-backend',
    environment: config.NODE_ENV,
    storage: config.STORAGE_DRIVER,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Primary API Routes
app.use('/auth', authRoutes);
app.use('/albums', albumRoutes);
app.use('/uploads', uploadRoutes);
app.use('/photos', photoRoutes);

// Static Web Application Serving (if exported into public)
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  // SPA Catch-all for non-API routes in Express 5
  app.use((req, res, next) => {
    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/albums') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/photos') ||
      req.path.startsWith('/health')
    ) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Photo Vault</title></head>
        <body style="font-family: sans-serif; background: #0B0F17; color: #F8FAFC; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <h2>Photo Vault Server Active</h2>
            <p style="color: #94A3B8;">Backend API is healthy on port ${config.PORT}.</p>
          </div>
        </body>
      </html>
    `);
  });
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  return res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

module.exports = app;
