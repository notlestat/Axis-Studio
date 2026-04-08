// services/crm.js
// Airtable CRM wrapper. All reads/writes to the Leads table go through here
// so the rest of the app never touches the Airtable SDK directly.

import Airtable from 'airtable';
import 'dotenv/config';

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME = 'Leads',
} = process.env;

// Configure the Airtable client with the personal access token.
Airtable.configure({ apiKey: AIRTABLE_TOKEN });
const base = Airtable.base(AIRTABLE_BASE_ID);
const table = base(AIRTABLE_TABLE_NAME);

// Returns today's date as an ISO "YYYY-MM-DD" string for Airtable date fields.
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Create a brand new lead record in Airtable.
 * Sets status = "New", follow-up count = 0, and stamps Last contacted.
 */
export async function createLead({
  name,
  email,
  phone,
  business,
  message,
  serviceInterest,
  source = 'Landing page',
}) {
  const [record] = await table.create([
    {
      fields: {
        Name: name,
        Email: email,
        Phone: phone,
        Business: business,
        Source: source,
        'Service interest': serviceInterest,
        Status: 'New',
        'Last contacted': today(),
        'Follow-up count': 0,
        Notes: message || '',
      },
    },
  ]);
  return record;
}

/**
 * Update an existing lead's status by record ID.
 */
export async function updateStatus(recordId, status) {
  const [record] = await table.update([
    { id: recordId, fields: { Status: status } },
  ]);
  return record;
}

/**
 * Find a single lead by their email address. Returns null if not found.
 */
export async function findLeadByEmail(email) {
  const records = await table
    .select({
      filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      maxRecords: 1,
    })
    .firstPage();
  return records[0] || null;
}

/**
 * Stamp Last contacted = today and increment the follow-up counter by 1.
 */
export async function incrementFollowUp(recordId, currentCount = 0) {
  const [record] = await table.update([
    {
      id: recordId,
      fields: {
        'Follow-up count': currentCount + 1,
        'Last contacted': today(),
      },
    },
  ]);
  return record;
}

/**
 * Fetch all leads eligible for a follow-up email.
 * Rules:
 *   - Status is "New" or "Contacted"
 *   - Follow-up count < 3
 *   - Last contacted was 2+ days ago
 */
export async function getLeadsNeedingFollowUp() {
  const formula = `
    AND(
      OR({Status} = 'New', {Status} = 'Contacted'),
      {Follow-up count} < 3,
      IS_BEFORE({Last contacted}, DATEADD(TODAY(), -2, 'days'))
    )
  `.replace(/\s+/g, ' ').trim();

  const records = await table
    .select({ filterByFormula: formula })
    .all();

  return records;
}

/**
 * Mark a lead as Cold (used when follow-up count hits the max).
 */
export async function markCold(recordId) {
  return updateStatus(recordId, 'Cold');
}
