const https = require('https');

const MAX_RESUME_BYTES = 2 * 1024 * 1024; // 2 MB raw — keep the base64 payload under Vercel's request body limit
const CAREERS_EMAIL = 'career@voctotechnologies.com';

function resendRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateApplicationNumber() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  let seq = 1;
  try {
    const r = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/incr/careers-app-seq`,
      { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
    );
    const d = await r.json();
    seq = d.result || 1;
  } catch (_) {}
  return `VT-CAREER-${yyyymmdd}-${String(seq).padStart(3, '0')}`;
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
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    });
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const d = await r.json();
    return d.success === true;
  } catch (_) {
    return false;
  }
}

// 1 submission per email address per 7 days
async function checkEmailRateLimit(email) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return true;
  try {
    const key = `careers-email-rl:${email.toLowerCase()}`;
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 604800],
      ]),
    });
    const d = await r.json();
    const count = d[0]?.result;
    return count <= 1;
  } catch (_) {
    return true;
  }
}

// Max 5 submissions per IP per hour
async function checkRateLimit(ip) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return true;
  try {
    const key = `careers-rl:${ip}`;
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 3600],
      ]),
    });
    const d = await r.json();
    const count = d[0]?.result;
    return count <= 5;
  } catch (_) {
    return true; // allow through if Redis errors
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    fname, femail, fphone, fposition, fexp, fcover,
    resumeName, resumeType, resumeBase64,
    _hp, _ts,
  } = req.body;

  // Layer 1: Honeypot — silently fake-succeed so bots think they won
  if (_hp) {
    return res.status(200).json({ success: true, applicationNo: 'VT-CAREER-BOT-000' });
  }

  if (!fname || !femail || !fphone || !fposition || !fexp || !fcover || !resumeBase64 || !resumeName) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(femail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Reject oversized attachments (base64 is ~4/3 the size of the raw file)
  if (Buffer.byteLength(resumeBase64, 'base64') > MAX_RESUME_BYTES) {
    return res.status(400).json({ error: 'Resume file too large' });
  }

  const ip = getClientIP(req);

  // Layer 2: Cloudflare Turnstile verification
  // If Turnstile fails but the request came from our site (browser user), allow through —
  // the other layers (honeypot, rate limiting) still protect us.
  const turnstileOk = await verifyTurnstile(_ts, ip);
  if (!turnstileOk && !isFromOurSite(req)) {
    return res.status(400).json({ error: 'Security check failed. Please refresh and try again.' });
  }

  // Layer 3: Rate limit — 5 per IP per hour
  const withinLimit = await checkRateLimit(ip);
  if (!withinLimit) {
    return res.status(429).json({ error: 'Too many submissions from this network. Please try again later.' });
  }

  // Layer 4: Rate limit — 1 per email per 7 days
  const emailAllowed = await checkEmailRateLimit(femail);
  if (!emailAllowed) {
    return res.status(429).json({ error: 'An application from this email was already submitted recently.' });
  }

  const applicationNo = await generateApplicationNumber();
  const submittedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const adminHtml = `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#0A1628;">
  <div style="background:#0A1628;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h2 style="color:#00C2FF;margin:0;font-size:20px;">New Career Application</h2>
    <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">Application No: <strong style="color:#fff;">${applicationNo}</strong> &nbsp;|&nbsp; ${submittedAt} IST</p>
  </div>
  <div style="background:#f4f7fc;padding:32px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Name</td><td style="padding:6px 0;font-weight:600;">${fname}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Email</td><td style="padding:6px 0;"><a href="mailto:${femail}" style="color:#0099CC;">${femail}</a></td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Phone</td><td style="padding:6px 0;">${fphone}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Position</td><td style="padding:6px 0;font-weight:600;">${fposition}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Experience</td><td style="padding:6px 0;">${fexp}</td></tr>
    </table>

    <h3 style="color:#1A3A6B;margin:20px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Cover Letter</h3>
    <p style="background:#fff;padding:16px;border-radius:6px;margin:0 0 24px;white-space:pre-wrap;">${fcover}</p>

    <p style="color:#5A6A82;font-size:13px;margin:0 0 24px;">Resume attached: ${resumeName}</p>

    <div style="background:#0A1628;padding:16px 20px;border-radius:6px;text-align:center;">
      <p style="color:#00C2FF;margin:0;font-size:13px;">Reply directly to this email to respond to ${fname} at ${femail}</p>
    </div>
  </div>
</div>`;

  const applicantHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A1628;">
  <div style="background:#0A1628;padding:32px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:#00C2FF;margin:0 0 8px;font-size:22px;">Application Received</h1>
    <p style="color:rgba(255,255,255,0.75);margin:0;font-size:14px;">Vocto Technologies — Careers</p>
  </div>
  <div style="background:#f4f7fc;padding:32px;border-radius:0 0 8px 8px;">
    <p>Dear ${fname},</p>
    <p>Thank you for applying for the <strong>${fposition}</strong> role at Vocto Technologies. We have received your application and resume.</p>

    <div style="background:#fff;border:2px solid #00C2FF;border-radius:8px;padding:20px 24px;margin:24px 0;text-align:center;">
      <p style="color:#5A6A82;margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your Application Number</p>
      <p style="font-size:24px;font-weight:700;color:#0A1628;margin:0;letter-spacing:2px;">${applicationNo}</p>
      <p style="color:#5A6A82;margin:8px 0 0;font-size:12px;">Please quote this number in all correspondence</p>
    </div>

    <p>Our team will review your application and get back to you.</p>

    <p>For questions about your application, contact us at:</p>
    <p><strong>career@voctotechnologies.com</strong></p>

    <div style="background:#0A1628;padding:16px;border-radius:6px;margin-top:24px;text-align:center;">
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0;">Vocto Technologies Private Limited<br>B4, Phase II, MEPZ-SEZ, Tambaram, Chennai 600 087</p>
    </div>
  </div>
</div>`;

  try {
    const attachment = { filename: resumeName, content: resumeBase64 };

    const [adminRes, applicantRes] = await Promise.all([
      resendRequest({
        from: 'Vocto Technologies Careers <noreply@voctotechnologies.com>',
        to: [CAREERS_EMAIL],
        reply_to: femail,
        subject: `[${applicationNo}] New Application — ${fposition} — ${fname}`,
        html: adminHtml,
        attachments: [attachment],
      }),
      resendRequest({
        from: 'Vocto Technologies Careers <noreply@voctotechnologies.com>',
        to: [femail],
        subject: `Your Application Confirmation — ${applicationNo}`,
        html: applicantHtml,
      }),
    ]);

    if (adminRes.status >= 400 || applicantRes.status >= 400) {
      console.error('Resend error:', adminRes.body, applicantRes.body);
      return res.status(500).json({ error: 'Email delivery failed' });
    }

    return res.status(200).json({ success: true, applicationNo });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
