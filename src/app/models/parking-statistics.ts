import { RegistroEstacionamiento, Rol, TIPOS, TipoVehiculo, ZONAS, ZonaId, porcentaje } from '../models/parking.model';

export const HORA = 3_600_000;
export const DIA = HORA * 24;
const DESFASE_LIMA = 5 * HORA;

export function fechaLima(instante: number): string {
  return new Date(instante - DESFASE_LIMA).toISOString().slice(0, 10);
}

export function inicioDia(fecha: string): number {
  return Date.parse(fecha + 'T00:00:00-05:00');
}

export function horaLima(instante: number): number {
  return new Date(instante - DESFASE_LIMA).getUTCHours();
}

export function etiquetaHora(hora: number): string {
  const formato = (h: number) => String(h).padStart(2, '0') + ':00';
  return formato(hora) + '–' + formato((hora + 1) % 24);
}

export function duracion(ms: number | null): string {
  if (ms === null) return '—';
  const segundos = Math.floor(ms / 1000);
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor(segundos / 60) % 60;
  if (horas) return `${horas} h ${minutos} min`;
  return minutos ? `${minutos} min ${segundos % 60} s` : `${segundos} s`;
}

export interface FiltrosParking {
  desde: string;
  hasta: string;
  zona: ZonaId | '';
  rol: Rol | '';
  tipo: TipoVehiculo | '';
}

export function filtrosDeHoy(ahora = Date.now()): FiltrosParking {
  const fecha = fechaLima(ahora);
  return { desde: fecha, hasta: fecha, zona: '', rol: '', tipo: '' };
}

interface Tramo {
  zona: ZonaId;
  inicio: number;
  fin: number;
}

function tramos(registro: RegistroEstacionamiento, ahora: number): Tramo[] {
  return [
    ...registro.cambios.map((cambio, i) => ({
      zona: cambio.desde, inicio: registro.cambios[i - 1]?.fecha ?? registro.ingreso, fin: cambio.fecha,
    })),
    { zona: registro.zona, inicio: registro.cambios.at(-1)?.fecha ?? registro.ingreso, fin: registro.salida ?? ahora },
  ];
}

function coincidePerfil(registro: RegistroEstacionamiento, filtros: FiltrosParking): boolean {
  return (!filtros.rol || registro.rol === filtros.rol) && (!filtros.tipo || registro.tipo === filtros.tipo);
}

function zonaIngreso(registro: RegistroEstacionamiento): ZonaId {
  return registro.cambios[0]?.desde ?? registro.zona;
}

function permanencia(registros: readonly RegistroEstacionamiento[]) {
  const valores = registros.flatMap(r => r.duracionMs === null ? [] : [r.duracionMs]);
  if (!valores.length) return { promedio: null, minimo: null, maximo: null };
  return {
    promedio: valores.reduce((a, b) => a + b, 0) / valores.length,
    minimo: valores.reduce((a, b) => Math.min(a, b)),
    maximo: valores.reduce((a, b) => Math.max(a, b)),
  };
}

function picoOcupacion(tramos: readonly Tramo[], inicio: number, fin: number) {
  const cambios = new Map<number, number>();
  for (const tramo of tramos) {
    const entrada = Math.max(inicio, tramo.inicio);
    const salida = Math.min(fin, tramo.fin);
    if (salida <= entrada) continue;
    cambios.set(entrada, (cambios.get(entrada) ?? 0) + 1);
    cambios.set(salida, (cambios.get(salida) ?? 0) - 1);
  }
  let ocupados = 0;
  let pico = 0;
  for (const [, cambio] of [...cambios].sort(([a], [b]) => a - b)) {
    ocupados += cambio;
    pico = Math.max(pico, ocupados);
  }
  return pico;
}

function tiempoOcupado(tramos: readonly Tramo[], inicio: number, fin: number): number {
  return tramos.reduce((total, t) => total + Math.max(0, Math.min(fin, t.fin) - Math.max(inicio, t.inicio)), 0);
}

