const nodemailer = require('nodemailer');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

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

async function sendRecetario(params) {
  const user = process.env.PS_MAIL_USER;
  const pass = process.env.PS_MAIL_PASSWD;
  const pdfUrl = process.env.RECETARIO_PDF_URL;

  if (!user || !pass) {
    throw new Error('Faltan credenciales SMTP (PS_MAIL_USER / PS_MAIL_PASSWD)');
  }
  if (!pdfUrl) {
    throw new Error('Falta RECETARIO_PDF_URL (URL pública del PDF del recetario)');
  }

  const email = (params.email || '').trim();
  const nombre = (params.nombre || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email no válido');
  }

  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error('No se pudo obtener el PDF del recetario');
  }
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

  const transporter = nodemailer.createTransport({
    host: process.env.PS_MAIL_SERVER || 'smtp.office365.com',
    port: parseInt(process.env.PS_MAIL_SMTP_PORT || '587', 10),
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { ciphers: 'SSLv3' }
  });

  const subject = process.env.RECETARIO_EMAIL_SUBJECT || 'Tu recetario Aljomar';
  const text = nombre
    ? `Hola ${nombre},\n\nAquí tienes el recetario de Aljomar en PDF.\n\nUn saludo.`
    : 'Aquí tienes el recetario de Aljomar en PDF.';

  await transporter.sendMail({
    from: process.env.PS_MAIL_FROM || user,
    to: email,
    subject,
    text,
    attachments: [
      {
        filename: 'recetario-aljomar.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
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
    await sendRecetario(params);
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Recetario mail error:', err.message);
    return res.status(500).json({
      message: err.message || 'Error al enviar el correo'
    });
  }
};
