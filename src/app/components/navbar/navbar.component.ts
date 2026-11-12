import { Component, input, signal } from '@angular/core';

export const SECCIONES = [
  { id: 'inicio', nombre: 'Inicio', icono: 'bi-grid-1x2' },
  { id: 'ingreso', nombre: 'Registrar ingreso', icono: 'bi-box-arrow-in-right' },
  { id: 'salida', nombre: 'Registrar salida', icono: 'bi-box-arrow-right' },
  { id: 'estacionados', nombre: 'Vehículos estacionados', icono: 'bi-car-front' },
  { id: 'historial', nombre: 'Historial', icono: 'bi-clock-history' },
  { id: 'estadisticas', nombre: 'Estadísticas', icono: 'bi-bar-chart' },
  { id: 'reportes', nombre: 'Reportes', icono: 'bi-file-earmark-text' },
  { id: 'administracion', nombre: 'Administración', icono: 'bi-gear' },
] as const;
export type Seccion = typeof SECCIONES[number]['id'];

@Component({
  selector: 'app-navbar',
  template: `
    <aside class="sidebar">
      <div class="brand">
        <a href="#inicio" (click)="abierto.set(false)"><span class="brand-mark">P</span><span>Parking <strong>UTP</strong><small>Control de estacionamiento</small></span></a>
        <button type="button" class="menu-toggle" aria-controls="parking-nav" [attr.aria-expanded]="abierto()" (click)="abierto.update(v => !v)">Menú</button>
      </div>
      <nav id="parking-nav" [class.open]="abierto()" aria-label="Navegación principal">
        @for (seccion of secciones; track seccion.id) {
          @if (seccion.id === 'historial') { <div class="nav-divider"></div> }
          <a [href]="'#' + seccion.id" [attr.aria-current]="actual() === seccion.id ? 'page' : null" (click)="abierto.set(false)">
            <i [class]="'bi ' + seccion.icono" aria-hidden="true"></i>{{ seccion.nombre }}
          </a>
        }
      </nav>
    </aside>
  `,
})
export class NavbarComponent {
  readonly actual = input.required<Seccion>();
  readonly abierto = signal(false);
  readonly secciones = SECCIONES;
}
