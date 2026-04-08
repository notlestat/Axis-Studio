// routes/bookingWebhook.js
// Handles POST /webhook/booking from Cal.com when a booking is confirmed.
//
// Flow:
//   1. Verify the Cal.com signature.
//   2. Find the matching Airtable lead by email and mark status = Booked.
//   3. Generate a confirmation email via Claude.
//   4. Send it via Resend.
//   5. Create a Google Calendar event.

import express from 'express';
import crypto from 'crypto';
import { findLeadByEmail, updateStatus } from '../services/crm.js';
import { generateBookingConfirmation } from '../services/ai.js';
import { sendBookingConfirmation } from '../services/email.js';
import { createBookingEvent } from '../services/calendar.js';

const router = express.Router();

/**
 * Verify a Cal.com webhook signature using the shared secret.
 * Cal.com signs the raw request body with HMAC-SHA256 and sends the hex
 * digest in the `X-Cal-Signature-256` header.
 */
function verifyCalSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// NOTE: this route relies on express.raw() middleware (mounted in index.js)
// so we can verify the signature against the exact bytes Cal.com sent.
router.post('/', async (req, res) => {
  try {
    const signature = req.header('X-Cal-Signature-256');
    const rawBody = req.body; // Buffer (from express.raw)

    if (!verifyCalSignature(rawBody, signature, process.env.CAL_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));

    // Cal.com payload shape: { triggerEvent, payload: { attendees, startTime, endTime, ... } }
    const data = payload.payload || payload;
    const attendee = (data.attendees && data.attendees[0]) || {};
    const email = attendee.email;
    const name = attendee.name || 'there';
    const startTime = data.startTime;
    const endTime = data.endTime;

    if (!email || !startTime) {
      return res.status(400).json({ error: 'Missing attendee email or startTime' });
    }

    // 1. Find the lead, mark as Booked.
    const lead = await findLeadByEmail(email);
    const business = (lead && lead.fields && lead.fields.Business) || 'your business';
    if (lead) await updateStatus(lead.id, 'Booked');

    // 2. Format date/time in British English for the email body.
    const dt = new Date(startTime);
    const date = dt.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const time = dt.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    });

    // 3. Generate and send the confirmation email.
    const body = await generateBookingConfirmation({ name, business, date, time });
    await sendBookingConfirmation(email, body);

    // 4. Create the Google Calendar event.
    await createBookingEvent({
      name,
      email,
      business,
      startTime,
      endTime,
      notes: (lead && lead.fields && lead.fields.Notes) || '',
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[bookingWebhook] error:', err);
    return res.status(500).json({ error: 'Internal error handling booking' });
  }
});

export default router;
