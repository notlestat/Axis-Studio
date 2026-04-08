// routes/leadWebhook.js
// Handles POST /webhook/lead from the Axis Studio landing page form.
//
// Flow:
//   1. Accept the submission.
//   2. Generate a personalised auto-reply via Claude.
//   3. Send the reply via Resend.
//   4. Create an Airtable record (status = New).
//   5. Flip the status to Contacted once the email is away.

import express from 'express';
import { generateAutoReply } from '../services/ai.js';
import { sendAutoReply } from '../services/email.js';
import { createLead, updateStatus } from '../services/crm.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, business, message, serviceInterest } = req.body || {};

    // Minimal validation — reject obviously incomplete submissions.
    if (!name || !email || !serviceInterest) {
      return res.status(400).json({
        error: 'Missing required fields: name, email, serviceInterest',
      });
    }

    // 1. Generate the AI reply.
    const replyText = await generateAutoReply({ name, business, message, serviceInterest });

    // 2. Send it.
    await sendAutoReply(email, replyText);

    // 3. Create the lead in Airtable (status = New, follow-up count = 0).
    const lead = await createLead({
      name,
      email,
      phone,
      business,
      message,
      serviceInterest,
      source: 'Landing page',
    });

    // 4. Email is out — flip to Contacted.
    await updateStatus(lead.id, 'Contacted');

    return res.status(200).json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error('[leadWebhook] error:', err);
    return res.status(500).json({ error: 'Internal error handling lead' });
  }
});

export default router;
