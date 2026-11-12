import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParkingService } from '../../services/parking.service';
import { normalizarPlaca, Rol, TipoVehiculo, ZonaId } from '../../models/parking.model';

@Component({
  selector: 'app-access-form',
  imports: [FormsModule, DatePipe],
  template: `
    @if (modo() === 'ingreso') {
      <section class="panel form-panel">
        <h2>Datos del vehículo</h2>
        <form (ngSubmit)="registrarIngreso()" class="fields">
          <label>Placa
            <input name="placa" [(ngModel)]="placa" required maxlength="16" placeholder="ABC-123" class="plate">
          </label>
          <label>Perfil del conductor
            <select name="rol" [ngModel]="rol()" (ngModelChange)="rol.set($event); zona = ''" required>
              <option value="" disabled>Selecciona un perfil</option>
              <option value="estudiante">Estudiante</option>
              <option value="docente">Docente</option>
              <option value="visita">Visita</option>
            </select>
          </label>
          <label>Tipo de vehículo
            <select name="tipo" [ngModel]="tipo()" (ngModelChange)="tipo.set($event); zona = ''" required>
              <option value="" disabled>Selecciona el tipo</option>
              <option value="auto">Auto</option>
              <option value="moto">Moto</option>
            </select>
          </label>
          <label>Zona autorizada
            <select name="zona" [(ngModel)]="zona" required [disabled]="!zonasPermitidas().length">
              <option value="" disabled>Selecciona una zona</option>
              @for (z of zonasPermitidas(); track z.id) {
                <option [value]="z.id">Zona {{ z.id }} · {{ z.libres ? z.libres + ' libres' : 'Llena' }}</option>
              }
            </select>
          </label>
          @if (rol() && tipo() && !zonasPermitidas().length) {
            <p class="notice warning wide">Este perfil y tipo de vehículo no tienen una zona autorizada.</p>
          }
          <div class="wide"><button class="primary" [disabled]="ocupado() || !parking.puedeGuardar">Registrar ingreso</button></div>
        </form>
        @if (mensajeIngreso(); as aviso) {
          <p class="notice feedback" [class.warning]="!aviso.ok" role="status">{{ aviso.mensaje }}</p>
        }
      </section>
    } @else {
      <section class="panel form-panel">
        <h2>Buscar vehículo por placa</h2>
        <form (ngSubmit)="buscar()" class="form-row">
          <label>Placa <input name="placaSalida" [(ngModel)]="placaSalida" required maxlength="16" class="plate" placeholder="ABC-123"></label>
          <button class="secondary">Buscar</button>
        </form>
        @if (encontrado(); as registro) {
          <div class="notice form-row feedback">
            <div><strong>{{ registro.placa }} · Zona {{ registro.zona }}</strong>
              <div>Ingreso {{ registro.ingreso | date:'dd/MM/yyyy HH:mm':'-0500' }}</div>
            </div>
            <button type="button" class="primary" (click)="registrarSalida(registro.id)" [disabled]="ocupado() || !parking.puedeGuardar">Registrar salida</button>
          </div>
        } @else if (busqueda()) {
          <p class="notice feedback" role="status">No hay un ingreso activo para {{ busqueda() }}.</p>
        }
        @if (mensajeSalida(); as aviso) {
          <p class="notice feedback" [class.warning]="!aviso.ok" role="status">{{ aviso.mensaje }}</p>
        }
      </section>
    }
  `,
})
export class AccessFormComponent {
  readonly parking = inject(ParkingService);
  readonly modo = input.required<'ingreso' | 'salida'>();
  readonly rol = signal<Rol | ''>('');
  readonly tipo = signal<TipoVehiculo | ''>('');
  readonly busqueda = signal('');
  readonly ocupado = signal(false);
  readonly mensajeIngreso = signal<{ ok: boolean; mensaje: string } | null>(null);
  readonly mensajeSalida = signal<{ ok: boolean; mensaje: string } | null>(null);
  readonly encontrado = computed(() => this.parking.activos().find(r => r.placa === this.busqueda()));
  readonly zonasPermitidas = computed(() => {
    const rol = this.rol();
    const tipo = this.tipo();
    if (!rol || !tipo) return [];
    const permitidas = this.parking.zonasPermitidas(rol, tipo);
    return this.parking.zonas().filter(z => permitidas.some(p => p.id === z.id));
  });
  placa = '';
  zona: ZonaId | '' = '';
  placaSalida = '';

  async registrarIngreso() {
    const rol = this.rol();
    const tipo = this.tipo();
    if (this.ocupado() || !rol || !tipo || !this.zona) return;
    this.ocupado.set(true);
    const resultado = await this.parking.registrarIngreso(this.placa, rol, tipo, this.zona);
    this.mensajeIngreso.set(resultado);
    if (resultado.ok) this.placa = '';
    this.ocupado.set(false);
  }

  buscar() {
    this.mensajeSalida.set(null);
    this.busqueda.set(normalizarPlaca(this.placaSalida));
  }

  async registrarSalida(id: string) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    const resultado = await this.parking.registrarSalida(id);
    this.mensajeSalida.set(resultado);
    if (resultado.ok) {
      this.placaSalida = '';
      this.busqueda.set('');
    }
    this.ocupado.set(false);
  }
}

