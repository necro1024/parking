import { Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-parking-chart',
  template: `
    <div class="parking-chart">
      <canvas #canvas role="img" [attr.aria-label]="titulo()"></canvas>
    </div>
    <details class="chart-values">
      <summary>Ver datos del gráfico</summary>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Franja o categoría</th>
            @for (serie of config().data.datasets; track $index) { <th>{{ serie.label }}</th> }
          </tr></thead>
          <tbody>
            @for (etiqueta of config().data.labels; track $index; let i = $index) {
              <tr><th>{{ etiqueta }}</th>
                @for (serie of config().data.datasets; track $index) { <td>{{ serie.data[i] ?? '—' }}</td> }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
})
export class ParkingChartComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  readonly titulo = input.required<string>();
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const canvas = this.canvas();
      const config = this.config();
      if (!canvas) return;
      if (this.chart) {
        this.chart.data = structuredClone(config.data);
        this.chart.options = config.options ?? {};
        this.chart.update('none');
      } else {
        this.chart = new Chart(canvas.nativeElement, { ...config, data: structuredClone(config.data) });
      }
    });
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
