import { resolveSafetyLevel, type HeadlessApprovalRule, type SafetyLevel } from "./config.ts";

export class SafetyBlockedError extends Error {}

export interface MutationContext {
  hasUI?: boolean;
  ui?: {
    confirm(title: string, message: string): Promise<boolean>;
  };
}

export interface MutationApprovalRequest {
  title: string;
  message: string;
  action?: string;
  spaceKey?: string;
  pageIds?: string[];
}

function matchesHeadlessApproval(rule: HeadlessApprovalRule, request: MutationApprovalRequest): boolean {
  if (rule.action !== request.action) return false;
  if (rule.spaceKey !== undefined && rule.spaceKey !== request.spaceKey) return false;
  if (rule.pageIds !== undefined && !request.pageIds?.every((id) => rule.pageIds!.includes(id))) return false;
  return true;
}

export async function guardMutation(
  config: { safetyLevel: SafetyLevel },
  site: { name: string; safetyLevel?: SafetyLevel; headlessApprovals?: HeadlessApprovalRule[] },
  ctx: MutationContext | undefined,
  request: MutationApprovalRequest,
): Promise<void> {
  const level = resolveSafetyLevel(config, site);

  if (level === "readonly") {
    throw new SafetyBlockedError(`Blocked: safetyLevel is "readonly" for site "${site.name}". ${request.title} was not performed.`);
  }

  if (level === "open") return;

  if (!ctx?.hasUI) {
    if (request.action && site.headlessApprovals?.some((rule) => matchesHeadlessApproval(rule, request))) return;
    throw new SafetyBlockedError(
      `Blocked: safetyLevel is "confirm" but no UI is available to prompt for approval in this run mode. ` +
        `Add a matching headlessApprovals rule or set safetyLevel to "open" for site "${site.name}" to allow unattended writes.`,
    );
  }

  const approved = await ctx.ui!.confirm(request.title, request.message);
  if (!approved) {
    throw new SafetyBlockedError(`Blocked by user: ${request.title}.`);
  }
}
