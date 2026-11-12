import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParkingService } from '../../services/parking.service';

@Component({
  selector: 'app-administration',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './administration.component.html',
})
export class AdministrationComponent {
  readonly parking = inject(ParkingService);
  readonly aviso = signal<{ ok: boolean; mensaje: string } | null>(null);
  readonly ocupado = signal(false);
  auto = this.parking.configuracion().tarifas.auto;
  moto = this.parking.configuracion().tarifas.moto;
  umbral = this.parking.configuracion().umbral;
  guardarConfiguracion() {
    return this.operar(() => this.parking.guardarConfiguracion(this.auto, this.moto, this.umbral));
  }

  resolver(id: string) {
    return this.operar(() => this.parking.resolverIncidencia(id));
  }

  private async operar(accion: () => Promise<{ ok: boolean; mensaje: string }>) {
    if (this.ocupado()) return false;
    this.ocupado.set(true);
    const resultado = await accion();
    this.aviso.set(resultado);
    this.ocupado.set(false);
    return resultado.ok;
  }
}
