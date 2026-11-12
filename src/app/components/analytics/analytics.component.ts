import { ChartConfiguration } from 'chart.js';
import { ParkingChartComponent } from '../parking-chart/parking-chart.component';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParkingService } from '../../services/parking.service';
import { ROLES, TIPOS, ZONAS, normalizarPlaca } from '../../models/parking.model';
import { DIA, FiltrosParking, duracion, estadisticas, estimarOcupacion, etiquetaHora, fechaLima, filtrosDeHoy, inicioDia } from '../../models/parking-statistics';
import { MovementTableComponent } from '../movement-table/movement-table.component';

@Component({
  selector: 'app-analytics',
  imports: [ParkingChartComponent, FormsModule, DecimalPipe, MovementTableComponent],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent {
  private readonly parking = inject(ParkingService);
  readonly modo = input.required<'estadisticas' | 'historial' | 'reportes'>();
  readonly ahora = signal(Date.now());
  readonly filtros = signal(filtrosDeHoy(this.ahora()));
  readonly placa = signal('');
  readonly datos = computed(() => estadisticas(this.parking.registros(), this.filtros(), this.horaActual()));
  readonly estimaciones = computed(() => estimarOcupacion(this.parking.registros(), this.filtros(), this.horaActual()));
  readonly movimientos = computed(() => this.datos().movimientos.filter(r => r.placa.includes(normalizarPlaca(this.placa()))));
  readonly zonas = ZONAS;
  readonly roles = ROLES;
  readonly tipos = TIPOS;
  readonly duracion = duracion;
  readonly etiquetaHora = etiquetaHora;


  readonly graficos = computed(() => {
    const d = this.datos();
    const colores = ['#b52239', '#267a91', '#d59223'];
    const barras = (labels: string[], datasets: ChartConfiguration['data']['datasets'], porcentaje = false): ChartConfiguration => ({
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, max: porcentaje ? 100 : undefined, ticks: { precision: porcentaje ? 1 : 0 } },
        },
      },
    });
    const horas = d.horas.map(h => etiquetaHora(h.hora));
    const zonas = d.zonas.map(z => 'Zona ' + z.id);
    return {
      ingresos: barras(horas, [{ label: 'Ingresos', data: d.horas.map(h => h.entradas), backgroundColor: colores[0], borderRadius: 4 }]),
      ocupacion: barras(horas, [{ label: 'Máximo simultáneo', data: d.horas.map(h => h.pico), backgroundColor: colores[1], borderRadius: 4 }]),
      promedio: barras(horas, [{ label: 'Ocupación promedio (%)', data: d.horas.map(h => h.promedio), backgroundColor: colores[1], borderRadius: 4 }], true),
      zonas: barras(zonas, [
        { label: 'Ocupados ahora', data: d.zonas.map(z => z.activos), backgroundColor: colores[0], borderRadius: 4 },
        { label: 'Ingresos del período', data: d.zonas.map(z => z.entradas), backgroundColor: colores[1], borderRadius: 4 },
      ]),
      uso: barras(zonas, [{ label: 'Utilización (%)', data: d.zonas.map(z => Number(z.uso.toFixed(2))), backgroundColor: colores, borderRadius: 4 }], true),
      vehiculos: {
        type: 'doughnut', data: { labels: ['Autos', 'Motos'], datasets: [
          { label: 'Ingresos', data: d.tipos.map(t => t.entradas), backgroundColor: colores, borderWidth: 2 },
        ] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } } },
      } as ChartConfiguration,
    };
  });

  constructor() {
    const timer = setInterval(() => this.ahora.set(Date.now()), 15000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private horaActual(): number {
    return Math.max(this.ahora(), Date.now());
  }

  filtrar<K extends keyof FiltrosParking>(campo: K, valor: FiltrosParking[K]) {
    this.filtros.update(f => ({ ...f, [campo]: valor }));
  }

  elegirPeriodo(periodo: 'dia' | 'semana' | 'mes') {
    const hoy = fechaLima(Date.now());
    const lunes = (new Date(hoy).getUTCDay() + 6) % 7;
    const desde = periodo === 'dia' ? hoy : periodo === 'semana'
      ? fechaLima(inicioDia(hoy) - lunes * DIA) : hoy.slice(0, 7) + '-01';
    this.filtros.update(f => ({ ...f, desde, hasta: hoy }));
  }

  imprimir() {
    window.print();
  }

  exportar() {
    const datos = this.datos();
    const filtros = this.filtros();
    const fecha = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'medium',
    });
    const fechaCelda = (valor: number | null) => valor === null ? '' : fecha.format(valor);
    const filas = [
      ['Parking UTP', 'Reporte de estacionamiento (hora de Lima)'],
      ['Desde', filtros.desde, 'Hasta', filtros.hasta, 'Zona', filtros.zona || 'Todas',
        'Perfil', filtros.rol || 'Todos', 'Vehículo', filtros.tipo || 'Todos'],
      ['Entradas', datos.entradas, 'Salidas', datos.salidas, 'Tarifas de salidas (PEN)', datos.ingresos.toFixed(2)],
      ['Vehículos estacionados ahora', datos.activos, 'Ocupación actual (%)', datos.ocupacion.toFixed(1)],
      ['Promedio (ms)', datos.permanencia.promedio ?? '', 'Mínimo (ms)', datos.permanencia.minimo ?? '', 'Máximo (ms)', datos.permanencia.maximo ?? ''],
      ['Zona', 'Ocupados ahora', 'Capacidad', 'Entradas', 'Utilización del período (%)'],
      ...datos.zonas.map(z => [z.id, z.activos, z.capacidad, z.entradas, z.uso.toFixed(1)]),
      [],
      ['ID', 'Placa', 'Vehículo', 'Perfil', 'Zona registrada', 'Ingreso', 'Salida', 'Duración (ms)', 'Tarifa (PEN)', 'Estado'],
      ...datos.movimientos.map(r => [r.id, r.placa, r.tipo, r.rol, r.zona, fechaCelda(r.ingreso), fechaCelda(r.salida),
        r.duracionMs ?? '', r.tarifa?.toFixed(2) ?? '', r.estado]),
    ];
    const csv = filas.map(fila => fila.map(celda => '"' + String(celda).replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `parking-utp-${filtros.desde}-${filtros.hasta}.csv`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
