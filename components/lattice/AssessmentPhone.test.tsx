import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reinvestmentFrame } from '@/lib/lattice/reinvestment';
import { AssessmentPhone } from './AssessmentPhone';

function phoneScreens(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.mini-content')).map(
    (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

describe('AssessmentPhone', () => {
  it('advances only some phones at each staggered motion tick', () => {
    const { container, rerender } = render(
      <AssessmentPhone frame={reinvestmentFrame(2_500, 1)} />,
    );
    const before = phoneScreens(container);

    rerender(
      <AssessmentPhone
        frame={{ ...reinvestmentFrame(2_500, 1), connectionElapsedMs: 500 }}
      />,
    );
    const after = phoneScreens(container);
    const changedPhones = after.filter((screen, index) => screen !== before[index]);

    expect(new Set(before).size).toBeGreaterThan(2);
    expect(changedPhones.length).toBeGreaterThan(0);
    expect(changedPhones.length).toBeLessThan(9);
  });

  it('keeps every phone fully visible and moving during payment', () => {
    const { container, rerender } = render(
      <AssessmentPhone frame={reinvestmentFrame(9_500, 1)} />,
    );
    const before = phoneScreens(container);
    const aside = container.querySelector('aside') as HTMLElement;

    rerender(
      <AssessmentPhone
        frame={{ ...reinvestmentFrame(9_500, 1), connectionElapsedMs: 3_000 }}
      />,
    );

    expect(aside.style.opacity).toBe('1');
    expect(phoneScreens(container)).not.toEqual(before);
  });

  it('stays visible when the next reinvestment loop starts', () => {
    const { container } = render(
      <AssessmentPhone frame={reinvestmentFrame(500, 2)} />,
    );

    expect((container.querySelector('aside') as HTMLElement).style.opacity).toBe('1');
  });

  it('glows only the phone selected by the rotating connection', () => {
    const { container } = render(
      <AssessmentPhone
        frame={{ ...reinvestmentFrame(5_000, 1), connectionElapsedMs: 2_600 }}
      />,
    );
    const connectedPhones = container.querySelectorAll('.mini-phone.connected');

    expect(connectedPhones).toHaveLength(1);
    expect(Array.from(container.querySelectorAll('.mini-phone')).indexOf(connectedPhones[0]!)).toBe(2);
  });
});
