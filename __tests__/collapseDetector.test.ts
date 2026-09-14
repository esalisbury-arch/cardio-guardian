import { CollapseDetector, evaluateCollapse } from '../src/signal/collapseDetector';
import { AccelSample } from '../src/types';

function restSample(t: number, jitter = 0.01): AccelSample {
  return { t, x: 0, y: 0, z: 1 + (Math.random() - 0.5) * jitter };
}

function buildScenario(opts: { impactG: number; stillDurationMs: number; sampleRateHz?: number }): AccelSample[] {
  const rateHz = opts.sampleRateHz ?? 50;
  const dt = 1000 / rateHz;
  const samples: AccelSample[] = [];
  let t = 0;

  for (let i = 0; i < rateHz * 2; i++, t += dt) samples.push(restSample(t)); // 2s normal carry

  samples.push({ t, x: 0, y: 0, z: opts.impactG }); // impact
  const impactT = t;
  t += dt;

  for (; t < impactT + opts.stillDurationMs; t += dt) {
    samples.push(restSample(t, 0.02));
  }
  return samples;
}

describe('evaluateCollapse', () => {
  it('detects collapse after impact + sustained stillness', () => {
    const samples = buildScenario({ impactG: 3.2, stillDurationMs: 8500 });
    const event = evaluateCollapse(samples, samples[samples.length - 1].t);
    expect(event).not.toBeNull();
    expect(event?.confidence).toBeGreaterThan(0);
  });

  it('does not fire if stillness has not lasted long enough yet', () => {
    const samples = buildScenario({ impactG: 3.2, stillDurationMs: 2000 });
    const event = evaluateCollapse(samples, samples[samples.length - 1].t);
    expect(event).toBeNull();
  });

  it('does not fire on impact alone with no stillness follow-through', () => {
    const rateHz = 50;
    const dt = 1000 / rateHz;
    const samples: AccelSample[] = [];
    let t = 0;
    for (let i = 0; i < rateHz * 2; i++, t += dt) samples.push(restSample(t));
    samples.push({ t, x: 0, y: 0, z: 3.2 });
    t += dt;
    // person keeps moving normally afterward (e.g. dropped phone, picked back up)
    for (let i = 0; i < rateHz * 9; i++, t += dt) {
      samples.push({ t, x: Math.sin(i) * 0.5, y: Math.cos(i) * 0.5, z: 1 + Math.sin(i * 0.3) * 0.4 });
    }
    const event = evaluateCollapse(samples, t);
    expect(event).toBeNull();
  });

  it('does not fire on stillness alone with no impact (e.g. phone resting on a table)', () => {
    const rateHz = 50;
    const dt = 1000 / rateHz;
    const samples: AccelSample[] = [];
    let t = 0;
    for (let i = 0; i < rateHz * 12; i++, t += dt) samples.push(restSample(t));
    const event = evaluateCollapse(samples, t);
    expect(event).toBeNull();
  });
});

describe('CollapseDetector (stateful)', () => {
  it('latches a single event and requires reset() before firing again', () => {
    const detector = new CollapseDetector();
    const samples = buildScenario({ impactG: 3.4, stillDurationMs: 8500 });
    for (const s of samples) detector.addSample(s);

    const first = detector.evaluate(samples[samples.length - 1].t);
    expect(first).not.toBeNull();

    const second = detector.evaluate(samples[samples.length - 1].t + 1000);
    expect(second).toEqual(first); // latched, same event object returned

    detector.reset();
    expect(detector.evaluate(0)).toBeNull();
  });
});
