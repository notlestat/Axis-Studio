// services/ai.js
// All Claude API calls for email generation live here.
// Every function returns plain text ready to drop into a Resend email body.

import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Using the current Sonnet model. Update if Anthropic releases a newer one.
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1000;

const SYSTEM_PROMPT = `You are the client communications assistant for Axis Studio, a UK-based digital studio that builds landing pages and automated client systems for small businesses. Write concise, warm, professional emails in British English. Never use jargon. Keep emails under 150 words unless asked otherwise. Always sign off as: The Axis Studio Team`;

/**
 * Low-level helper: send a user prompt to Claude with our house system prompt
 * and return the plain-text response.
 */
async function generate(userPrompt) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Concatenate all text blocks from the response.
  return msg.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * First reply to a new enquiry from the landing page.
 */
export async function generateAutoReply({ name, business, message, serviceInterest }) {
  return generate(
    `Write a first reply to a new enquiry from ${name} who runs ${business}. They said: ${message}. They are interested in our ${serviceInterest} package.`
  );
}

/**
 * Follow-up emails. `step` is 1, 2, or 3 — tone varies per the spec.
 */
export async function generateFollowUp({ name, business, daysSince, step }) {
  let prompt;
  if (step === 1) {
    prompt = `Write a friendly follow-up to ${name} from ${business}. We emailed them ${daysSince} days ago but haven't heard back. Keep it light, no pressure.`;
  } else if (step === 2) {
    prompt = `Write a second follow-up to ${name} from ${business}. Mention one benefit of our system — that it saves them from manually chasing leads. Offer to answer any questions.`;
  } else {
    prompt = `Write a final follow-up to ${name} from ${business}. Let them know this is our last check-in for now. Leave the door open for the future.`;
  }
  return generate(prompt);
}

/**
 * Booking confirmation email sent after a Cal.com booking is created.
 */
export async function generateBookingConfirmation({ name, business, date, time }) {
  return generate(
    `Write a booking confirmation email for ${name} from ${business}. Their call is on ${date} at ${time}. Ask them to briefly describe their biggest challenge with getting new clients before the call.`
  );
}

/**
 * Post-call recap email. `outcome` is 'won' | 'lost' | 'proposal'.
 */
export async function generatePostCall({ name, business, outcome }) {
  let prompt;
  if (outcome === 'won') {
    prompt = `Write a warm follow-up to ${name} confirming we are moving forward. Welcome them to Axis Studio and outline the next step: they will receive an onboarding email within 24 hours.`;
  } else if (outcome === 'lost') {
    prompt = `Write a gracious follow-up to ${name} saying no problem at all, and that the door is open if anything changes. No hard sell.`;
  } else if (outcome === 'proposal') {
    prompt = `Write a follow-up to ${name} from ${business} confirming that their proposal has been sent to their inbox. Encourage them to reply with any questions.`;
  } else {
    throw new Error(`Unknown post-call outcome: ${outcome}`);
  }
  return generate(prompt);
}
