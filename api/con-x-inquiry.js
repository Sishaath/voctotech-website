const https = require('https');

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

function generateInquiryNumber() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `VT-CONX-${yyyymmdd}-${rand}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    fullName, company, email, phone, country,
    material, application, currentMethod,
    elements, concentrations, accuracy,
    beltWidth, beltSpeed, materialHeight,
    installType, tempRange, humidity, dustLevel,
    outputs, integration, timeline,
    additional,
  } = req.body;

  if (!fullName || !company || !email || !material || !application) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  const inquiryNo = generateInquiryNumber();
  const submittedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const adminHtml = `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#0A1628;">
  <div style="background:#0A1628;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h2 style="color:#00C2FF;margin:0;font-size:20px;">New CON-X Inquiry</h2>
    <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">Inquiry No: <strong style="color:#fff;">${inquiryNo}</strong> &nbsp;|&nbsp; ${submittedAt} IST</p>
  </div>
  <div style="background:#f4f7fc;padding:32px;border-radius:0 0 8px 8px;">

    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Contact</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Name</td><td style="padding:6px 0;font-weight:600;">${fullName}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Company</td><td style="padding:6px 0;font-weight:600;">${company}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}" style="color:#0099CC;">${email}</a></td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Phone</td><td style="padding:6px 0;">${phone || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Country</td><td style="padding:6px 0;">${country || '—'}</td></tr>
    </table>

    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Application</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Material</td><td style="padding:6px 0;font-weight:600;">${material}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Application</td><td style="padding:6px 0;">${application}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Current Method</td><td style="padding:6px 0;">${currentMethod || '—'}</td></tr>
    </table>

    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Elements & Measurement</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Elements</td><td style="padding:6px 0;font-weight:600;">${elements || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Concentrations</td><td style="padding:6px 0;">${concentrations || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Accuracy Required</td><td style="padding:6px 0;">${accuracy || '—'}</td></tr>
    </table>

    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Conveyor Specifications</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Belt Width</td><td style="padding:6px 0;">${beltWidth ? beltWidth + ' mm' : '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Belt Speed</td><td style="padding:6px 0;">${beltSpeed ? beltSpeed + ' m/s' : '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Material Height</td><td style="padding:6px 0;">${materialHeight ? materialHeight + ' cm' : '—'}</td></tr>
    </table>

    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Operating Conditions</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Installation</td><td style="padding:6px 0;">${installType || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Temperature</td><td style="padding:6px 0;">${tempRange || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Humidity</td><td style="padding:6px 0;">${humidity ? humidity + '%' : '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Dust Level</td><td style="padding:6px 0;">${dustLevel || '—'}</td></tr>
    </table>

    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Integration & Timeline</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#5A6A82;width:160px;">Outputs Required</td><td style="padding:6px 0;">${outputs || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">System Integration</td><td style="padding:6px 0;">${integration || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#5A6A82;">Timeline</td><td style="padding:6px 0;">${timeline || '—'}</td></tr>
    </table>

    ${additional ? `
    <h3 style="color:#1A3A6B;margin:0 0 16px;font-size:15px;text-transform:uppercase;letter-spacing:1px;">Additional Notes</h3>
    <p style="background:#fff;padding:16px;border-radius:6px;margin:0 0 24px;">${additional}</p>
    ` : ''}

    <div style="background:#0A1628;padding:16px 20px;border-radius:6px;text-align:center;">
      <p style="color:#00C2FF;margin:0;font-size:13px;">Reply directly to this email to respond to ${fullName} at ${email}</p>
    </div>
  </div>
</div>`;

  const customerHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A1628;">
  <div style="background:#0A1628;padding:32px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:#00C2FF;margin:0 0 8px;font-size:22px;">Inquiry Received</h1>
    <p style="color:rgba(255,255,255,0.75);margin:0;font-size:14px;">Vocto Technologies — CON-X XRF Analyzer</p>
  </div>
  <div style="background:#f4f7fc;padding:32px;border-radius:0 0 8px 8px;">
    <p>Dear ${fullName},</p>
    <p>Thank you for your inquiry regarding the <strong>BSI CON-X On-line XRF Conveyor Analyzer</strong>. We have received your questionnaire and our technical team will review your requirements.</p>

    <div style="background:#fff;border:2px solid #00C2FF;border-radius:8px;padding:20px 24px;margin:24px 0;text-align:center;">
      <p style="color:#5A6A82;margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your Inquiry Number</p>
      <p style="font-size:24px;font-weight:700;color:#0A1628;margin:0;letter-spacing:2px;">${inquiryNo}</p>
      <p style="color:#5A6A82;margin:8px 0 0;font-size:12px;">Please quote this number in all correspondence</p>
    </div>

    <h3 style="color:#1A3A6B;font-size:15px;">What happens next?</h3>
    <ol style="padding-left:20px;color:#0A1628;line-height:2;">
      <li>Our team reviews your technical requirements (within 1 business day)</li>
      <li>We prepare a preliminary proposal with specifications and pricing</li>
      <li>We schedule a consultation call to discuss your application in detail</li>
      <li>Final quotation and delivery timeline provided</li>
    </ol>

    <p>For urgent enquiries, contact us directly:</p>
    <p>
      <strong>rrk@voctotechnologies.com</strong><br>
      <strong>+91 98410 25930</strong>
    </p>

    <div style="background:#0A1628;padding:16px;border-radius:6px;margin-top:24px;text-align:center;">
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0;">Vocto Technologies Private Limited &nbsp;|&nbsp; Authorized BSI Distributor for India<br>B4, Phase II, MEPZ-SEZ, Tambaram, Chennai 600 087</p>
    </div>
  </div>
</div>`;

  try {
    const [adminRes, customerRes] = await Promise.all([
      resendRequest({
        from: 'Vocto Technologies CON-X <onboarding@resend.dev>',
        to: ['sishaath@voctotechnologies.com'],
        reply_to: email,
        subject: `[${inquiryNo}] New CON-X Inquiry — ${company}`,
        html: adminHtml,
      }),
      resendRequest({
        from: 'Vocto Technologies <onboarding@resend.dev>',
        to: [email],
        subject: `Your CON-X Inquiry Confirmation — ${inquiryNo}`,
        html: customerHtml,
      }),
    ]);

    if (adminRes.status >= 400 || customerRes.status >= 400) {
      console.error('Resend error:', adminRes.body, customerRes.body);
      return res.status(500).json({ error: 'Email delivery failed' });
    }

    return res.status(200).json({ success: true, inquiryNo });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
