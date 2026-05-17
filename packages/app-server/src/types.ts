/**
 * Webhook 事件类型
 */
export interface WebhookEvent {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    base: {
      ref: string;
      repo: {
        owner: { login: string };
        name: string;
      };
    };
    head: { ref: string };
    merged?: boolean;
  };
  installation?: {
    id: number;
  };
}
