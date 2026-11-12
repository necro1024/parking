import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import {
  Estacionamiento, Incidencia, RegistroEstacionamiento, Rol, TARIFAS, TipoIncidencia,
  TipoVehiculo, Usuario, ZonaId, crearVehiculo, normalizarPlaca, ocupacionPorZona, porcentaje,
} from '../models/parking.model';

interface Configuracion {
  tarifas: Record<TipoVehiculo, number>;
  umbral: number;
}

interface EstadoParking {
  registros: readonly RegistroEstacionamiento[];
  incidencias: readonly Incidencia[];
  configuracion: Configuracion;
}

interface Resultado {
  ok: boolean;
  mensaje: string;
  estado?: EstadoParking;
}

const CLAVE = 'parking-utp-v1';
const INICIAL: EstadoParking = {
  registros: [], incidencias: [], configuracion: { tarifas: TARIFAS, umbral: 75 },
};

@Injectable({ providedIn: 'root' })
export class ParkingService implements OnDestroy {
  private readonly estado = signal(INICIAL);
  private readonly estacionamiento = new Estacionamiento();
  private readonly error = signal('');
  readonly errorAlmacenamiento = this.error.asReadonly();
  readonly puedeGuardar = !!navigator.locks;
  readonly registros = computed(() => this.estado().registros);
  readonly incidencias = computed(() => this.estado().incidencias);
  readonly configuracion = computed(() => this.estado().configuracion);
  readonly activos = computed(() => this.registros().filter(r => r.estado === 'EN_CURSO'));
  readonly zonas = computed(() => ocupacionPorZona(this.registros(), this.configuracion().umbral));
  readonly resumen = computed(() => {
    const capacidad = this.zonas().reduce((total, zona) => total + zona.capacidad, 0);
    const ocupados = this.activos().length;
    return { capacidad, ocupados, libres: capacidad - ocupados, ocupacion: porcentaje(ocupados, capacidad) };
  });

  private readonly actualizar = (evento: StorageEvent) => {
    if (evento.key === CLAVE || evento.key === null) this.cargar();
  };

