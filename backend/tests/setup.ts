// Entorno para pruebas: mismas variables que .env con NODE_ENV=test.
import 'dotenv/config';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-12345678';
process.env.TICKET_SECRET ??= 'test-ticket-secret-12345678';
process.env.MAIL_TRANSPORT = 'console';
