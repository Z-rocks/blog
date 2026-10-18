import type { WorkDetail } from "../../types";
import { campusAssistant } from "./campus-assistant";
import { mechCrowdsourcing } from "./mech-crowdsourcing";
import { quoteAgentRag } from "./quote-agent-rag";
import { rmSentryVision } from "./rm-sentry-vision";

/**
 * 显式注册表：新增案例就加一行，漏写时 vue-tsc 会直接报错，
 * 比 import.meta.glob 拿到的 unknown 再断言可靠。
 */
export const works: Record<string, WorkDetail> = {
  [campusAssistant.id]: campusAssistant,
  [mechCrowdsourcing.id]: mechCrowdsourcing,
  [quoteAgentRag.id]: quoteAgentRag,
  [rmSentryVision.id]: rmSentryVision,
};

export function getWork(id: string): WorkDetail | undefined {
  return Object.prototype.hasOwnProperty.call(works, id) ? works[id] : undefined;
}
