-- Seed data for FlowCall development

INSERT OR IGNORE INTO plumbers (id, company_name, contact_phone, contact_email, notification_preferences)
VALUES ('plumber-001', 'Emergency Plumbing Co.', '+15559876543', 'plumber@example.com', 'email');

INSERT OR IGNORE INTO customers (id, name, phone, email)
VALUES ('customer-001', 'Jane Doe', '+15551112222', 'jane@example.com');

INSERT OR IGNORE INTO plumbing_requests (id, customer_id, description, priority, source, status)
VALUES ('request-001', 'customer-001', 'Kitchen sink is leaking badly under the cabinet', 'urgent', 'web', 'new');