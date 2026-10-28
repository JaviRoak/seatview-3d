# SeatView 3D

[![CI](https://github.com/JaviRoak/seatview-3d/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/JaviRoak/seatview-3d/actions/workflows/ci.yml)

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
| Monorepo con npm workspaces, Prisma 7 y docker-compose (PostgreSQL + Redis) | Epica 1 (#1) | #13 | Completado |
| Modelo de datos, migraciones y seed del estadio (~8,500 asientos) | Historia 7 (#11) | #14 | Completado |
| Nucleo del backend y autenticacion con JWT (registro, login, roles) | Historia 7 (#11) | #15 | Completado |
| API de eventos, recintos, zonas y mapa de asientos | Historia 7 (#11) | #30 | Completado |
| Visor 3D del estadio conectado a la API (camara orbital y vista desde el asiento) | Historia 1 (#5) | #31 | Completado |
| Disponibilidad de asientos en tiempo real con Socket.io | Historia 2 (#6) | #32 | Completado |
| Seleccion de asiento desde la vista previa | Historia 3 (#7) | #33 | Completado |
| Bloqueo temporal de asientos en Redis e inicio de sesion | Historia 4 (#8) | #34 | Completado |
| Pruebas automatizadas (backend contra PostgreSQL y Redis reales, frontend) y CI con GitHub Actions | Epica 4 (#4) | #35 | Completado |
| Documentacion de concurrencia y README del Sprint 3 | Historia 4 (#8) | docs/readme-sprint-3 | En Revision (QA) |

## Como levantar el proyecto localmente

Requisitos: Node.js 20 o superior y Docker Desktop (PostgreSQL 16 y Redis 7 corren en contenedores).

```bash
docker compose up -d                     # PostgreSQL 16 y Redis 7
cp backend/.env.example backend/.env     # revisar DATABASE_URL, REDIS_URL y los secretos
cp frontend/.env.example frontend/.env   # VITE_API_URL y VITE_SOCKET_URL vacias: se usa el proxy de Vite
npm ci                                   # instala frontend y backend (npm workspaces) y genera el cliente Prisma
npm run db:migrate                       # aplica las migraciones
npm run db:seed                          # estadio de ~8,500 asientos, eventos y usuarios de prueba
npm run dev                              # backend http://localhost:4000 y frontend http://localhost:5173
```

Verificacion: `npm run typecheck`, `npm run build` y `npm test` (las pruebas del backend usan el PostgreSQL y el Redis de Docker). El CI corre los mismos pasos en cada pull request.

Usuarios de prueba (los crea el seed):

| Usuario | Contrasena | Rol |
|---|---|---|
| javier.polanco@seatview.test | Javier12345! | Administrador |
| andres.berrios@seatview.test | Andres12345! | Usuario |

Como funciona el bloqueo de asientos y por que es seguro: [docs/concurrencia.md](docs/concurrencia.md).
