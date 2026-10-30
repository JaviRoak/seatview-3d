import { describe, it, expect } from 'vitest';
import { cardBrand, cardErrors, formatCardNumber, formatExpiry, luhn } from './CheckoutPage';
import { authErrors, passwordScore } from '../auth/LoginPage';

describe('validación de tarjeta (Luhn)', () => {
  it('acepta las tarjetas de prueba', () => {
    expect(luhn('4242 4242 4242 4242')).toBe(true);
    expect(luhn('4000000000000002')).toBe(true);
  });
  it('rechaza números inválidos', () => {
    expect(luhn('4242424242424241')).toBe(false);
    expect(luhn('123')).toBe(false);
  });
});

describe('formulario de pago', () => {
  it('agrupa el número de 4 en 4, agrega la "/" a la fecha y detecta la marca', () => {
    expect(formatCardNumber('4242abc42424242424299')).toBe('4242 4242 4242 4242');
    expect(formatExpiry('1230')).toBe('12/30');
    expect(formatExpiry('1')).toBe('1');
    expect(cardBrand('4242')).toBe('VISA');
    expect(cardBrand('5555 5555')).toBe('MASTERCARD');
  });
  it('marca cada campo con su propio error', () => {
    const now = new Date(2026, 9, 29);
    expect(cardErrors({ holder: 'Javier Polanco', number: '4242 4242 4242 4242', exp: '12/30', cvc: '123' }, now)).toEqual({});
    const e = cardErrors({ holder: 'J', number: '4242 4242 4242 4241', exp: '09/26', cvc: '12' }, now);
    expect(Object.keys(e).sort()).toEqual(['cvc', 'exp', 'holder', 'number']);
  });
});

describe('inicio de sesión', () => {
  it('valida el nombre solo al crear la cuenta', () => {
    expect(authErrors('login', { name: '', email: 'a@b.co', password: '12345678' })).toEqual({});
    expect(authErrors('register', { name: '', email: 'a@b', password: '123' })).toEqual({ name: 'Escribe tu nombre.', email: 'Revisa el correo: falta algo.', password: 'Usa al menos 8 caracteres.' });
  });
  it('puntúa la seguridad de la contraseña de 0 a 4', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Andres12345!')).toBe(4);
  });
});
