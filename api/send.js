const nodemailer = require('nodemailer');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const TO_EMAILS = 'marketing@aljomar.es, rrhh@aljomar.es';

function getParams(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body.params || req.body;
  }
  if (typeof req.body === 'string') {
    const params = {};
    for (const pair of new URLSearchParams(req.body)) {
      params[pair[0]] = pair[1];
    }
    return params;
  }
  return {};
}

async function sendMail(params) {
  const user = process.env.PS_MAIL_USER;
  const pass = process.env.PS_MAIL_PASSWD;
  if (!user || !pass) {
    throw new Error('Faltan credenciales SMTP (PS_MAIL_USER / PS_MAIL_PASSWD)');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.PS_MAIL_SERVER || 'smtp.office365.com',
    port: parseInt(process.env.PS_MAIL_SMTP_PORT || '587', 10),
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { ciphers: 'SSLv3' }
  });

  const nombre = (params.nombre || '').trim();
  const apellidos = (params.apellidos || '').trim();
  const subject = `Nueva candidatura: ${nombre} ${apellidos}`.trim() + ' - Aljomar';
  const text = [
    `Nombre: ${nombre}`,
    `Apellidos: ${apellidos}`,
    `Email: ${(params.email || '').trim()}`,
    `Teléfono: ${(params.telefono || '').trim()}`,
    '',
    'Comentarios:',
    (params.mensaje || '(sin comentarios)').trim()
  ].join('\n');

  const mailOptions = {
    from: process.env.PS_MAIL_FROM || user,
    to: TO_EMAILS,
    subject,
    text,
    replyTo: (params.email || '').trim() || undefined
  };

  if (params.fileData && params.fileName) {
    mailOptions.attachments = [{
      filename: params.fileName,
      content: Buffer.from(params.fileData, 'base64'),
      contentType: params.fileType || undefined
    }];
  }

  await transporter.sendMail(mailOptions);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const params = getParams(req);

  try {
    await sendMail(params);
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('RRHH mail error:', err.message);
    return res.status(500).json({
      message: err.message || 'Error al enviar el correo'
    });
  }
};
