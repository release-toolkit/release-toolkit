/**
 * Webhook 事件类型
 */
export interface WebhookEvent {
  action?: string;
  pull_request?: {
    number: number;
    title?: string;       // 某些 action（如 closed）可能不包含 title
    body?: string | null; // 某些 action 可能不包含 body
    base?: {
      ref?: string;
      repo?: {
        owner?: { login?: string };
        name?: string;
      };
    };
    head?: { ref?: string };
    merged?: boolean;
  };
  installation?: {
    id: number;
    account?: {
      login?: string;
    };
  };
}
