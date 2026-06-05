// FlowCall Twilio Webhook Routes
// Handles inbound voice calls and SMS messages from Twilio

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../db/connection');
const { sendCustomerConfirmation } = require('../services/email');
const { notifyPlumber } = require('../services/notifications');
const twilioHelpers = require('../services/twilio');

const router = express.Router();

// In-memory call sessions (in production use Redis or similar)
const callSessions = {};

// ==================== VOICE WEBHOOKS ====================

// POST /twilio/voice — Entry point for incoming calls
router.post('/voice', (req, res) => {
  const twilio = require('twilio');
  const callSid = req.body.CallSid;
  
  // Initialize session
  callSessions[callSid] = { step: 'welcome', caller: req.body.From || '' };
  
  const twiml = twilioHelpers.buildWelcomeTwiML(twilio);
  res.type('text/xml');
  res.send(twiml);
});

// POST /twilio/voice/name — Collect customer name
router.post('/voice/name', (req, res) => {
  const twilio = require('twilio');
  const callSid = req.body.CallSid;
  
  const name = req.body.SpeechResult || req.body.Digits || '';
  if (!callSessions[callSid]) {
    callSessions[callSid] = {};
  }
  
  callSessions[callSid].name = name.trim() || 'Caller';
  callSessions[callSid].step = 'description';
  
  const twiml = twilioHelpers.buildDescriptionTwiML(twilio);
  res.type('text/xml');
  res.send(twiml);
});

// POST /twilio/voice/description — Collect problem description
router.post('/voice/description', (req, res) => {
  const twilio = require('twilio');
  const callSid = req.body.CallSid;
  
  const description = req.body.SpeechResult || req.body.Digits || 'No description provided';
  
  if (!callSessions[callSid]) {
    callSessions[callSid] = {};
  }
  
  callSessions[callSid].description = description;
  callSessions[callSid].step = 'priority';
  
  const twiml = twilioHelpers.buildPriorityTwiML(twilio);
  res.type('text/xml');
  res.send(twiml);
});

// POST /twilio/voice/priority — Collect priority
router.post('/voice/priority', (req, res) => {
  const twilio = require('twilio');
  const callSid = req.body.CallSid;
  
  const digit = req.body.Digits || '2';
  const priorityMap = { '1': 'urgent', '2': 'standard', '3': 'low' };
  const priority = priorityMap[digit] || 'standard';
  
  if (!callSessions[callSid]) {
    callSessions[callSid] = {};
  }
  
  callSessions[callSid].priority = priority;
  callSessions[callSid].step = 'email';
  
  const twiml = twilioHelpers.buildEmailTwiML(twilio);
  res.type('text/xml');
  res.send(twiml);
});

// POST /twilio/voice/email — Collect email and finalize
router.post('/voice/email', async (req, res) => {
  const twilio = require('twilio');
  const callSid = req.body.CallSid;
  
  const emailInput = req.body.SpeechResult || req.body.Digits || '';
  const email = (emailInput === '9' || !emailInput) ? '' : emailInput.trim();
  
  if (!callSessions[callSid]) {
    callSessions[callSid] = {};
  }
  
  callSessions[callSid].email = email;
  callSessions[callSid].step = 'complete';
  
  try {
    // Save to database
    const session = callSessions[callSid];
    const phone = req.body.From || session.caller || 'unknown';
    
    // Find or create customer
    let customer = await queryOne('SELECT * FROM customers WHERE phone = ?', [phone]);
    
    if (!customer) {
      const customerId = 'cust-' + uuidv4().slice(0, 8);
      await execute(
        'INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)',
        [customerId, session.name, phone, email]
      );
      customer = await queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
    }

    // Create request
    const requestId = 'req-' + uuidv4().slice(0, 8);
    const createdAt = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    await execute(
      'INSERT INTO plumbing_requests (id, customer_id, description, priority, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [requestId, customer.id, session.description, session.priority, 'call', 'new', createdAt]
    );

    const request = await queryOne('SELECT * FROM plumbing_requests WHERE id = ?', [requestId]);

    // Send emails (async)
    const companyName = process.env.DEFAULT_COMPANY_NAME || 'Emergency Plumbing Co.';
    sendCustomerConfirmation(customer, request, companyName).catch(err => {
      console.error('Customer confirmation email failed:', err.message);
    });
    notifyPlumber(customer, request).catch(err => {
      console.error('Plumber notification failed:', err.message);
    });

    console.log(`[CALL] New request from ${session.name}: ${session.description} (${session.priority})`);
  } catch (err) {
    console.error('Error saving call result:', err.message);
  }

  // Clean up session after a short delay
  setTimeout(() => delete callSessions[callSid], 60000);

  // Respond with confirmation
  const session = callSessions[callSid] || {};
  const twiml = twilioHelpers.buildConfirmTwiML(
    twilio,
    session.name || 'Caller',
    session.description || 'plumbing issue',
    session.priority || 'standard',
    email || 'none provided'
  );
  
  res.type('text/xml');
  res.send(twiml);
});

