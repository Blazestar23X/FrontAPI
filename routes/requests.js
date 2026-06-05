// FlowCall Plumbing Requests API Routes

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../db/connection');
const { sendCustomerConfirmation } = require('../services/email');
const { notifyPlumber } = require('../services/notifications');

const router = express.Router();

// POST /api/requests — Create a new plumbing request (from web form or API)
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, description, priority, source } = req.body;
    
    // Validation
    if (!name || !phone || !description) {
      return res.status(400).json({ error: 'Name, phone, and description are required' });
    }

    const validPriority = ['urgent', 'standard', 'low'].includes(priority) ? priority : 'standard';
    const requestSource = ['call', 'text', 'web'].includes(source) ? source : 'web';

    // Find or create customer
    let customer = await queryOne('SELECT * FROM customers WHERE phone = ?', [phone.trim()]);
    
    if (!customer) {
      const customerId = 'cust-' + uuidv4().slice(0, 8);
      await execute(
        'INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)',
        [customerId, name.trim(), phone.trim(), (email || '').trim()]
      );
      customer = await queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
    } else {
      // Update customer info if needed
      if (email && email !== customer.email) {
        await execute(
          'UPDATE customers SET email = ?, name = ? WHERE id = ?',
          [email.trim(), name.trim(), customer.id]
        );
        customer.email = email;
        customer.name = name;
      }
    }

    // Create the plumbing request
    const requestId = 'req-' + uuidv4().slice(0, 8);
    const createdAt = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    await execute(
      'INSERT INTO plumbing_requests (id, customer_id, description, priority, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [requestId, customer.id, description.trim(), validPriority, requestSource, 'new', createdAt]
    );

    const request = await queryOne(
      `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
       FROM plumbing_requests r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [requestId]
    );

    // Send confirmation email (async — don't block response)
    const companyName = process.env.DEFAULT_COMPANY_NAME || 'Emergency Plumbing Co.';
    sendCustomerConfirmation(customer, request, companyName).catch(err => {
      console.error('Failed to send customer confirmation:', err.message);
    });

    // Notify plumber (async)
    notifyPlumber(customer, request).catch(err => {
      console.error('Failed to notify plumber:', err.message);
    });

    res.status(201).json({ request, customer });
  } catch (err) {
    console.error('Error creating request:', err.message);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// GET /api/requests — List all requests with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, priority, source, limit } = req.query;
    
    let sql = `
      SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM plumbing_requests r
      JOIN customers c ON r.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND r.priority = ?';
      params.push(priority);
    }
    if (source) {
      sql += ' AND r.source = ?';
      params.push(source);
    }

    sql += ' ORDER BY r.created_at DESC';
    
    const maxLimit = Math.min(parseInt(limit) || 100, 200);
    sql += ' LIMIT ?';
    params.push(maxLimit);

    const requests = await queryAll(sql, params);
    res.json(requests);
  } catch (err) {
    console.error('Error listing requests:', err.message);
    res.status(500).json({ error: 'Failed to list requests' });
  }
});

// GET /api/requests/:id — Get request details
router.get('/:id', async (req, res) => {
  try {
    const request = await queryOne(
      `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
       FROM plumbing_requests r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [req.params.id]
    );
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json(request);
  } catch (err) {
    console.error('Error fetching request:', err.message);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// PATCH /api/requests/:id — Update request (status, notes, priority)
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes, priority } = req.body;
    
    const existing = await queryOne('SELECT * FROM plumbing_requests WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const validStatuses = ['new', 'notified_plumber', 'contacted', 'resolved'];
    const validPriorities = ['urgent', 'standard', 'low'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await execute(`UPDATE plumbing_requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await queryOne(
      `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
       FROM plumbing_requests r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    res.json(updated);
  } catch (err) {
    console.error('Error updating request:', err.message);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// POST /api/requests/:id/notify — Re-notify plumber
router.post('/:id/notify', async (req, res) => {
  try {
    const request = await queryOne(
      `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
       FROM plumbing_requests r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ?`,
      [req.params.id]
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
    res.json(result);
  } catch (err) {
    console.error('Error notifying plumber:', err.message);
    res.status(500).json({ error: 'Failed to notify plumber' });
  }
});

module.exports = router;