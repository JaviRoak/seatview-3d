# SeatView 3D

Vista previa 3D de asientos para plataformas de boletaje: los usuarios exploran un recinto generado proceduralmente y ven, desde el asiento que elijan, como se veria el evento antes de comprar su entrada.

## Equipo Scrum

| Rol | Integrante |
|---|---|
| Product Owner | Por definir |
| Scrum Master | Por definir |
| Frontend | Por definir |
| Backend | Por definir |
| QA | Por definir |
| DB / DevOps | Por definir |

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
| frontend | React + Vite + Three.js (R3F) |
| backend | API Node.js/Express + Socket.io |
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

## Como levantar el proyecto localmente

Clonar el repositorio y luego, en una terminal, ejecutar dentro de frontend: npm install y npm run dev. En otra terminal, ejecutar dentro de backend: npm install y npm run dev. Variables de entorno necesarias en backend/.env: DATABASE_URL, REDIS_URL y JWT_SECRET.
