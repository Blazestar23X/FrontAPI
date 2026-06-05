// FlowCall Twilio Helpers
// Generates TwiML for IVR flows

const { getDb } = require('../db/connection');

/**
 * Generate TwiML for the initial voice call greeting
 * Uses Gather to collect spoken or keypad input for the customer name
 */
function buildWelcomeTwiML(twilio) {
  const response = new twilio.twiml.VoiceResponse();
  
  const gather = response.gather({
    input: 'speech dtmf',
    timeout: 5,
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/twilio/voice/name',
    method: 'POST',
  });
  
  gather.say(
    { voice: 'alice', language: 'en-US' },
    'Thank you for calling Emergency Plumbing Company. Please say or enter your name.'
  );
  
  // If no input, repeat
  response.say(
    { voice: 'alice', language: 'en-US' },
    'We did not receive your input. Please call back or visit our website to submit a request online.'
  );
  response.hangup();
  
  return response.toString();
}

/**
 * After name is collected, ask for the problem description
 */
function buildDescriptionTwiML(twilio) {
  const response = new twilio.twiml.VoiceResponse();
  
  const gather = response.gather({
    input: 'speech dtmf',
    timeout: 10,
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/twilio/voice/description',
    method: 'POST',
  });
  
  gather.say(
    { voice: 'alice', language: 'en-US' },
    'Thanks. Please describe the plumbing issue you are experiencing. For example, a leaking pipe under the kitchen sink.'
  );
  
  response.say(
    { voice: 'alice', language: 'en-US' },
    'We did not receive a description. Please try again when you are ready.'
  );
  response.hangup();
  
  return response.toString();
}

/**
 * Ask for priority level
 */
function buildPriorityTwiML(twilio) {
  const response = new twilio.twiml.VoiceResponse();
  
  const gather = response.gather({
    input: 'dtmf',
    timeout: 5,
    numDigits: 1,
    action: '/twilio/voice/priority',
    method: 'POST',
  });
  
  gather.say(
    { voice: 'alice', language: 'en-US' },
    'Please select the priority level. Press 1 for urgent — water flowing or severe leak. Press 2 for standard — needs fixing soon. Press 3 for low — not an emergency.'
  );
  
  response.say(
    { voice: 'alice', language: 'en-US' },
    'We did not receive a selection. Setting priority to standard.'
  );
  response.redirect('/twilio/voice/email');
  
  return response.toString();
}

/**
 * Ask for email address
 */
function buildEmailTwiML(twilio) {
  const response = new twilio.twiml.VoiceResponse();
  
  const gather = response.gather({
    input: 'speech dtmf',
    timeout: 5,
    speechTimeout: 'auto',
    language: 'en-US',
    action: '/twilio/voice/email',
    method: 'POST',
  });
  
  gather.say(
    { voice: 'alice', language: 'en-US' },
    'Please say or enter your email address so we can send you a confirmation. If you do not have one, just say or press 9 to skip.'
  );
  
  response.redirect('/twilio/voice/confirm');
  
  return response.toString();
}

/**
 * Confirm and finish
 */
function buildConfirmTwiML(twilio, customerName, description, priority, email) {
  const response = new twilio.twiml.VoiceResponse();
  
  response.say(
    { voice: 'alice', language: 'en-US' },
    `Thank you ${customerName}. We have received your request for: ${description}. Priority is set to ${priority}. A plumber will contact you shortly. Goodbye.`
  );
  response.hangup();
  
  return response.toString();
}

module.exports = {
  buildWelcomeTwiML,
  buildDescriptionTwiML,
  buildPriorityTwiML,
  buildEmailTwiML,
  buildConfirmTwiML,
};