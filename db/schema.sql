-- FlowCall Database Schema

CREATE TABLE IF NOT EXISTS plumbers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  notification_preferences TEXT NOT NULL DEFAULT 'email',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plumbing_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('urgent', 'standard', 'low')),
  source TEXT NOT NULL CHECK(source IN ('call', 'text', 'web')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'notified_plumber', 'contacted', 'resolved')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON plumbing_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON plumbing_requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_created ON plumbing_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);