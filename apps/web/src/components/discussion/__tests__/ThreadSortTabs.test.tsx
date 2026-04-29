import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ThreadSortTabs } from '../ThreadSortTabs';

describe('<ThreadSortTabs />', () => {
  // 5.3.1 new/hot/top 3-tab 렌더
  it('3-tab 렌더 — 최신 / 인기 / 추천순', () => {
    render(<ThreadSortTabs value="new" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: '최신' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '인기' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '추천순' })).toBeInTheDocument();
  });

  // 5.3.2 클릭 → onChange 호출
  it('탭 클릭 시 onChange(value) 호출', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThreadSortTabs value="new" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: '인기' }));
    expect(onChange).toHaveBeenCalledWith('hot');
  });

  // 5.3.3 a11y — role=tablist + aria-label
  it('role=tablist + aria-label="토론 정렬"', () => {
    render(<ThreadSortTabs value="new" onChange={() => {}} />);
    expect(screen.getByRole('tablist', { name: '토론 정렬' })).toBeInTheDocument();
  });
});
