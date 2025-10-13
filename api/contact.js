
const nodemailer = require('nodemailer');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
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
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await parseBody(req);
    const { name = '', email = '', message = '', hp = '' } = body;

    // Honeypot
    if (hp) { res.statusCode = 200; res.end(JSON.stringify({ ok: true })); return; }

    if (!name || !email || !message) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: 'Missing required fields.' }));
      return;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to   = process.env.CONTACT_TO || 'info@yuna-labs.com';
    const from = process.env.CONTACT_FROM || `Yuna Labs <info@yuna-labs.com>`;

    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass }
    });

    const subject = `New contact form submission from ${name}`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
        <h2>New message from the website</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap">${escapeHtml(message)}</pre>
      </div>`;

    await transporter.sendMail({ from, to, replyTo: email, subject, html });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Server error' }));
  }
};
