export type IntegrationApp = { key: string; name: string; category: string; available: boolean };

export interface IntegrationAdapter {
  listApps(): Promise<IntegrationApp[]>;
}

class MockComposioAdapter implements IntegrationAdapter {
  async listApps() {
    return [
      { key: 'github', name: 'GitHub', category: 'Developer tools', available: true },
      { key: 'slack', name: 'Slack', category: 'Collaboration', available: true },
      { key: 'salesforce', name: 'Salesforce', category: 'CRM', available: true },
    ];
  }
}

// Live Composio calls can be added here without leaking provider concerns into domain services.
export const integrationAdapter: IntegrationAdapter = new MockComposioAdapter();