// ==================== SMS WEBHOOKS ====================

// In-memory SMS sessions for multi-turn conversations
const smsSessions = {};

// POST /twilio/sms — Handle incoming SMS
router.post('/sms', async (req, res) => {
  const twilio = require('twilio');
  const from = req.body.From;
  const body = (req.body.Body || '').trim();
  const messagingSid = req.body.SmsMessageSid;

  const response = new twilio.twiml.MessagingResponse();

  try {
    // Check if we have an active session
    if (!smsSessions[from]) {
      // Start new session — ask for their name
      smsSessions[from] = { step: 'name', data: {} };
      smsSessions[from].data.phone = from;
      
      response.message(
        'Welcome to Emergency Plumbing Company! I can help log your service request.\n\n' +
        'Please reply with your name to get started.'
      );
    } else {
      const session = smsSessions[from];
      
      switch (session.step) {
        case 'name':
          session.data.name = body;
          session.step = 'description';
          response.message(
            `Thanks ${body}! Now, please briefly describe the plumbing issue you\'re experiencing.`
          );
          break;

        case 'description':
          session.data.description = body;
          session.step = 'priority';
          response.message(
            'Got it. What\'s the priority?\n\n' +
            'Reply: 1 for URGENT (water flowing/severe leak)\n' +
            'Reply: 2 for STANDARD (needs fixing soon)\n' +
            'Reply: 3 for LOW (not an emergency)'
          );
          break;

        case 'priority': {
          const priorityMap = { '1': 'urgent', '2': 'standard', '3': 'low' };
          session.data.priority = priorityMap[body] || 'standard';
          session.step = 'email';
          response.message(
            'Thanks! Last step — please reply with your email address so we can send you a confirmation. ' +
            'Or reply "skip" if you don\'t have one.'
          );
          break;
        }

        case 'email': {
          const email = (body.toLowerCase() === 'skip') ? '' : body;
          session.data.email = email;
          
          // Save to database
          const phone = from;
          
          // Find or create customer
          let customer = await queryOne('SELECT * FROM customers WHERE phone = ?', [phone]);
          
          if (!customer) {
            const customerId = 'cust-' + uuidv4().slice(0, 8);
            await execute(
              'INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)',
              [customerId, session.data.name, phone, email]
            );
            customer = await queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
          }

          // Create request
          const requestId = 'req-' + uuidv4().slice(0, 8);
          const createdAt = new Date().toISOString().replace('T', ' ').split('.')[0];
          
          await execute(
            'INSERT INTO plumbing_requests (id, customer_id, description, priority, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [requestId, customer.id, session.data.description, session.data.priority, 'text', 'new', createdAt]
          );

          const request = await queryOne('SELECT * FROM plumbing_requests WHERE id = ?', [requestId]);

          // Send emails (async)
          const companyName = process.env.DEFAULT_COMPANY_NAME || 'Emergency Plumbing Co.';
          sendCustomerConfirmation(customer, request, companyName).catch(err => {
            console.error('Customer confirmation email failed:', err.message);
          });
          notifyPlumber(customer, request).catch(err => {
            console.error('Plumber notification failed:', err.message);
          });

          console.log(`[SMS] New request from ${session.data.name}: ${session.data.description} (${session.data.priority})`);

          // Clean up session
          delete smsSessions[from];

          response.message(
            `Thanks ${session.data.name}! We've received your request and a plumber will contact you shortly. ` +
            `Reference: ${requestId.slice(0, 12)}...`
          );
          break;
        }

        default:
          response.message('Sorry, something went wrong. Please call us or start over by texting "new".');
          delete smsSessions[from];
      }
    }
  } catch (err) {
    console.error('SMS webhook error:', err.message);
    response.message('Sorry, we encountered an error processing your request. Please call us directly.');
  }

  res.type('text/xml');
  res.send(response.toString());
});

module.exports = router;