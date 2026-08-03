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

    rerender(<AssessmentPhone frame={reinvestmentFrame(3_000, 1)} />);
    const after = phoneScreens(container);
    const changedPhones = after.filter((screen, index) => screen !== before[index]);

    expect(new Set(before).size).toBeGreaterThan(2);
    expect(changedPhones.length).toBeGreaterThan(0);
    expect(changedPhones.length).toBeLessThan(9);
  });

  it('synchronizes every phone once payment becomes the focus', () => {
    const { container } = render(
      <AssessmentPhone frame={reinvestmentFrame(9_500, 1)} />,
    );
    const screens = phoneScreens(container);

    expect(new Set(screens).size).toBe(1);
    expect(screens[0]).toContain('$17 PAID');
  });
});
