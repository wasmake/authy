import { fireEvent, render, screen } from '@testing-library/react';

import { AppCard } from '@/components/app-card';
describe('AppCard', () => {
  it('renders an accessible launch action', () => {
    const focus = jest.fn();
    const open = jest.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    render(
      <AppCard
        app={{ id: 'one', name: 'Console', type: 'LOCAL', launchUrl: 'https://example.test' }}
      />,
    );
    const link = screen.getByRole('link', { name: /open/i });
    expect(link).toHaveAttribute('href', '/api/v1/applications/one/launch');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(link);

    expect(open).toHaveBeenCalledWith('/api/v1/applications/one/launch', '_blank');
    expect(open.mock.results[0]?.value.opener).toBeNull();
    expect(focus).toHaveBeenCalled();
  });
});
