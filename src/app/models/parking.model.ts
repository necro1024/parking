export type Rol = 'estudiante' | 'docente' | 'visita';
export type TipoVehiculo = 'auto' | 'moto';
export type ZonaId = 'A' | 'B' | 'C';

export class Usuario {
  constructor(readonly rol: Rol) {}
}

export class Zona {
  constructor(readonly id: ZonaId, readonly nombre: string, readonly capacidad = 8) {}
}

export const ZONAS = [new Zona('A', 'Docentes'), new Zona('B', 'Estudiantes y docentes'),
  new Zona('C', 'Estudiantes y visitas')];
export const ROLES: Rol[] = ['estudiante', 'docente', 'visita'];
export const TIPOS: TipoVehiculo[] = ['auto', 'moto'];
export const TARIFAS = { auto: 3, moto: 1.5 };

export class Vehiculo {
  constructor(readonly placa: string) {}
  tarifa(duracionMs: number): number {
    return this.calcularTarifa(duracionMs, 2);
  }
  protected calcularTarifa(duracionMs: number, tarifaHora: number): number {
    return Math.round(duracionMs / 3_600_000 * tarifaHora * 100) / 100;
  }
}
export class Auto extends Vehiculo {
  constructor(placa: string, private readonly tarifaHora = TARIFAS.auto) { super(placa); }
  override tarifa(duracionMs: number): number {
    return this.calcularTarifa(duracionMs, this.tarifaHora);
  }
}
export class Moto extends Vehiculo {
  constructor(placa: string, private readonly tarifaHora = TARIFAS.moto) { super(placa); }
  override tarifa(duracionMs: number): number {
    return this.calcularTarifa(duracionMs, this.tarifaHora);
  }
}
export function crearVehiculo(tipo: TipoVehiculo, placa: string, tarifaHora: number): Vehiculo {
  return tipo === 'moto' ? new Moto(placa, tarifaHora) : new Auto(placa, tarifaHora);
}

export interface CambioZona {
  desde: ZonaId;
  hasta: ZonaId;
  fecha: number;
  motivo: string;
  responsable: string;
}

export class RegistroEstacionamiento {
  readonly estado: 'EN_CURSO' | 'FINALIZADO' = 'EN_CURSO';
  readonly salida: number | null = null;
  readonly duracionMs: number | null = null;
  readonly tarifa: number | null = null;
  readonly cambios: readonly CambioZona[] = [];

  constructor(
    readonly id: string, readonly placa: string, readonly rol: Rol,
    readonly tipo: TipoVehiculo, readonly zona: ZonaId, readonly ingreso: number,
    readonly tarifaHora: number,
  ) {}
}

export type TipoIncidencia = 'Error de registro' | 'Ingreso duplicado' | 'Diferencia de conteo' | 'Corrección de zona' | 'Sin cupo' | 'Otro';
export interface Incidencia {
  id: string;
  fecha: number;
  tipo: TipoIncidencia;
  descripcion: string;
  responsable: string;
  estado: 'ABIERTA' | 'RESUELTA';
}

export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[\s-]+/g, '');
}

const REGLAS: Record<ZonaId, { roles: Rol[]; tipos: TipoVehiculo[] }> = {
  A: { roles: ['docente'], tipos: ['auto'] },
  B: { roles: ['estudiante', 'docente'], tipos: TIPOS },
  C: { roles: ['estudiante', 'visita'], tipos: TIPOS },
};

export class Estacionamiento {
  readonly zonas = ZONAS;

  zonasPermitidas(usuario: Usuario, tipo: TipoVehiculo): Zona[] {
    return this.zonas.filter(({ id }) => REGLAS[id].roles.includes(usuario.rol) && REGLAS[id].tipos.includes(tipo));
  }
}

export function porcentaje(ocupados: number, capacidad: number): number {
  return capacidad ? ocupados / capacidad * 100 : 0;
}

export function ocupacionPorZona(registros: readonly RegistroEstacionamiento[], umbral: number) {
  return ZONAS.map(zona => {
    const ocupados = registros.filter(r => r.estado === 'EN_CURSO' && r.zona === zona.id).length;
    const ocupacion = porcentaje(ocupados, zona.capacidad);
    const estado = ocupacion >= 100 ? 'Lleno' : ocupacion >= umbral ? 'Casi lleno' : 'Disponible';
    return { ...zona, ocupados, libres: zona.capacidad - ocupados, ocupacion, estado };
  });
}
