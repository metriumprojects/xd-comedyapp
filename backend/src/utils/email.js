const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const port = Number(process.env.EMAIL_PORT) || 587;
  const isSecure = port === 465 || process.env.EMAIL_SECURE === 'true';

  // Create a transporter using SMTP settings from .env with cloud timeouts & IPv4 force
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: port,
    secure: isSecure,
    family: 4, // Force IPv4 to prevent IPv6 socket hanging on Linux cloud environments (Render)
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Comedy App" <${process.env.EMAIL_USER || 'no-reply@comedyapp.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
