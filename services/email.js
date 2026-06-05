// FlowCall Email Service
// Supports SendGrid and Resend email providers

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend';

/**
 * Send customer confirmation email
 */
async function sendCustomerConfirmation(customer, request, companyName) {
  const subject = `[${companyName}] We've received your plumbing request`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a73e8;">Thank you for contacting ${companyName}!</h2>
      <p>Hi ${customer.name},</p>
      <p>We've received your plumbing service request and a plumber will get back to you shortly.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">Request Summary</h3>
        <p><strong>Issue:</strong> ${request.description}</p>
        <p><strong>Priority:</strong> ${request.priority}</p>
        <p><strong>Status:</strong> Received — we'll contact you soon</p>
        <p><strong>Reference:</strong> ${request.id}</p>
      </div>
      <p>If this is an emergency, please call us directly at ${process.env.DEFAULT_COMPANY_PHONE || 'your local office'}.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">FlowCall — Never miss a lead</p>
    </div>
  `;

  return sendEmail(customer.email, subject, html);
}

/**
 * Send plumber notification about a new request
 */
async function sendPlumberNotification(plumber, customer, request) {
  const subject = `🚨 New ${request.priority.toUpperCase()} Plumbing Request — ${customer.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d93025;">New Plumbing Request</h2>
      <div style="background: #fef7e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f9ab00;">
        <p><strong>Priority:</strong> <span style="color: ${request.priority === 'urgent' ? '#d93025' : request.priority === 'standard' ? '#f9ab00' : '#188038'}; text-transform: uppercase;">${request.priority}</span></p>
        <p><strong>Customer:</strong> ${customer.name}</p>
        <p><strong>Phone:</strong> ${customer.phone}</p>
        <p><strong>Email:</strong> ${customer.email || 'Not provided'}</p>
        <p><strong>Description:</strong> ${request.description}</p>
        <p><strong>Source:</strong> ${request.source}</p>
        <p><strong>Submitted:</strong> ${request.created_at}</p>
      </div>
      <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/" 
         style="display: inline-block; background: #1a73e8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        View in Dashboard
      </a>
    </div>
  `;

  return sendEmail(plumber.contact_email, subject, html);
}

/**
 * Generic email sender
 */
async function sendEmail(to, subject, html) {
  if (EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY) {
    return sendViaResend(to, subject, html);
  } else if (EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    return sendViaSendGrid(to, subject, html);
  } else {
    // Fallback: log to console (for development)
    console.log('\n========== EMAIL ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html.replace(/<[^>]+>/g, '').substring(0, 200)}...`);
    console.log('========== END EMAIL ==========\n');
    return { success: true, provider: 'console-log' };
  }
}

async function sendViaResend(to, subject, html) {
  try {
    const resend = require('resend');
    const client = new resend.Resend(process.env.RESEND_API_KEY);
    const { data, error } = await client.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || 'FlowCall <noreply@flowcall.app>',
      to: [to],
      subject,
      html,
    });
    if (error) throw error;
    console.log(`Email sent via Resend to ${to}: ${subject}`);
    return { success: true, provider: 'resend', id: data?.id };
  } catch (err) {
    console.error('Resend email error:', err.message);
    // Fallback to console log
    console.log(`\n[EMAIL FALLBACK] To: ${to} | Subject: ${subject}\n`);
    return { success: true, provider: 'console-fallback' };
  }
}

async function sendViaSendGrid(to, subject, html) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to,
      from: process.env.EMAIL_FROM_ADDRESS || 'noreply@flowcall.app',
      subject,
      html,
    };
    await sgMail.send(msg);
    console.log(`Email sent via SendGrid to ${to}: ${subject}`);
    return { success: true, provider: 'sendgrid' };
  } catch (err) {
    console.error('SendGrid email error:', err.message);
    console.log(`\n[EMAIL FALLBACK] To: ${to} | Subject: ${subject}\n`);
    return { success: true, provider: 'console-fallback' };
  }
}

module.exports = { sendCustomerConfirmation, sendPlumberNotification, sendEmail };