  constructor() {
    this.cargar();
    window.addEventListener('storage', this.actualizar);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.actualizar);
  }

  zonasPermitidas(rol: Rol, tipo: TipoVehiculo) {
    return this.estacionamiento.zonasPermitidas(new Usuario(rol), tipo);
  }

  registrarIngreso(placa: string, rol: Rol, tipo: TipoVehiculo, zona: ZonaId): Promise<Resultado> {
    return this.operar(estado => {
      const normalizada = normalizarPlaca(placa);
      if (!/^[A-Z0-9]{3,10}$/.test(normalizada)) return this.fallo('Ingresa una placa válida.');
      const destino = this.zonasPermitidas(rol, tipo).find(permitida => permitida.id === zona);
      if (!destino) return this.fallo('Selecciona una zona autorizada.');
      if (estado.registros.some(r => r.placa === normalizada && r.estado === 'EN_CURSO')) {
        return this.fallo(`La placa ${normalizada} ya tiene un ingreso activo.`);
      }
      if (this.estaLlena(estado, zona, destino.capacidad)) {
        const mensaje = `La Zona ${zona} está llena. Selecciona otra zona autorizada con cupo.`;
        return { ...this.fallo(mensaje), estado: this.conIncidencia(estado, 'Sin cupo', mensaje) };
      }
      const registro = new RegistroEstacionamiento(crypto.randomUUID(), normalizada, rol, tipo,
        zona, Date.now(), estado.configuracion.tarifas[tipo]);
      return { ok: true, mensaje: `Ingreso registrado para ${normalizada} en Zona ${zona}.`,
        estado: { ...estado, registros: [...estado.registros, registro] } };
    });
  }

  registrarSalida(id: string): Promise<Resultado> {
    return this.operar(estado => {
      const registro = estado.registros.find(r => r.id === id && r.estado === 'EN_CURSO');
      if (!registro) return this.fallo('El ingreso seleccionado ya no está activo.');
      const salida = Math.max(Date.now(), registro.ingreso, registro.cambios.at(-1)?.fecha ?? 0);
      const duracionMs = salida - registro.ingreso;
      const tarifa = crearVehiculo(registro.tipo, registro.placa, registro.tarifaHora).tarifa(duracionMs);
      const finalizado: RegistroEstacionamiento = { ...registro, estado: 'FINALIZADO', salida, duracionMs, tarifa };
      return { ok: true, mensaje: `Salida de ${registro.placa} registrada. Tarifa S/ ${tarifa.toFixed(2)}.`,
        estado: { ...estado, registros: estado.registros.map(r => r.id === id ? finalizado : r) } };
    });
  }

  guardarConfiguracion(auto: number, moto: number, umbral: number): Promise<Resultado> {
    return this.operar(estado => {
      if (![auto, moto].every(n => Number.isFinite(n) && n >= 0) || !Number.isInteger(umbral) || umbral < 1 || umbral > 99) {
        return this.fallo('Ingresa tarifas válidas y un umbral entero entre 1 y 99 %.');
      }
      return { ok: true, mensaje: 'Configuración guardada.',
        estado: { ...estado, configuracion: { tarifas: { auto, moto }, umbral } } };
    });
  }

  registrarIncidencia(tipo: TipoIncidencia, descripcion: string, responsable: string): Promise<Resultado> {
    return this.operar(estado => descripcion.trim()
      ? { ok: true, mensaje: 'Incidencia registrada.', estado: this.conIncidencia(estado, tipo, descripcion, responsable) }
      : this.fallo('Escribe una descripción para registrar la incidencia.'));
  }

  resolverIncidencia(id: string): Promise<Resultado> {
    return this.operar(estado => ({
      ok: true, mensaje: 'Incidencia resuelta.',
      estado: { ...estado, incidencias: estado.incidencias.map(i => i.id === id ? { ...i, estado: 'RESUELTA' } : i) },
    }));
  }

  corregirZona(id: string, zona: ZonaId, motivo: string, responsable: string): Promise<Resultado> {
    return this.operar(estado => {
      const registro = estado.registros.find(r => r.id === id && r.estado === 'EN_CURSO');
      if (!registro || !motivo.trim() || !responsable.trim()) return this.fallo('Selecciona un ingreso activo e indica el motivo y el responsable.');
      const destino = this.zonasPermitidas(registro.rol, registro.tipo).find(permitida => permitida.id === zona);
      if (!destino || zona === registro.zona) return this.fallo('Selecciona otra zona autorizada.');
      if (this.estaLlena(estado, zona, destino.capacidad)) return this.fallo(`La Zona ${zona} está llena.`);
      const fecha = Math.max(Date.now(), registro.ingreso, registro.cambios.at(-1)?.fecha ?? 0);
      const cambio = { desde: registro.zona, hasta: zona, fecha, motivo: motivo.trim(), responsable: responsable.trim() };
      const actualizado = { ...registro, zona, cambios: [...registro.cambios, cambio] };
      const mensaje = `Zona de ${registro.placa} corregida de ${registro.zona} a ${zona}.`;
      const conRegistros = { ...estado, registros: estado.registros.map(r => r.id === id ? actualizado : r) };
      return { ok: true, mensaje, estado: this.conIncidencia(conRegistros, 'Corrección de zona', `${mensaje} ${motivo.trim()}`, responsable, 'RESUELTA') };
    });
  }

  private estaLlena(estado: EstadoParking, zona: ZonaId, capacidad: number): boolean {
    return estado.registros.filter(r => r.estado === 'EN_CURSO' && r.zona === zona).length >= capacidad;
  }

  private conIncidencia(estado: EstadoParking, tipo: TipoIncidencia, descripcion: string,
    responsable = '', estadoIncidencia: Incidencia['estado'] = 'ABIERTA'): EstadoParking {
    const incidencia: Incidencia = {
      id: crypto.randomUUID(), fecha: Date.now(), tipo, descripcion: descripcion.trim(),
      responsable: responsable.trim(), estado: estadoIncidencia,
    };
    return { ...estado, incidencias: [...estado.incidencias, incidencia] };
  }

  private fallo(mensaje: string): Resultado {
    return { ok: false, mensaje };
  }

  private leer(): EstadoParking {
    const datos = localStorage.getItem(CLAVE);
    return datos === null ? INICIAL : JSON.parse(datos) as EstadoParking;
  }

  private cargar(): void {
    try {
      this.estado.set(this.leer());
      this.error.set('');
    } catch {
      this.error.set('No se pudo leer el almacenamiento local.');
    }
  }

  private async operar(accion: (estado: EstadoParking) => Resultado): Promise<Resultado> {
    if (!this.puedeGuardar) return this.fallo('Abre la aplicación en localhost o HTTPS en un navegador compatible.');
    try {
      return await navigator.locks.request(CLAVE, () => {
        const estado = this.leer();
        const resultado = accion(estado);
        if (resultado.estado) localStorage.setItem(CLAVE, JSON.stringify(resultado.estado));
        this.estado.set(resultado.estado ?? estado);
        this.error.set('');
        return resultado;
      });
    } catch {
      return this.fallo('No se pudo guardar la operación. Revisa el almacenamiento del navegador.');
    }
  }
}
