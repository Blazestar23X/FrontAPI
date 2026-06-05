// FlowCall — Main Express Server
// Automated call and request handler for plumbing companies

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security headers — relaxed enough for Twilio webhooks
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — allow the public form and dashboard from any origin
app.use(cors());

// Request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// ==================== ROUTES ====================

// API routes
app.use('/api/requests', require('./routes/requests'));
app.use('/api/customers', require('./routes/customers'));

// Twilio webhook routes
app.use('/twilio', require('./routes/webhooks'));

// Notification routes
app.use('/api/notify-plumber', require('./routes/notifications'));

// ==================== ROOT ENDPOINTS ====================

// Health check
app.get('/health', async (req, res) => {
  let dbOk = false;
  try {
    const { queryOne } = require('./db/connection');
    await queryOne('SELECT 1 as ok');
    dbOk = true;
  } catch (e) {
    dbOk = false;
  }
  
  res.json({
    status: 'ok',
    version: '1.0.0',
    database: dbOk ? 'connected' : 'error',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Redirect root to the request form
app.get('/', (req, res) => {
  res.redirect('/form.html');
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

async function start() {
  // Initialize database
  const { exec } = require('./db/connection');
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await exec(schema);
  console.log('✓ Database schema ready');
  
  // Seed default plumber
  try {
    await exec(`
      INSERT OR IGNORE INTO plumbers (id, company_name, contact_phone, contact_email, notification_preferences)
      VALUES ('plumber-001', '${process.env.DEFAULT_COMPANY_NAME || 'Emergency Plumbing Co.'}', '${process.env.DEFAULT_COMPANY_PHONE || '+15559876543'}', '${process.env.DEFAULT_COMPANY_EMAIL || 'plumber@example.com'}', 'email')
    `);
  } catch (e) {
    // Seed may already exist
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🚀 FlowCall Server running on http://0.0.0.0:${PORT}`);
    console.log(`  📋 Request form: http://localhost:${PORT}/form.html`);
    console.log(`  📊 Dashboard:    http://localhost:${PORT}/dashboard/`);
    console.log(`  ❤️  Health check: http://localhost:${PORT}/health\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});