# SeatView 3D

Vista previa 3D de asientos para plataformas de boletaje: los usuarios exploran un recinto generado proceduralmente y ven, desde el asiento que elijan, como se veria el evento antes de comprar su entrada.

## Equipo Scrum

| Rol | Nombre |
|---|---|
| Product Owner | Javier Polanco |
| Scrum Master | Saúl Arévalo |
| Desarroladores| Alejandro González, José Mendoza, Manuel Berrios, Jorge Polanco, Saúl Arévalo, Javier Polanco |


Duracion de cada Sprint: 2 semanas.

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Renderizado 3D | Three.js via React Three Fiber, InstancedMesh para los asientos |
| Backend | Node.js + Express (TypeScript) |
| Tiempo real | Socket.io (WebSockets) |
| Bloqueo temporal de asientos | Redis (SET NX EX) |
| Base de datos | PostgreSQL + Prisma ORM |
| Autenticacion | JWT |
| Despliegue | Vercel (frontend), Railway (backend, PostgreSQL, Redis) |
| Pruebas | Vitest + medicion de FPS en navegador |

## Estructura del repositorio

| Carpeta / archivo | Contenido |
|---|---|
| frontend | React + Vite + Three.js (R3F): escena, generacion procedural del recinto, asientos con InstancedMesh |
| backend | API Node.js/Express (TypeScript) + esquema Prisma; Socket.io y Redis en sprints siguientes |
| docs | Diagramas UML, DER, anexos de Sprint 0 |
| LICENSE | MIT, codigo propio del equipo |
| README.md | Este documento |

Flujo de ramas: main es la rama protegida y siempre desplegable, develop es la rama de integracion, y cada tarjeta del tablero se trabaja en una rama feature/nombre-funcionalidad que se integra a develop mediante Pull Request.

## Tablero agil

Gestion mediante GitHub Projects (vista Kanban), integrado con los issues y pull requests de este repositorio. Columnas: Backlog, Sprint Actual, En Progreso, En Revision (QA), Completado.

Backlog inicial, alineado a los objetivos especificos reestructurados:

| Epica | Descripcion |
|---|---|
| 1. Arquitectura Grafica y de Base de Datos | Escena base en Three.js/R3F, esquema PostgreSQL, generacion procedural del recinto |
| 2. Desarrollo de Interaccion 3D | Camara orbital, seleccion de asiento por raycasting, vista previa, InstancedMesh |
| 3. Mecanismo de Concurrencia y Pagos | Bloqueo temporal en Redis, difusion de estado por WebSockets, checkout simulado |
| 4. Pruebas de Rendimiento | FPS con miles de asientos renderizados, reservas concurrentes sobre el mismo asiento |

## Sprints

| Sprint | Fechas | Objetivo | Estado |
|---|---|---|---|
| Sprint 0 | 25 ago 2026 - 18 oct 2026 | Definicion del equipo, stack, backlog inicial, diagramas UML y DER | Completado |
| Sprint 1 | 19 oct 2026 - 1 nov 2026 | Base del proyecto: escena 3D con recinto procedural y API con esquema de datos | En curso |
| Sprint 2 | 2 nov 2026 - 15 nov 2026 | Interaccion 3D: raycasting, seleccion de asiento y vista desde el asiento | Planeado |
| Sprint 3 | 16 nov 2026 - 29 nov 2026 | Concurrencia: bloqueo temporal en Redis y difusion por WebSockets | Planeado |
| Sprint 4 | 30 nov 2026 - 13 dic 2026 | Checkout simulado, autenticacion JWT y pruebas de rendimiento | Planeado |

### Sprint 1: estado del tablero

| Historia / tarea | Epica | Estado |
|---|---|---|
| Inicializar frontend con React + Vite + TypeScript | 1 | Completado |
| Escena base en R3F con camara orbital, luces y escenario | 1 | Completado |
| Generacion procedural de secciones, filas y asientos | 1 | Completado |
| Renderizado de asientos con InstancedMesh (3,000 asientos en una draw call) | 2 | Completado |
| Pruebas unitarias de la generacion del recinto (Vitest) | 4 | Completado |
| Inicializar API Express + TypeScript con endpoint de salud | 1 | Completado |
| Esquema Prisma inicial (Usuario, Recinto, Seccion, Asiento, Evento, Reserva) | 1 | En Revision (QA) |
| Primera migracion y seed del recinto de prueba en PostgreSQL | 1 | En Progreso |
| Endpoint GET /api/recintos/:id que devuelva la configuracion del recinto | 1 | Sprint Actual |
| Consumir la configuracion del recinto desde el frontend | 1 | Sprint Actual |

## Como levantar el proyecto localmente

Requisitos: Node.js 20 o superior, PostgreSQL y Redis (Redis se usara a partir del Sprint 3).

Frontend:

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # pruebas con Vitest
```

Backend:

```bash
cd backend
cp .env.example .env   # ajustar DATABASE_URL, REDIS_URL y JWT_SECRET
npm install
npx prisma generate
npm run dev            # http://localhost:4000/api/health
```
