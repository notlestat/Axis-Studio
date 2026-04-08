// jobs/followUp.js
// Daily cron job that sweeps Airtable for leads needing a follow-up and
// sends the appropriate step-1/2/3 email.

import cron from 'node-cron';
import { getLeadsNeedingFollowUp, incrementFollowUp, markCold } from '../services/crm.js';
import { generateFollowUp } from '../services/ai.js';
import { sendFollowUp } from '../services/email.js';

/**
 * Run the follow-up sweep once. Exported so it can also be triggered manually
 * (e.g. from a test endpoint) without waiting for the cron tick.
 */
export async function runFollowUpSweep() {
  console.log('[followUp] starting sweep at', new Date().toISOString());

  const leads = await getLeadsNeedingFollowUp();
  console.log(`[followUp] ${leads.length} lead(s) need follow-up`);

  for (const lead of leads) {
    try {
      const f = lead.fields;
      const currentCount = f['Follow-up count'] || 0;
      const step = currentCount + 1; // 1, 2, or 3

      // Days since last contacted (used in follow-up 1 copy).
      const lastContacted = f['Last contacted'] ? new Date(f['Last contacted']) : new Date();
      const daysSince = Math.max(
        1,
        Math.floor((Date.now() - lastContacted.getTime()) / (1000 * 60 * 60 * 24))
      );

      // 1. Generate the follow-up email.
      const body = await generateFollowUp({
        name: f.Name,
        business: f.Business || 'your business',
        daysSince,
        step,
      });

      // 2. Send it.
      await sendFollowUp(f.Email, body, step);

      // 3. Increment count + stamp last contacted.
      await incrementFollowUp(lead.id, currentCount);

      // 4. If that was the third and final follow-up, mark the lead cold.
      if (step >= 3) await markCold(lead.id);

      console.log(`[followUp] step ${step} sent to ${f.Email}`);
    } catch (err) {
      console.error(`[followUp] failed for lead ${lead.id}:`, err);
    }
  }

  console.log('[followUp] sweep complete');
}

/**
 * Schedule the sweep for every day at 09:00 server time.
 * Call this once from index.js during startup.
 */
export function scheduleFollowUpJob() {
  cron.schedule('0 9 * * *', () => {
    runFollowUpSweep().catch((err) => console.error('[followUp] cron error:', err));
  });
  console.log('[followUp] scheduled daily at 09:00');
}
