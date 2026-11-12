import { ParkingService } from './parking.service';

describe('Movimientos del estacionamiento', () => {
  let primera: ParkingService;
  let segunda: ParkingService;

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });
    let valor: string | null = null;
    vi.mocked(localStorage.getItem).mockImplementation(() => valor);
    vi.mocked(localStorage.setItem).mockImplementation((_clave, datos) => { valor = datos; });

    let cola: Promise<unknown> = Promise.resolve();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_nombre: string, operacion: () => unknown) => {
          const resultado = cola.then(operacion);
          cola = resultado.catch(() => undefined);
          return resultado;
        },
      },
    });
    primera = new ParkingService();
    segunda = new ParkingService();
  });

  afterEach(() => {
    primera.ngOnDestroy();
    segunda.ngOnDestroy();
    Reflect.deleteProperty(navigator, 'locks');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('revalida el último cupo bajo el mismo bloqueo entre dos instancias', async () => {
    for (let i = 0; i < 7; i++) {
      expect((await primera.registrarIngreso(`ABC${i}`, 'docente', 'auto', 'A')).ok).toBe(true);
    }
    const resultados = await Promise.all([
      primera.registrarIngreso('DEF123', 'docente', 'auto', 'A'),
      segunda.registrarIngreso('GHI123', 'docente', 'auto', 'A'),
    ]);
    expect(resultados.map(r => r.ok)).toEqual([true, false]);
    expect(segunda.activos()).toHaveLength(8);
    expect(segunda.incidencias()[0].tipo).toBe('Sin cupo');
  });

  it('rechaza perfiles sin autorización y placas duplicadas, y conserva la salida al reabrir', async () => {
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    expect((await primera.registrarIngreso('ABC-123', 'visita', 'auto', 'A')).ok).toBe(false);
    expect((await primera.registrarIngreso('ABC-123', 'visita', 'auto', 'C')).ok).toBe(true);
    expect((await segunda.registrarIngreso('abc123', 'estudiante', 'auto', 'B')).ok).toBe(false);
    expect(segunda.incidencias()).toHaveLength(0);
    const id = primera.activos()[0].id;
    expect((await segunda.guardarConfiguracion(4, 2, 80)).ok).toBe(true);
    reloj.mockReturnValue(1_800_001_800_000);
    expect((await primera.registrarSalida(id)).ok).toBe(true);
    expect((await segunda.registrarSalida(id)).ok).toBe(false);
    const reabierta = new ParkingService();
    try {
      expect(reabierta.activos()).toHaveLength(0);
      expect(reabierta.registros()).toMatchObject([{ placa: 'ABC123', estado: 'FINALIZADO', tarifa: 1.5, duracionMs: 1_800_000 }]);
    } finally {
      reabierta.ngOnDestroy();
    }
  });
});
