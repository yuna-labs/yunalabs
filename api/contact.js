const nodemailer = require('nodemailer');

const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const LIMITS = { name: 200, email: 320, company: 200, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Basic per-instance rate limiting. Serverless instances don't share memory,
// so this is a best-effort guard against bursts, not a hard global limit.
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_MAX = 5;
const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      if (!v.some(t => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > RATE_MAX;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      const ct = (req.headers['content-type'] || '').toLowerCase();
      try {
        if (ct.includes('application/json')) resolve(JSON.parse(data || '{}'));
        else if (ct.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(data); const obj = {};
          for (const [k, v] of params.entries()) obj[k] = v;
          resolve(obj);
        } else resolve({});
      } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Collapse newlines/control chars — prevents header injection when user
// input is interpolated into the email subject.
function singleLine(str) {
  return String(str).replace(/[\r\n\t\v\f\u00a0]+/g, ' ').trim();
}

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    send(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
    return;
  }

  try {
    const body = await parseBody(req);
    const hp = String(body.hp || '');

    // Honeypot — silently succeed for bots.
    if (hp) { send(res, 200, { ok: true }); return; }

    const name    = singleLine(body.name || '');
    const email   = singleLine(body.email || '');
    const company = singleLine(body.company || '');
    const message = String(body.message || '').trim();

    if (!name || !email || !message) {
      send(res, 400, { ok: false, error: 'Missing required fields.' });
      return;
    }
    if (
      name.length > LIMITS.name ||
      email.length > LIMITS.email ||
      company.length > LIMITS.company ||
      message.length > LIMITS.message
    ) {
      send(res, 400, { ok: false, error: 'One or more fields exceed the allowed length.' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      send(res, 400, { ok: false, error: 'Please provide a valid email address.' });
      return;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to   = process.env.CONTACT_TO || 'info@yuna-labs.com';
    const from = process.env.CONTACT_FROM || 'Yuna Labs <info@yuna-labs.com>';

    if (!host || !user || !pass) {
      console.error('SMTP environment variables are not configured.');
      send(res, 500, { ok: false, error: 'Server error' });
      return;
    }

    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass }
    });

    const subject = `New contact form submission from ${name}`;
    const companyLine = company
      ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>`
      : '';

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif; max-width:600px; color:#0b1b17">
        <h2 style="font-family:'Space Grotesk',system-ui,sans-serif;color:#0a4e45;margin-bottom:16px">New message from yuna-labs.com</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${companyLine}
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;background:#f5faf8;border:1px solid #dce9e6;padding:12px;border-radius:8px;font-family:inherit">${escapeHtml(message)}</pre>
      </div>`;

    await transporter.sendMail({ from, to, replyTo: email, subject, html });

    send(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    send(res, err.statusCode === 413 ? 413 : 500, {
      ok: false,
      error: err.statusCode === 413 ? 'Payload too large' : 'Server error'
    });
  }
};
