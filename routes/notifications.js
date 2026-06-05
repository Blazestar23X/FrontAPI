// FlowCall Notification Dispatch Routes

const express = require('express');
const { queryOne } = require('../db/connection');
const { sendCustomerConfirmation } = require('../services/email');
const { notifyPlumber } = require('../services/notifications');

const router = express.Router();

// POST /api/notify-plumber — Manually trigger plumber notification for a request
router.post('/', async (req, res) => {
  try {
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    
    const request = await queryOne(
      `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
       FROM plumbing_requests r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const customer = {
      id: request.customer_id,
      name: request.customer_name,
      phone: request.customer_phone,
      email: request.customer_email,
    };

    const result = await notifyPlumber(customer, request);
    res.json({ 
      success: result.notified,
      message: result.notified ? 'Plumber notified successfully' : 'No plumbers configured',
      details: result
    });
  } catch (err) {
    console.error('Error in notification dispatch:', err.message);
    res.status(500).json({ error: 'Failed to dispatch notification' });
  }
});

// POST /api/resend-confirmation — Resend customer confirmation email
router.post('/resend-confirmation', async (req, res) => {
  try {
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    
    const request = await queryOne(
      `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
       FROM plumbing_requests r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (!request.customer_email) {
      return res.status(400).json({ error: 'Customer has no email address' });
    }

    const customer = {
      id: request.customer_id,
      name: request.customer_name,
      phone: request.customer_phone,
      email: request.customer_email,
    };

    const companyName = process.env.DEFAULT_COMPANY_NAME || 'Emergency Plumbing Co.';
    const result = await sendCustomerConfirmation(customer, request, companyName);
    
    res.json({ success: true, message: 'Confirmation email resent', details: result });
  } catch (err) {
    console.error('Error resending confirmation:', err.message);
    res.status(500).json({ error: 'Failed to resend confirmation' });
  }
});

module.exports = router;