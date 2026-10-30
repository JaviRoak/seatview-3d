# ADR 0001: Modelos 3D y recursos binarios en el repositorio

- **Estado:** Aceptada
- **Fecha:** 2026-10-30
- **Sprint:** 4
- **Decide:** Javier Polanco (Product Owner)

## Contexto

El visor usa modelos 3D de los estadios (`.glb`), mapas de asientos (`.json`) e imágenes de los eventos (`.png`), guardados en `frontend/public/models/`. Con los recintos reales (Estadio Cuscatlán y Estadio Mágico González) estos archivos suman unos 14 MB; el más grande pesa unos 8 MB.

Git guarda **cada versión** de un archivo binario de forma completa y para siempre en el historial. Si se sube cada iteración de un modelo (`cuscatlan-v3.glb`, `cuscatlan-v4.glb`, `cuscatlan-v5.glb`…), el repositorio crece sin límite. Clonarlo se vuelve lento para todo el equipo, para el CI y para el despliegue, aunque después se borren esos archivos.

## Decisión

1. **Solo se sube la versión final de cada modelo.** Las iteraciones de trabajo se quedan en la computadora de quien modela, fuera del repositorio. La carpeta `frontend/public/models/wip/` queda ignorada por git para eso.
2. **Nombres estables.** Un modelo actualizado reemplaza al anterior con el mismo nombre; no se agregan archivos `-v6`, `-v7`. El historial de git ya guarda las versiones anteriores.
3. **Sin Git LFS por ahora.** Los archivos están muy por debajo de los límites de GitHub (avisa desde 50 MB por archivo y rechaza desde 100 MB), y LFS obligaría a todo el equipo, al CI y a Vercel a configurarlo.
4. **Origen de los recursos.** Los modelos 3D (`.glb`) de `frontend/public/models/` son de **elaboración propia del equipo**. Cualquier recurso de terceros debe tener una licencia que permita usarlo, con el crédito en el README.
5. **Sin enlaces directos a imágenes de terceros.** Las portadas y los pósters se guardan como archivos del proyecto (`frontend/public/models/` o la subida del panel de administración), no se cargan desde servidores ajenos (hotlinking). Un enlace externo puede romperse en cualquier momento y usa imágenes con derechos de autor.

## Consecuencias

- **A favor:**
  - El repositorio crece solo cuando cambia de verdad un recurso final.
  - Clonar, el CI y el despliegue siguen siendo rápidos.
  - No hace falta instalar ni configurar nada extra.
- **En contra:**
  - El historial de las iteraciones de trabajo no queda en git; si se necesita, lo guarda quien modela.
  - Si un modelo cambia, su versión anterior sigue ocupando espacio en el historial. Es aceptable mientras los cambios sean pocos.

## Cuándo revisar esta decisión

Pasar a **Git LFS** (u otro almacenamiento de archivos) si se cumple cualquiera de estos casos:

- Un archivo pasa de 50 MB.
- La carpeta `frontend/public/models/` pasa de unos 100 MB.
- Los modelos empiezan a cambiar cada semana.

## Alternativas consideradas

| Alternativa | Por qué no, por ahora |
|---|---|
| Git LFS | Configuración extra para el equipo, el CI y Vercel; cuota gratuita limitada en GitHub. |
| Almacenamiento externo (S3, CDN) | Agrega infraestructura y credenciales que el prototipo no necesita. |
| Subir cada versión del modelo | El repositorio crece sin límite y no se puede achicar sin reescribir el historial. |
