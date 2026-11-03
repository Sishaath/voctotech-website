const COUNTRIES = require('../con-x-countries.js');

const COUNTRY_LOOKUP = new Map(COUNTRIES.map(c => [c.toLowerCase(), c]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,23}$/;
const ENQUIRY_TO = (process.env.CONX_ENQUIRY_TO || 'sishaath@voctotechnologies.com,aswath@voctotechnologies.com')
  .split(',').map(s => s.trim()).filter(Boolean);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function isFromOurSite(req) {
  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';
  return origin.includes('voctotechnologies.com') || referer.includes('voctotechnologies.com');
}

async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET_KEY) return true; // skip in local dev
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }).toString(),
    });
    const d = await r.json();
    return d.success === true;
  } catch (_) {
    return false;
  }
}

// Returns true while `key` has been hit at most `max` times within `ttl` seconds.
async function withinLimit(key, max, ttl) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return true;
  try {
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, ttl]]),
    });
    const d = await r.json();
    return d[0]?.result <= max;
  } catch (_) {
    return true; // allow through if Redis errors
  }
}

// Appends the enquiry as a row via the Apps Script web app bound to the enquiries sheet.
// The sheet hands out the enquiry number (CONX-1001, CONX-1002, ...) so it stays sequential.
async function appendToSheet(row) {
  if (!process.env.CONX_SHEET_WEBHOOK_URL) throw new Error('CONX_SHEET_WEBHOOK_URL not set');
  const r = await fetch(process.env.CONX_SHEET_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.CONX_SHEET_SECRET, ...row }),
    redirect: 'follow',
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok || !d.enquiryNo) throw new Error(`Sheet ${r.status}: ${d.error || 'append failed'}`);
  return d.enquiryNo;
}

async function sendEmail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot — fake success so bots move on
  if (body._hp) return res.status(200).json({ success: true });

  // Server-side validation
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const name = str(body.name);
  const email = str(body.email);
  const company = str(body.company);
  const phone = str(body.phone);
  const country = COUNTRY_LOOKUP.get(String(body.country || '').trim().toLowerCase());

  if (!name || name.length > 120 || !EMAIL_RE.test(email) || email.length > 254 || !country ||
      !company || company.length > 160 || (phone && !PHONE_RE.test(phone))) {
    return res.status(400).json({ error: 'invalid_fields' });
  }

  const ip = getClientIP(req);

  const turnstileOk = await verifyTurnstile(body._ts, ip);
  if (!turnstileOk && !isFromOurSite(req)) {
    return res.status(400).json({ error: 'security_check_failed' });
  }

  if (!(await withinLimit(`conx-rl:${ip}`, 5, 3600)) ||
      !(await withinLimit(`conx-email-rl:${email.toLowerCase()}`, 1, 86400))) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const submittedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Save to the sheet first so the email carries the sheet's enquiry number.
  // If the sheet is down, still email with a fallback number so the enquiry isn't lost.
  let enquiryNo, sheetOk = true;
  try {
    // Keys are the sheet's column headers; the sheet adds any column it doesn't have yet.
    enquiryNo = await appendToSheet({ fields: {
      'Submitted (IST)': submittedAt,
      'Name': name,
      'Company': company,
      'Email': email,
      'Phone': phone,
      'Country': country,
      'Source Page': req.headers['referer'] || '',
    } });
  } catch (err) {
    sheetOk = false;
    console.error('CON-X enquiry sheet append failed:', err);
    enquiryNo = `CONX-T${Date.now().toString().slice(-6)}`;
  }

  const n = escapeHtml(name), e = escapeHtml(email), c = escapeHtml(country);
  const co = escapeHtml(company), ph = escapeHtml(phone || '—');

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A1628;">
  <div style="background:#0A1628;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h2 style="color:#00C2FF;margin:0;font-size:20px;">New CON-X Enquiry</h2>
    <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">${enquiryNo} &nbsp;|&nbsp; ${submittedAt} IST</p>
  </div>
  <div style="background:#f4f7fc;padding:28px 32px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#5A6A82;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${n}</td></tr>
      <tr><td style="padding:8px 0;color:#5A6A82;">Company</td><td style="padding:8px 0;font-weight:600;">${co}</td></tr>
      <tr><td style="padding:8px 0;color:#5A6A82;">Work Email</td><td style="padding:8px 0;"><a href="mailto:${e}" style="color:#0099CC;">${e}</a></td></tr>
      <tr><td style="padding:8px 0;color:#5A6A82;">Phone</td><td style="padding:8px 0;">${ph}</td></tr>
      <tr><td style="padding:8px 0;color:#5A6A82;">Country</td><td style="padding:8px 0;">${c}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#5A6A82;">Submitted from voctotechnologies.com/con-x. Reply to this email to respond directly.</p>
  </div>
</div>`;

  let mailOk = true;
  try {
    await sendEmail({
      from: 'Vocto Technologies CON-X <noreply@voctotechnologies.com>',
      to: ENQUIRY_TO,
      reply_to: email,
      subject: `[${enquiryNo}] New CON-X Enquiry: ${name.replace(/[\r\n]+/g, ' ')}, ${company.replace(/[\r\n]+/g, ' ')} (${country})`,
      html,
    });
  } catch (err) {
    mailOk = false;
    console.error('CON-X enquiry email failed:', err);
  }

  // The enquiry counts as received if either the sheet or the email got it.
  if (sheetOk || mailOk) return res.status(200).json({ success: true, enquiryNo });
  return res.status(502).json({ error: 'delivery_failed' });
};
