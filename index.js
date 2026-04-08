// index.js
// Express entry point. Wires up routes, starts the follow-up cron job,
// and exposes a manual post-call trigger endpoint.

import 'dotenv/config';
import express from 'express';

import leadWebhook from './routes/leadWebhook.js';
import bookingWebhook from './routes/bookingWebhook.js';
import { scheduleFollowUpJob, runFollowUpSweep } from './jobs/followUp.js';

import { generatePostCall } from './services/ai.js';
import { sendPostCall } from './services/email.js';
import { updateStatus } from './services/crm.js';
import Airtable from 'airtable';

const app = express();

// Health check.
app.get('/', (_req, res) => res.json({ ok: true, service: 'axis-studio' }));

// Cal.com webhook must see the RAW body so we can verify the HMAC signature.
// Mount express.raw() ONLY on this path — everything else uses JSON parsing.
app.use('/webhook/booking', express.raw({ type: '*/*' }), bookingWebhook);

// All other routes get the standard JSON body parser.
app.use(express.json());

// Lead capture from the landing page.
app.use('/webhook/lead', leadWebhook);

/**
 * POST /trigger/post-call
 * Body: { recordId, outcome }   outcome ∈ 'won' | 'lost' | 'proposal'
 *
 * Manually triggered after a sales call to send a recap email and update
 * the lead's status in Airtable.
 */
app.post('/trigger/post-call', async (req, res) => {
  try {
    const { recordId, outcome } = req.body || {};
    if (!recordId || !outcome) {
      return res.status(400).json({ error: 'recordId and outcome required' });
    }

    // Fetch the lead directly so we have the email + business name.
    Airtable.configure({ apiKey: process.env.AIRTABLE_TOKEN });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
    const record = await base(process.env.AIRTABLE_TABLE_NAME || 'Leads').find(recordId);

    const name = record.fields.Name;
    const business = record.fields.Business || 'your business';
    const email = record.fields.Email;

    // Generate + send the recap email.
    const body = await generatePostCall({ name, business, outcome });
    await sendPostCall(email, body, outcome);

    // Map outcome → Airtable status.
    const statusMap = { won: 'Won', lost: 'Lost', proposal: 'Proposal sent' };
    await updateStatus(recordId, statusMap[outcome]);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[trigger/post-call] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Dev helper: trigger the follow-up sweep immediately instead of waiting for 9am.
app.post('/trigger/follow-up', async (_req, res) => {
  try {
    await runFollowUpSweep();
    res.json({ ok: true });
  } catch (err) {
    console.error('[trigger/follow-up] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Schedule the daily follow-up cron, then start listening.
scheduleFollowUpJob();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Axis Studio backend listening on port ${PORT}`);
});
