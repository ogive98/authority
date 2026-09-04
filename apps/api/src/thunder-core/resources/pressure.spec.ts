import { evaluatePressure } from './pressure';

describe('evaluatePressure', () => {
  const base = {
    forced: false,
    envShed: false,
    envCpu: 0,
    envPg: 0,
    liveCpu: null as number | null,
    liveRam: null as number | null,
    livePg: null as number | null,
  };

  it('does not shed when idle', () => {
    expect(evaluatePressure(base)).toEqual({ shedP4: false });
  });

  it('sheds on live CPU', () => {
    expect(evaluatePressure({ ...base, liveCpu: 0.9 }).reason).toBe(
      'cpu_pressure',
    );
  });

  it('sheds on live RAM', () => {
    expect(evaluatePressure({ ...base, liveRam: 0.95 }).reason).toBe(
      'ram_pressure',
    );
  });

  it('sheds on live PG pool', () => {
    expect(evaluatePressure({ ...base, livePg: 0.85 }).reason).toBe(
      'pg_pool_pressure',
    );
  });
});
