
import { Link } from 'react-router-dom';

const questions = [
  {
    question: '¿Cómo puedo comprar boletos?',
    answer:
      'Explora los eventos disponibles, selecciona el evento que te interesa, elige tus asientos y continúa con el proceso de compra.',
  },
  {
    question: '¿Puedo ver mi asiento antes de comprar?',
    answer:
      'SeatView 3D permite consultar una vista previa de los asientos disponibles en los eventos y recintos compatibles.',
  },
  {
    question: '¿Dónde encuentro mis boletos?',
    answer:
      'Puedes consultar tus boletos desde la sección Mis boletos, disponible en la navegación de SeatView 3D.',
  },
  {
    question: '¿Qué hago si tengo problemas con mi compra?',
    answer:
      'Comunícate con nuestro equipo mediante el formulario de contacto e incluye una descripción del problema.',
  },
  {
    question: '¿Puedo solicitar un reembolso?',
    answer:
      'Puedes enviar una consulta sobre reembolsos desde el formulario de contacto. La solicitud estará sujeta a las condiciones aplicables.',
  },
];

export function FaqPage() {
  return (
    <main style={{ maxWidth: 850, margin: '0 auto', padding: '48px 24px' }}>
      <h1>Preguntas frecuentes</h1>
      <p>
        Encuentra respuestas a las dudas más comunes sobre SeatView 3D.
      </p>

      <div style={{ marginTop: 32 }}>
        {questions.map((item) => (
          <details
            key={item.question}
            style={{
              padding: '20px 0',
              borderBottom: '1px solid #5555',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              {item.question}
            </summary>
            <p style={{ marginTop: 12 }}>{item.answer}</p>
          </details>
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <h2>¿Necesitas más ayuda?</h2>
        <p>Si no encontraste una respuesta, puedes escribirnos.</p>
        <Link to="/contacto">Ir al formulario de contacto</Link>
      </div>
    </main>
  );
}
