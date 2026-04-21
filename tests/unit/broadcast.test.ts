import { describe, it, expect, vi } from 'vitest';
import { createBroadcaster } from '../../src/broadcast.js';

describe('broadcaster', () => {
  it('fan-out to all subscribers', () => {
    const b = createBroadcaster();
    const a = vi.fn();
    const c = vi.fn();
    b.subscribe(a);
    b.subscribe(c);
    b.broadcast('e', { x: 1 });
    expect(a).toHaveBeenCalledWith('e', { x: 1 });
    expect(c).toHaveBeenCalledWith('e', { x: 1 });
  });

  it('unsubscribe stops further events', () => {
    const b = createBroadcaster();
    const s = vi.fn();
    const unsubscribe = b.subscribe(s);
    b.broadcast('e', 1);
    unsubscribe();
    b.broadcast('e', 2);
    expect(s).toHaveBeenCalledTimes(1);
  });

  it('handler errors do not block other subscribers', () => {
    const b = createBroadcaster();
    b.subscribe(() => { throw new Error('boom'); });
    const s = vi.fn();
    b.subscribe(s);
    expect(() => b.broadcast('e', 1)).not.toThrow();
    expect(s).toHaveBeenCalledOnce();
  });
});
