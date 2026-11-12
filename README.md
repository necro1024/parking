# Parking UTP

Ejecuta `npm start` y abre `http://localhost:4200`. Compila con `npm run build` y ejecuta las pruebas con `npm test -- --watch=false`.

## Operación de la demostración

- Seguridad registra la placa, el perfil, el vehículo y la zona elegida al llegar. El sistema registra la hora real y descuenta un cupo de esa zona. Para la salida, seguridad busca la placa y confirma el movimiento activo.
- Administración consulta estadísticas, movimientos, reportes e incidencias. Puede configurar tarifas y el umbral de alerta (75 % inicialmente) y corregir la zona de un ingreso activo. La corrección actualiza la ocupación desde su registro y conserva la zona anterior, la hora, el motivo y el responsable declarado.
- Los autos comienzan con S/ 3.00 por hora y las motos con S/ 1.50. Se aplica la tarifa vigente al ingresar. El importe se calcula proporcionalmente al tiempo real, incluyendo minutos y segundos, y se redondea al céntimo.
- Las fechas y horas se presentan en hora de Lima. Los reportes cuentan entradas por fecha de ingreso y salidas, tarifas y duraciones por fecha de salida. Las franjas de ocupación incluyen vehículos que ingresaron en horas o días previos. La ocupación actual refleja el momento de consulta y aplica los filtros de zona, perfil y vehículo.
- La estimación compara el promedio de ocupación de cada día de la semana y hora durante hasta 12 semanas. Exige al menos cuatro observaciones de una franja con ocupación histórica positiva. Es una descripción de los registros y no garantiza cupo futuro.

## Almacenamiento y acceso

El prototipo original mantenía los cupos en memoria. La demostración guarda movimientos, configuración e incidencias en `localStorage`. Las pestañas del mismo origen y perfil reciben cambios por el evento de almacenamiento. Web Locks serializa las escrituras y el sistema vuelve a leer y validar el estado antes de guardar. Usa localhost o HTTPS con un navegador compatible. Los datos permanecen en ese perfil mientras se conserve el almacenamiento del sitio.

Las secciones de seguridad y administración organizan el trabajo de la demostración. Para usar el sistema en el campus desde varios equipos se requiere una API autenticada y almacenamiento compartido. La API debería autorizar cada operación según el rol (seguridad o administración), registrar la identidad del responsable y ejecutar la validación de placa activa y capacidad junto con la escritura en una transacción. Cada equipo consultaría ese mismo estado. Si se habilita una vista pública, solo expondría el conteo agregado de cupos. La universidad debe definir el horario de atención para configurar controles de horario.
