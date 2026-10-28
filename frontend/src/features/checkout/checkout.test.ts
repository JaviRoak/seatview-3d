import { describe, it, expect } from 'vitest';
import { luhn } from './CheckoutPage';

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
