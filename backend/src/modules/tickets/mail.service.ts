/**
 * Envío de boletos por correo (issue #10) — SIMULADO por defecto.
 * MAIL_TRANSPORT=console  → imprime el correo en la consola del servidor.
 * MAIL_TRANSPORT=ethereal → cuenta de prueba en Ethereal con URL de vista previa.
 * MAIL_TRANSPORT=smtp     → SMTP real con SMTP_HOST/PORT/USER/PASS.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter | null> {
  if (env.MAIL_TRANSPORT === 'console') return null;
  if (transporter) return transporter;
  if (env.MAIL_TRANSPORT === 'ethereal') {
    const a = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({ host: a.smtp.host, port: a.smtp.port, secure: a.smtp.secure, auth: { user: a.user, pass: a.pass } });
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT ?? 587, secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface TicketMail {
  to: string; name: string; eventName: string; eventDate: Date; orderId: string;
  seats: Array<{ zone: string; row: string; number: number; code: string }>;
}

export async function sendTicketsEmail(mail: TicketMail): Promise<{ previewUrl?: string }> {
  const text = [
    `Hola ${mail.name},`, '',
    `Tu compra para "${mail.eventName}" (${mail.eventDate.toLocaleString('es-SV')}) fue confirmada.`,
    `Orden: ${mail.orderId}`, '', 'Tus entradas:',
    ...mail.seats.map((s) => `  • ${s.zone} · ${s.row === 'GA' ? 'Acceso por zona · Sin asiento asignado' : `Fila ${s.row} · Asiento ${s.number}`}  (código ${s.code.slice(0, 16)}…)`),
    '', 'Puedes ver y descargar tus boletos con código QR en "Mis boletos".', '— SeatView 3D',
  ].join('\n');
  const t = await getTransporter();
  if (!t) {
    console.log(`\n[correo simulado] ─────────────────────────────\nPara: ${mail.to}\nAsunto: Tus boletos para ${mail.eventName}\n\n${text}\n───────────────────────────────────────────────\n`);
    return {};
  }
  const info = await t.sendMail({ from: env.MAIL_FROM, to: mail.to, subject: `Tus boletos para ${mail.eventName}`, text });
  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  if (previewUrl) console.log(`[correo] vista previa: ${previewUrl}`);
  return { previewUrl };
}
