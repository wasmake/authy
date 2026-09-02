import { render, screen } from '@testing-library/react';

import { AppCard } from '@/components/app-card';
describe('AppCard', () => {
  it('renders an accessible launch action', () => {
    render(
      <AppCard
        app={{ id: 'one', name: 'Console', type: 'LOCAL', launchUrl: 'https://example.test' }}
      />,
    );
    expect(screen.getByRole('link', { name: /launch/i })).toHaveAttribute(
      'href',
      '/api/v1/applications/one/launch',
    );
  });
});
