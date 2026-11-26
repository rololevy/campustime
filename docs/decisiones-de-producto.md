# Decisiones de producto

Reglas acordadas que guían la implementación. Si alguna cambia, se actualiza acá en el mismo PR que la implementa.

## 1. Las sesiones son solo virtuales (2026-11-25)

Todas las sesiones son por videollamada (Meet, Zoom, Jitsi o la que elijan las personas). La plataforma no ofrece ni coordina encuentros presenciales.

**Por qué:**

- **Seguridad.** No exponemos a dos personas que no se conocen a encontrarse en un mismo lugar.
- **Menos complejidad en el MVP.** No hay lugares, sedes de encuentro ni guías de seguridad presencial que mantener.
- **Más alcance.** Se puede aprender con gente de cualquier sede o universidad.

**Implica:**

- Las sesiones no tienen campo de modalidad ni de lugar.
- Quien enseña pega el link de la videollamada al aceptar. El link solo lo ven las dos personas de esa sesión.
- La sede y la institución sirven para afinidad en el match (misma carrera o materia), no para coordinar dónde encontrarse.
- Si dos personas deciden verse en persona, lo acuerdan por su cuenta: la plataforma no lo gestiona.

## 2. El crédito se transfiere cuando se confirma la sesión, no cuando se genera el link (2026-11-25)

Generar un link no prueba que la sesión haya ocurrido. Además, la asistencia a Meet no se puede verificar desde la plataforma: la API de Google requiere Workspace.

| Momento | Qué pasa con el crédito |
|---|---|
| Quien aprende pide la sesión | Se **reserva**: deja de estar disponible, pero no se transfiere. |
| Quien enseña rechaza, la solicitud vence (48 h) o alguien cancela antes del inicio | La reserva vuelve a quien la pidió. |
| Termina el horario y **quien aprende confirma** | Se transfiere a quien enseñó. |
| **Quien enseña confirma** y quien aprende no objeta en 72 h | Se transfiere automáticamente. |
| **Nadie confirma** en 7 días | La reserva vuelve a quien la pidió. |
| Alguien dice que la sesión no ocurrió | Queda en disputa y la resuelve moderación. |

Las reseñas, los reportes y el tope de sesiones acreditadas por par de personas por semana limitan el abuso, por ejemplo marcar como hechas sesiones que nunca ocurrieron.
