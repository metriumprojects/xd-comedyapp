const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Build candidate SMTP transports for cloud hosts (Render).
 * Gmail on Render often fails on one port but works on the other,
 * so we try 587 (STARTTLS) then 465 (SSL) — or the reverse if EMAIL_PORT is set.
 */
function buildTransportConfigs() {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const preferredPort = Number(process.env.EMAIL_PORT) || 587;

  if (!user || !pass) {
    const err = new Error(
      'EMAIL_USER / EMAIL_PASS missing. Set them in Render Environment (Gmail App Password required).'
    );
    err.code = 'EMAIL_ENV_MISSING';
    throw err;
  }

  // App passwords are usually stored with spaces; nodemailer accepts both,
  // but stripping spaces avoids auth failures from copy/paste.
  const cleanPass = pass.replace(/\s+/g, '');

  const base = {
    host,
    auth: { user, pass: cleanPass },
    family: 4, // Render/Linux: avoid IPv6 hang to smtp.gmail.com
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: false },
  };

  const port587 = {
    ...base,
    port: 587,
    secure: false,
    requireTLS: true,
  };

  const port465 = {
    ...base,
    port: 465,
    secure: true,
  };

  // Prefer the configured port first, then the other
  return preferredPort === 465 ? [port465, port587] : [port587, port465];
}

async function sendWithConfig(config, mailOptions) {
  const transporter = nodemailer.createTransport(config);
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } finally {
    try {
      transporter.close();
    } catch (_) {}
  }
}

const sendEmail = async (options) => {
  const configs = buildTransportConfigs();
  const fromUser = (process.env.EMAIL_USER || '').trim();

  const mailOptions = {
    from: `"Comedy App" <${fromUser || 'no-reply@comedyapp.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message || undefined,
    html: options.html,
  };

  let lastError = null;

  for (const config of configs) {
    try {
      logger.info(
        '[Email] Sending via %s:%s (secure=%s) → %s',
        config.host,
        config.port,
        !!config.secure,
        options.email
      );
      const info = await sendWithConfig(config, mailOptions);
      logger.info(
        '[Email] Sent OK messageId=%s response=%s',
        info?.messageId || 'n/a',
        info?.response || 'n/a'
      );
      return info;
    } catch (err) {
      lastError = err;
      logger.warn(
        '[Email] Failed on %s:%s — %s (code=%s)',
        config.host,
        config.port,
        err?.message || err,
        err?.code || 'UNKNOWN'
      );
    }
  }

  const wrapped = new Error(
    `All SMTP attempts failed. Last error: ${lastError?.message || 'unknown'}`
  );
  wrapped.code = lastError?.code || 'EMAIL_SEND_FAILED';
  wrapped.cause = lastError;
  throw wrapped;
};

module.exports = sendEmail;
