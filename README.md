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

| Sprint | Fase | Objetivo | Estado |
|---|---|---|---|
| Sprint 1 | Planeacion | Definicion del equipo, stack tecnologico, epicas e historias de usuario | Completado |
| Sprint 2 | Diseño | Diagramas UML, modelo de datos (DER) y arquitectura del sistema | Completado |
| Sprint 3 | Implementacion | Base del proyecto: escena 3D, modelo de datos, migraciones y autenticacion (19 oct - 1 nov 2026) | En curso |

### Sprint 3: estado del tablero

| Tarea | Historia / Epica | PR | Estado |
|---|---|---|---|
| Escena base en R3F con recinto procedural y asientos con InstancedMesh | Historia 1 (#5) | #12 | Completado |
| API inicial Express + TypeScript | Epica 1 (#1) | #12 | Completado |
| Monorepo con npm workspaces, Prisma 7 y docker-compose (PostgreSQL + Redis) | Epica 1 (#1) | #13 | En Revision (QA) |
| Modelo de datos, migraciones y seed del estadio (~8,500 asientos) | Historia 7 (#11) | #14 | En Revision (QA) |
| Nucleo del backend y autenticacion con JWT (registro, login, roles) | Historia 7 (#11) | #15 | En Revision (QA) |
| Pruebas del backend (Vitest) | Epica 4 (#4) | - | Sprint Actual |

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
