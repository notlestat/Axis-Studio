// services/email.js
// Thin wrapper around Resend. Every outbound email in the system flows through
// sendEmail() so we have one place to change sender, add logging, etc.

import { Resend } from 'resend';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'hello@axisstudio.co';

/**
 * Send a plain-text email. `text` is converted into a minimal HTML version
 * (paragraphs on blank lines) so it renders nicely in most clients.
 */
export async function sendEmail({ to, subject, text }) {
  const html = text
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const { data, error } = await resend.emails.send({
    from: `Axis Studio <${FROM}>`,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }
  return data;
}

// Convenience wrappers so callers don't have to remember subject lines.

export function sendAutoReply(to, body) {
  return sendEmail({ to, subject: 'Thanks for getting in touch with Axis Studio', text: body });
}

export function sendFollowUp(to, body, step) {
  const subjects = {
    1: 'Quick follow-up from Axis Studio',
    2: 'Thought this might help',
    3: 'Last check-in for now',
  };
  return sendEmail({ to, subject: subjects[step] || 'Following up', text: body });
}

export function sendBookingConfirmation(to, body) {
  return sendEmail({ to, subject: 'Your Axis Studio call is confirmed', text: body });
}

export function sendPostCall(to, body, outcome) {
  const subjects = {
    won: 'Welcome to Axis Studio',
    lost: 'Thanks for your time',
    proposal: 'Your Axis Studio proposal',
  };
  return sendEmail({ to, subject: subjects[outcome] || 'Following up', text: body });
}
