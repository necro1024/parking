import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavbarComponent, SECCIONES, Seccion } from './components/navbar/navbar.component';
import { AccessFormComponent } from './components/access-form/access-form.component';
import { ZoneListComponent } from './components/zone-list/zone-list.component';
import { MovementTableComponent } from './components/movement-table/movement-table.component';
import { AnalyticsComponent } from './components/analytics/analytics.component';
import { AdministrationComponent } from './components/administration/administration.component';
import { ParkingService } from './services/parking.service';

const TITULOS: Record<Seccion, string> = {
  inicio: 'Resumen del estacionamiento',
  ingreso: 'Registrar ingreso',
  salida: 'Registrar salida',
  estacionados: 'Vehículos estacionados',
  historial: 'Historial de movimientos',
  estadisticas: 'Estadísticas y Reportes — Parking UTP',
  reportes: 'Reportes de estacionamiento',
  administracion: 'Administración',
};

@Component({
  selector: 'app-root',
  imports: [NavbarComponent, AccessFormComponent, ZoneListComponent, MovementTableComponent, AnalyticsComponent, AdministrationComponent],
  template: `
    <app-navbar [actual]="seccion()" />
    <main class="workspace" id="contenido">
      <header class="page-header">
        <div><p class="breadcrumb-label">Parking UTP <span>/</span> {{ nombreSeccion() }}</p><h1>{{ titulo() }}</h1></div>
        @if (seccion() === 'inicio') {
          <div class="actions no-print"><a href="#salida" class="secondary">Registrar salida</a><a href="#ingreso" class="primary">Registrar ingreso</a></div>
        }
      </header>
      @if (parking.errorAlmacenamiento() || !parking.puedeGuardar) {
        <p class="notice warning" role="status">{{ parking.errorAlmacenamiento() || 'Para registrar movimientos, abre la aplicación en localhost o HTTPS en un navegador compatible.' }}</p>
      }
      <div class="alerts no-print" role="status">
        @if (!parking.resumen().libres) {
          <p class="notice danger">Estacionamiento lleno. No quedan cupos disponibles.</p>
        } @else {
          @for (zona of parking.zonas(); track zona.id) {
            @if (zona.estado === 'Lleno') {
              <p class="notice danger">Zona {{ zona.id }} llena. No quedan cupos.</p>
            } @else if (zona.estado === 'Casi lleno') {
              <p class="notice warning">Zona {{ zona.id }} casi llena. Cupos disponibles: {{ zona.libres }}.</p>
            }
          }
        }
      </div>
      @switch (seccion()) {
        @case ('inicio') {
          <app-zone-list />
          <section class="panel">
            <div class="section-head"><h2>Últimos ingresos activos</h2><a href="#estacionados">Ver vehículos estacionados</a></div>
            <app-movement-table [registros]="recientes()" vacio="Todavía no hay vehículos estacionados." />
          </section>
        }
        @case ('ingreso') { <app-access-form modo="ingreso" /> }
        @case ('salida') { <app-access-form modo="salida" /> }
        @case ('estacionados') {
          <section class="panel"><h2>{{ parking.activos().length }} vehículos con ingreso activo</h2>
            <app-movement-table [registros]="parking.activos()" vacio="No hay vehículos estacionados." />
          </section>
        }
        @case ('historial') { <app-analytics modo="historial" /> }
        @case ('estadisticas') { <app-analytics modo="estadisticas" /> }
        @case ('reportes') { <app-analytics modo="reportes" /> }
        @case ('administracion') {
          <app-administration />
        }
      }
    </main>
  `,
})
export class AppComponent {
  readonly parking = inject(ParkingService);
  readonly seccion = signal(this.leerSeccion());
  readonly titulo = computed(() => TITULOS[this.seccion()]);
  readonly nombreSeccion = computed(() => SECCIONES.find(s => s.id === this.seccion())?.nombre);
  readonly recientes = computed(() => this.parking.activos().slice(-5).reverse());

  @HostListener('window:hashchange')
  cambiarSeccion() {
    this.seccion.set(this.leerSeccion());
    window.scrollTo({ top: 0 });
  }

  private leerSeccion(): Seccion {
    return SECCIONES.find(s => '#' + s.id === window.location.hash)?.id ?? 'inicio';
  }
}
