
import { useState, type FormEvent } from 'react';
import { api } from '../../api/client';

type ContactForm = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const initialForm: ContactForm = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

export function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  function updateField(field: keyof ContactForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const response = await api<{
        message: string;
        ticket: { id: string };
      }>('/support/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setSuccess(
        `Consulta enviada correctamente. Número de referencia: ${response.ticket.id}`
      );
      setForm(initialForm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible enviar tu consulta. Inténtalo nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: 8,
    border: '1px solid #8888',
    marginTop: 6,
    marginBottom: 20,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
  };

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px' }}>
      <h1>Contacto</h1>
      <p>
        ¿Tienes alguna duda o inconveniente? Envíanos tu consulta.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
        <label htmlFor="contact-name">Nombre completo</label>
        <input
          id="contact-name"
          style={fieldStyle}
          type="text"
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />

        <label htmlFor="contact-email">Correo electrónico</label>
        <input
          id="contact-email"
          style={fieldStyle}
          type="email"
          required
          maxLength={254}
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
        />

        <label htmlFor="contact-subject">Asunto</label>
        <input
          id="contact-subject"
          style={fieldStyle}
          type="text"
          required
          minLength={3}
          maxLength={150}
          value={form.subject}
          onChange={(e) => updateField('subject', e.target.value)}
        />

        <label htmlFor="contact-message">Mensaje</label>
        <textarea
          id="contact-message"
          style={{ ...fieldStyle, minHeight: 150, resize: 'vertical' }}
          required
          minLength={10}
          maxLength={5000}
          value={form.message}
          onChange={(e) => updateField('message', e.target.value)}
        />

        {success && (
          <p role="status" style={{ color: '#22c55e', marginBottom: 16 }}>
            {success}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: '#ef4444', marginBottom: 16 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar consulta'}
        </button>
      </form>
    </main>
  );
}
