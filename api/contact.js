// api/contact.js
// Node.js Serverless Function for Vercel
// Sends contact form submissions via SMTP using Nodemailer.
// ENV REQUIRED:
//  - SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true" for 465, else "false")
//  - SMTP_USER, SMTP_PASS
//  - (optional) SMTP_FROM (defaults to SMTP_USER)
//  - (optional) CONTACT_TO (defaults to SMTP_USER)

import nodemailer from 'nodemailer';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').toLowerCase());
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Handle both JSON and form-urlencoded just in case
    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }

    const {
      name = '',
      email = '',
      message = '',
      hp = '' // honeypot (should be empty)
    } = body;

    // Bot check (honeypot)
    if (hp && String(hp).trim() !== '') {
      // Pretend success to not tip off bots
      return res.status(200).json({ ok: true });
    }

    // Basic validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true', // true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const to = process.env.CONTACT_TO || process.env.SMTP_USER;

    // Send email
    await transporter.sendMail({
      from: `"Yuna Labs" <${from}>`,
      to,
      replyTo: email,
      subject: `Website Contact — ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        '',
        'Message:',
        message
      ].join('\n'),
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <div style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
          ${escapeHtml(message)}
        </div>
      `
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact API error:', err);
    return res.status(500).json({ error: 'Email failed to send' });
  }
}

// Simple HTML escaper to prevent injection in email HTML
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
