import { RegistroEstacionamiento } from './parking.model';
import { estadisticas, estimarOcupacion, filtrosDeHoy } from './parking-statistics';

const fecha = (hora: string) => Date.parse(`2026-11-11T${hora}:00-05:00`);
const ahora = fecha('12:00');

describe('Estadísticas del parqueadero', () => {
  it('distingue el pico de llegadas del pico de ocupación y promedia el tiempo ocupado', () => {
    const registros = [
      new RegistroEstacionamiento('1', 'ABC123', 'estudiante', 'auto', 'B', fecha('07:00'), 3),
      new RegistroEstacionamiento('2', 'DEF123', 'estudiante', 'auto', 'B', fecha('07:30'), 3),
      new RegistroEstacionamiento('3', 'GHI123', 'estudiante', 'moto', 'B', fecha('08:30'), 1.5),
    ];
    const datos = estadisticas(registros, { ...filtrosDeHoy(ahora), zona: 'B' }, ahora);
    expect(datos.horasMayorEntrada).toEqual(['07:00–08:00']);
    expect(datos.horasMayorPico).toEqual(['08:00–09:00', '09:00–10:00', '10:00–11:00', '11:00–12:00']);
    expect(datos.horas[8]).toMatchObject({ entradas: 1, pico: 3, promedio: 31.25 });
  });

  it('atribuye ingresos, salidas y ocupación a sus respectivas zonas cuando se corrige un registro', () => {
    const ingreso = fecha('07:30');
    const salida = fecha('09:00');
    const registro: RegistroEstacionamiento = {
      ...new RegistroEstacionamiento('1', 'ABC123', 'estudiante', 'auto', 'B', ingreso, 3),
      zona: 'C', salida, duracionMs: salida - ingreso, tarifa: 4.5, estado: 'FINALIZADO',
      cambios: [{ desde: 'B', hasta: 'C', fecha: fecha('08:00'), motivo: 'Conteo', responsable: 'Control' }],
    };
    const filtros = filtrosDeHoy(ahora);
    const zonaB = estadisticas([registro], { ...filtros, zona: 'B' }, ahora);
    const zonaC = estadisticas([registro], { ...filtros, zona: 'C' }, ahora);
    expect(zonaB).toMatchObject({ entradas: 1, salidas: 0, ingresos: 0 });
    expect(zonaB.horas[7].pico).toBe(1);
    expect(zonaB.horas[8].pico).toBe(0);
    expect(zonaC).toMatchObject({ entradas: 0, salidas: 1, ingresos: 4.5 });
    expect(zonaC.horas[8].pico).toBe(1);
    expect(zonaC.permanencia.promedio).toBe(90 * 60_000);
  });

  it('incluye estancias que empiezan antes del período y mantiene la estimación vacía con poco historial', () => {
    const registro = new RegistroEstacionamiento('1', 'ABC123', 'docente', 'auto', 'A', fecha('07:00') - 86400000, 3);
    const filtros = filtrosDeHoy(ahora);
    const datos = estadisticas([registro], filtros, ahora);
    expect(datos).toMatchObject({ entradas: 0, activos: 1, movimientos: [registro] });
    expect(datos.horas[0].pico).toBe(1);
    expect(estimarOcupacion([registro], filtros, ahora)).toEqual([]);
  });
});
