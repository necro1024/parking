import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ParkingService } from '../../services/parking.service';

@Component({
  selector: 'app-zone-list',
  imports: [DecimalPipe],
  template: `
    @let resumen = parking.resumen();
    <div class="metrics">
      <article class="metric"><span>Capacidad total</span><strong>{{ resumen.capacidad }}</strong><small>Cupos en 3 zonas</small></article>
      <article class="metric"><span>Vehículos estacionados</span><strong>{{ resumen.ocupados }}</strong><small>Ingresos activos</small></article>
      <article class="metric"><span>Cupos disponibles</span><strong>{{ resumen.libres }}</strong><small>En todo el campus</small></article>
      <article class="metric"><span>Ocupación total</span><strong>{{ resumen.ocupacion | number:'1.0-1' }}<small>%</small></strong>
        <progress [value]="resumen.ocupacion" max="100" aria-label="Ocupación total"></progress>
      </article>
    </div>
    <section class="zone-section" id="zonas">
      <h2>Disponibilidad por zona</h2>
      <div class="zones">
        @for (zona of parking.zonas(); track zona.id) {
          <article class="panel zone">
            <div class="zone-head">
              <div class="zone-letter">{{ zona.id }}</div>
              <span class="pill" [class.warning]="zona.estado === 'Casi lleno'" [class.danger]="zona.estado === 'Lleno'">{{ zona.estado }}</span>
            </div>
            <h3>Zona {{ zona.id }}</h3>
            <p>{{ zona.nombre }}</p>
            <div class="zone-count"><strong>{{ zona.libres }}</strong> de {{ zona.capacidad }} cupos libres</div>
            <progress [class.warning]="zona.estado === 'Casi lleno'" [class.danger]="zona.estado === 'Lleno'"
              [value]="zona.ocupacion" max="100" [attr.aria-label]="'Ocupación de Zona ' + zona.id"></progress>
            <div class="zone-foot"><span>{{ zona.ocupados }} ocupados</span><strong>{{ zona.ocupacion | number:'1.0-1' }} %</strong></div>
          </article>
        }
      </div>
    </section>
  `,
})
export class ZoneListComponent {
  readonly parking = inject(ParkingService);
}
