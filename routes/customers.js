// FlowCall Customers API Routes

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../db/connection');

const router = express.Router();

// POST /api/customers — Create a new customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const id = 'cust-' + uuidv4().slice(0, 8);
    
    await execute(
      'INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)',
      [id, name.trim(), phone.trim(), (email || '').trim()]
    );

    const customer = await queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// GET /api/customers/:id — Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const customer = await queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Include request count
    const countResult = await queryOne(
      'SELECT COUNT(*) as count FROM plumbing_requests WHERE customer_id = ?',
      [req.params.id]
    );
    
    res.json({ ...customer, request_count: countResult ? countResult.count : 0 });
  } catch (err) {
    console.error('Error fetching customer:', err.message);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// GET /api/customers — Search customers by phone
router.get('/', async (req, res) => {
  try {
    const { phone, q } = req.query;
    
    let customers;
    if (phone) {
      customers = await queryAll('SELECT * FROM customers WHERE phone LIKE ?', [`%${phone}%`]);
    } else if (q) {
      customers = await queryAll(
        'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?',
        [`%${q}%`, `%${q}%`, `%${q}%`]
      );
    } else {
      customers = await queryAll('SELECT * FROM customers ORDER BY created_at DESC LIMIT 50');
    }
    
    res.json(customers);
  } catch (err) {
    console.error('Error listing customers:', err.message);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

module.exports = router;