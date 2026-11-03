
import { describe, expect, it } from 'vitest';
import { contactSchema } from '../../src/modules/support/support.routes';

describe('Validación del formulario de soporte', () => {
  const validContact = {
    name: 'Usuario de prueba',
    email: 'prueba@example.com',
    subject: 'Problema con una compra',
    message: 'Necesito ayuda con una compra realizada.',
  };

  it('acepta una consulta válida', () => {
    const result = contactSchema.safeParse(validContact);
    expect(result.success).toBe(true);
  });

  it('rechaza un correo electrónico inválido', () => {
    const result = contactSchema.safeParse({
      ...validContact,
      email: 'correo-invalido',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza mensajes demasiado cortos', () => {
    const result = contactSchema.safeParse({
      ...validContact,
      message: 'Hola',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza consultas sin asunto', () => {
    const result = contactSchema.safeParse({
      ...validContact,
      subject: '',
    });
    expect(result.success).toBe(false);
  });

  it('elimina espacios innecesarios', () => {
    const result = contactSchema.parse({
      ...validContact,
      name: '  Usuario de prueba  ',
    });

    expect(result.name).toBe('Usuario de prueba');
  });
});