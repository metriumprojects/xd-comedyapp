const nodemailer = require('nodemailer');
const dns = require('dns');
const { promisify } = require('util');
const logger = require('./logger');

const dnsLookup = promisify(dns.lookup);

/**
 * Force IPv4 DNS lookup. Render often resolves smtp.gmail.com to IPv6 first,
 * then fails with ENETUNREACH (:::0). Nodemailer's top-level `family: 4` is not
 * always honored, so we inject a custom lookup + prefer ipv4first globally.
 */
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

function ipv4Lookup(hostname, options, callback) {
  // nodemailer may call with (hostname, options, cb) or (hostname, cb)
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...(options || {}), family: 4, all: false }, callback);
}

/**
 * Build candidate SMTP transports for cloud hosts (Render).
 * Try 587 (STARTTLS) then 465 (SSL) — or reverse if EMAIL_PORT is set.
 */
function buildTransportConfigs(resolvedHost) {
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

  const cleanPass = pass.replace(/\s+/g, '');

  const base = {
    // Connect via resolved IPv4 when available; keep hostname for TLS SNI / certs
    host: resolvedHost || host,
    name: host,
    auth: { user, pass: cleanPass },
    lookup: ipv4Lookup,
    family: 4,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false,
      servername: host, // important when host is a raw IP
    },
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

  return preferredPort === 465 ? [port465, port587] : [port587, port465];
}

async function resolveIpv4(hostname) {
  try {
    const result = await dnsLookup(hostname, { family: 4 });
    const address = typeof result === 'string' ? result : result?.address;
    if (address) {
      logger.info('[Email] Resolved %s → IPv4 %s', hostname, address);
      return address;
    }
  } catch (err) {
    logger.warn('[Email] IPv4 resolve failed for %s: %s — falling back to hostname', hostname, err.message);
  }
  return null;
}

async function sendWithConfig(config, mailOptions) {
  const transporter = nodemailer.createTransport(config);
  try {
    return await transporter.sendMail(mailOptions);
  } finally {
    try {
      transporter.close();
    } catch (_) {}
  }
}

const sendEmail = async (options) => {
  const hostname = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const resolvedHost = await resolveIpv4(hostname);
  const configs = buildTransportConfigs(resolvedHost);
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
        '[Email] Sending via %s:%s (secure=%s, connectHost=%s) → %s',
        hostname,
        config.port,
        !!config.secure,
        config.host,
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
