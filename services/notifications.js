// FlowCall Notification Service
// Dispatches alerts to plumbers via email (and optionally SMS)

const { sendPlumberNotification } = require('./email');
const { queryAll, execute } = require('../db/connection');

/**
 * Notify the plumber(s) about a new request
 * Returns notification result
 */
async function notifyPlumber(customer, request) {
  // Get plumber(s) to notify
  const plumbers = await queryAll('SELECT * FROM plumbers');
  
  if (plumbers.length === 0) {
    console.warn('No plumbers configured for notification');
    return { notified: false, reason: 'no_plumbers_configured' };
  }

  const results = [];
  for (const plumber of plumbers) {
    try {
      const result = await sendPlumberNotification(plumber, customer, request);
      results.push({ plumber_id: plumber.id, success: result.success });
    } catch (err) {
      console.error(`Failed to notify plumber ${plumber.id}:`, err.message);
      results.push({ plumber_id: plumber.id, success: false, error: err.message });
    }
  }

  // Update request status
  await execute('UPDATE plumbing_requests SET status = ? WHERE id = ?', ['notified_plumber', request.id]);

  return { notified: true, results };
}

/**
 * Send SMS notification to plumber (if Twilio configured)
 */
async function notifyPlumberSMS(plumber, message) {
  const twilioClient = getTwilioClient();
  if (!twilioClient) {
    console.log('SMS notification skipped (Twilio not configured)');
    return { success: false, reason: 'twilio_not_configured' };
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: plumber.contact_phone,
    });
    console.log(`SMS sent to plumber ${plumber.contact_phone}`);
    return { success: true };
  } catch (err) {
    console.error('SMS notification error:', err.message);
    return { success: false, error: err.message };
  }
}

function getTwilioClient() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
}

module.exports = { notifyPlumber, notifyPlumberSMS };