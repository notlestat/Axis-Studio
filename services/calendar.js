// services/calendar.js
// Google Calendar integration. We use OAuth2 with a refresh token so the
// server can create events on behalf of the Axis Studio calendar owner.

import { google } from 'googleapis';
import 'dotenv/config';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID,
} = process.env;

// Build an OAuth2 client and prime it with the long-lived refresh token.
// googleapis will automatically exchange it for access tokens as needed.
const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2 });

/**
 * Create a calendar event for a confirmed booking.
 *
 * @param {object} opts
 * @param {string} opts.name       — lead's name
 * @param {string} opts.email      — lead's email (added as attendee)
 * @param {string} opts.business   — lead's business (for description)
 * @param {string} opts.startTime  — ISO 8601 start timestamp
 * @param {string} opts.endTime    — ISO 8601 end timestamp
 * @param {string} [opts.notes]    — extra notes for the description
 */
export async function createBookingEvent({ name, email, business, startTime, endTime, notes = '' }) {
  const event = {
    summary: `Axis Studio call with ${name}`,
    description: `Business: ${business}\n\n${notes}`.trim(),
    start: { dateTime: startTime },
    end: { dateTime: endTime },
    attendees: email ? [{ email }] : [],
  };

  const res = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    requestBody: event,
    sendUpdates: 'all', // notify the attendee
  });

  return res.data;
}
