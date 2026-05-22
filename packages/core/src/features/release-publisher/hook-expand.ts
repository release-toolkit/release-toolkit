import type {
  AfterReleaseHook,
  HookCommand,
  LifecycleHook,
} from '../../shared/config/index.js';

/** 发布流程钩子：扁平 `AfterReleaseHook` 或带 `run` 的 `LifecycleHook` */
export type PublisherHook = AfterReleaseHook | LifecycleHook;

function hookFromRun(run: HookCommand): AfterReleaseHook {
  switch (run.type) {
    case 'script':
      return { type: 'script', script: run.script };
    case 'package':
      return { type: 'package', name: run.name, args: run.args };
    default:
      return { type: 'command', command: run.command };
  }
}

function notifyToHook(
  notify: NonNullable<LifecycleHook['notify']>,
): AfterReleaseHook {
  if (notify.type === 'discord') {
    return {
      type: 'discord',
      webhookUrl: notify.webhookUrl,
      discordMessage: notify.message,
    };
  }
  return {
    type: 'slack',
    webhookUrl: notify.webhookUrl,
    channel: notify.channel,
    message: notify.message,
  };
}

function webhookToHook(
  webhook: NonNullable<LifecycleHook['webhook']>,
): AfterReleaseHook {
  return {
    type: 'webhook',
    url: webhook.url,
    method: webhook.method,
    headers: webhook.headers,
    body: webhook.body,
  };
}

/**
 * 将 LifecycleHook（run + 可选 webhook/notify）展开为顺序执行的扁平钩子列表。
 * 已是扁平格式的钩子原样保留。
 */
export function expandPublisherHook(hook: PublisherHook): AfterReleaseHook[] {
  const lifecycle = hook as LifecycleHook;
  const flat = hook as AfterReleaseHook;
  const steps: AfterReleaseHook[] = [];

  if (lifecycle.run) {
    steps.push(hookFromRun(lifecycle.run));
    if (lifecycle.webhook) {
      steps.push(webhookToHook(lifecycle.webhook));
    }
    if (lifecycle.notify) {
      steps.push(notifyToHook(lifecycle.notify));
    }
    return steps;
  }

  if (flat.webhook) {
    steps.push(webhookToHook(flat.webhook));
  }
  if (flat.notify) {
    steps.push(notifyToHook(flat.notify));
  }

  if (steps.length > 0) {
    const primary: AfterReleaseHook = { ...flat };
    delete (primary as { webhook?: unknown }).webhook;
    delete (primary as { notify?: unknown }).notify;
    if (primary.type || primary.run || primary.command || primary.script || primary.name) {
      return [primary, ...steps];
    }
    return steps;
  }

  return [flat];
}

export function expandPublisherHooks(hooks: PublisherHook[]): AfterReleaseHook[] {
  return hooks.flatMap(expandPublisherHook);
}