export function estadisticas(registros: readonly RegistroEstacionamiento[], filtros: FiltrosParking, ahora: number) {
  const inicio = inicioDia(filtros.desde);
  const limite = inicioDia(filtros.hasta) + DIA;
  const fin = Math.min(limite, ahora);
  const periodoValido = Number.isFinite(inicio) && limite > inicio;
  const enPeriodo = (fecha: number) => periodoValido && fecha >= inicio && fecha < limite && fecha <= ahora;
  const enZona = (zona: ZonaId) => !filtros.zona || filtros.zona === zona;
  const filtrados = registros.filter(r => coincidePerfil(r, filtros));
  const entradas = filtrados.filter(r => enPeriodo(r.ingreso) && enZona(zonaIngreso(r)));
  const salidas = filtrados.filter(r => r.salida !== null && enPeriodo(r.salida) && enZona(r.zona));
  const activos = filtrados.filter(r => r.estado === 'EN_CURSO' && enZona(r.zona));
  const tramosPorRegistro = filtrados.map(registro => ({ registro, tramos: tramos(registro, ahora).filter(t => enZona(t.zona)) }));
  const tramosPeriodo = tramosPorRegistro.flatMap(r => r.tramos).filter(t => t.inicio < fin && t.fin > inicio);
  const movimientos = tramosPorRegistro.filter(({ registro, tramos }) => periodoValido && (
    (enPeriodo(registro.ingreso) && enZona(zonaIngreso(registro))) ||
    (registro.salida !== null && enPeriodo(registro.salida) && enZona(registro.zona)) ||
    (fin > inicio && tramos.some(t => t.inicio < fin && t.fin > inicio))
  )).map(r => r.registro).sort((a, b) => b.ingreso - a.ingreso);

  const zonas = ZONAS.filter(z => enZona(z.id)).map(z => ({
    ...z,
    activos: activos.filter(r => r.zona === z.id).length,
    entradas: entradas.filter(r => zonaIngreso(r) === z.id).length,
    uso: porcentaje(tiempoOcupado(tramosPeriodo.filter(t => t.zona === z.id), inicio, fin),
      z.capacidad * Math.max(0, fin - inicio)),
  }));
  const capacidad = zonas.reduce((total, zona) => total + zona.capacidad, 0);
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, entradas: 0, pico: 0, ocupadoMs: 0 }));
  for (const entrada of entradas) horas[horaLima(entrada.ingreso)].entradas++;
  // Las horas sin vehículos tienen un pico de cero. Solo se recorren horas con presencia.
  const tramosPorHora = new Map<number, Tramo[]>();
  for (const tramo of tramosPeriodo) {
    const desde = Math.max(inicio, tramo.inicio);
    const hasta = Math.min(fin, tramo.fin);
    for (let hora = Math.floor(desde / HORA) * HORA; hora < hasta; hora += HORA) {
      const presentes = tramosPorHora.get(hora) ?? [];
      presentes.push(tramo);
      tramosPorHora.set(hora, presentes);
    }
  }
  for (const [hora, presentes] of tramosPorHora) {
    const franja = horas[horaLima(hora)];
    franja.pico = Math.max(franja.pico, picoOcupacion(presentes, hora, hora + HORA));
    franja.ocupadoMs += tiempoOcupado(presentes, hora, hora + HORA);
  }
  const transcurrido = periodoValido ? Math.max(0, fin - inicio) : 0;
  const horasConPromedio = horas.map(({ ocupadoMs, ...franja }) => {
    const observado = Math.floor(transcurrido / DIA) * HORA
      + Math.max(0, Math.min(HORA, transcurrido % DIA - franja.hora * HORA));
    return { ...franja, promedio: observado ? porcentaje(ocupadoMs, capacidad * observado) : null };
  });
  const mayorEntrada = Math.max(...horas.map(h => h.entradas));
  const mayorPico = Math.max(...horas.map(h => h.pico));
  return {
    periodoValido, zonas, horas: horasConPromedio, movimientos, mayorEntrada, mayorPico,
    horasMayorEntrada: horas.filter(h => mayorEntrada > 0 && h.entradas === mayorEntrada).map(h => etiquetaHora(h.hora)),
    horasMayorPico: horas.filter(h => mayorPico > 0 && h.pico === mayorPico).map(h => etiquetaHora(h.hora)),
    entradas: entradas.length, salidas: salidas.length, activos: activos.length,
    ocupacion: porcentaje(activos.length, capacidad), permanencia: permanencia(salidas),
    ingresos: salidas.reduce((total, r) => total + Math.round((r.tarifa ?? 0) * 100), 0) / 100,
    tipos: TIPOS.map(tipo => ({
      tipo, entradas: entradas.filter(r => r.tipo === tipo).length,
      ...permanencia(salidas.filter(r => r.tipo === tipo)),
    })),
  };
}

export function estimarOcupacion(registros: readonly RegistroEstacionamiento[], filtros: FiltrosParking, ahora: number) {
  if (!registros.length) return [];
  const primerIngreso = registros.reduce((inicio, r) => Math.min(inicio, r.ingreso), ahora);
  // Hasta doce semanas completas de observación, sin suponer datos previos al primer registro.
  const desde = Math.max(Math.ceil(primerIngreso / HORA) * HORA, Math.floor(ahora / HORA) * HORA - 84 * DIA);
  const hasta = Math.floor(ahora / HORA) * HORA;
  const capacidad = ZONAS.filter(z => !filtros.zona || filtros.zona === z.id).reduce((suma, z) => suma + z.capacidad, 0);
  const historial = registros.filter(r => coincidePerfil(r, filtros)).flatMap(r => tramos(r, ahora))
    .filter(t => (!filtros.zona || t.zona === filtros.zona) && t.fin > desde);
  if (!historial.length) return [];
  const acumulados = Array.from({ length: 168 }, () => ({ muestras: 0, ocupacion: 0 }));
  for (let hora = desde; hora < hasta; hora += HORA) {
    const dia = new Date(hora - DESFASE_LIMA).getUTCDay();
    acumulados[dia * 24 + horaLima(hora)].muestras++;
  }
  for (const tramo of historial) {
    for (let hora = Math.max(desde, Math.floor(tramo.inicio / HORA) * HORA); hora < Math.min(hasta, tramo.fin); hora += HORA) {
      const dia = new Date(hora - DESFASE_LIMA).getUTCDay();
      acumulados[dia * 24 + horaLima(hora)].ocupacion += Math.min(hora + HORA, tramo.fin) - Math.max(hora, tramo.inicio);
    }
  }
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return acumulados.flatMap((fila, i) => fila.muestras >= 4 && fila.ocupacion > 0 ? [{
    dia: dias[Math.floor(i / 24)], hora: etiquetaHora(i % 24), muestras: fila.muestras,
    ocupacion: porcentaje(fila.ocupacion, fila.muestras * HORA * capacidad),
  }] : []).sort((a, b) => b.ocupacion - a.ocupacion).slice(0, 3);
}
