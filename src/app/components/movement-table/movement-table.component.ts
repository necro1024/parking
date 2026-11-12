import { Component, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RegistroEstacionamiento } from '../../models/parking.model';
import { duracion } from '../../models/parking-statistics';

@Component({
  selector: 'app-movement-table',
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (registros().length) {
      <div class="table-scroll" tabindex="0" role="region" aria-label="Movimientos de estacionamiento">
        <table>
          <thead><tr>
            <th>Placa</th><th>Vehículo</th><th>Perfil</th><th>Zona</th><th>Ingreso</th>
            @if (detalles()) { <th>Salida</th><th>Duración</th><th>Tarifa</th><th>Estado</th><th>Registro</th> }
          </tr></thead>
          <tbody>
            @for (r of registros(); track r.id) {
              <tr>
                <td><strong>{{ r.placa }}</strong></td><td class="capitalize">{{ r.tipo }}</td><td class="capitalize">{{ r.rol }}</td>
                <td>Zona {{ r.zona }}</td><td>{{ r.ingreso | date:'dd/MM/yy HH:mm:ss':'-0500' }}</td>
                @if (detalles()) {
                  <td>{{ r.salida === null ? '—' : (r.salida | date:'dd/MM/yy HH:mm:ss':'-0500') }}</td>
                  <td>{{ duracion(r.duracionMs) }}</td>
                  <td>{{ r.tarifa === null ? '—' : 'S/ ' + (r.tarifa | number:'1.2-2') }}</td>
                  <td>{{ r.estado === 'EN_CURSO' ? 'En curso' : 'Finalizado' }}</td>
                  <td><details><summary>Ver detalle</summary><small>{{ r.id }}</small>
                    @for (c of r.cambios; track $index) {
                      <p>{{ c.fecha | date:'dd/MM/yy HH:mm:ss':'-0500' }} · {{ c.desde }} → {{ c.hasta }} · {{ c.motivo }} ({{ c.responsable }})</p>
                    }
                  </details></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">{{ vacio() }}</p>
    }
  `,
})
export class MovementTableComponent {
  readonly registros = input.required<readonly RegistroEstacionamiento[]>();
  readonly detalles = input(false);
  readonly vacio = input('No hay movimientos para mostrar.');
  readonly duracion = duracion;
}
