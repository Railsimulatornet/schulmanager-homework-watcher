const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { writeText } = require('./files');

function isMailConfigured(config) {
  return (
    config.mail.enabled &&
    config.mail.host &&
    config.mail.port &&
    config.mail.from &&
    config.mail.to
  );
}

async function sendMail(config, payload) {
  if (!isMailConfigured(config)) {
    return { sent: false, reason: 'mail-not-configured' };
  }

  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    requireTLS: !config.mail.secure,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    auth: config.mail.user
      ? {
          user: config.mail.user,
          pass: config.mail.pass
        }
      : undefined
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: config.mail.from,
    to: config.mail.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    messageId: payload.messageId,
    attachments: payload.attachments || []
  });

  return { sent: true, messageId: info.messageId };
}

function persistMailPreview(config, fileName, content) {
  const filePath = path.join(config.mailDir, fileName);
  writeText(filePath, content);
  return filePath;
}

module.exports = { sendMail, persistMailPreview, isMailConfigured };
