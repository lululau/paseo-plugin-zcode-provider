import type { ProviderTimelineItem } from "@getpaseo/plugin/server/provider";
import type { NativeTimelineItem } from "./session-types.js";

export class TimelineSnapshots {
  boundary(): void {
    this.lastTextKey = undefined;
  }
  private sequence = 0;
  private readonly text = new Map<string, string>();
  private lastTextKey?: string;
  private lastTextId?: string;

  replay(item: NativeTimelineItem): ProviderTimelineItem {
    return {
      ...item,
      ...revertTokenOf(item),
      id: `history:${this.sequence++}`,
    } as ProviderTimelineItem;
  }

  live(item: NativeTimelineItem, turnId?: string): ProviderTimelineItem {
    if (item.type === "assistant_message" || item.type === "reasoning") {
      const key = JSON.stringify([
        turnId,
        item.type,
        item.type === "assistant_message" ? item.messageId : undefined,
      ]);
      if (key !== this.lastTextKey) {
        this.lastTextId = `live:${this.sequence++}`;
        this.lastTextKey = key;
      }
      const id = this.lastTextId!;
      const text = (this.text.get(id) ?? "") + item.text;
      this.text.set(id, text);
      return {
        ...item,
        ...revertTokenOf(item),
        id,
        text,
      } as ProviderTimelineItem;
    }
    // Tool boundaries delimit text without native message IDs; todo updates do not.
    if (item.type !== "todo") this.lastTextKey = undefined;
    return {
      ...item,
      ...revertTokenOf(item),
      id:
        item.type === "tool_call"
          ? `tool:${item.callId}`
          : item.type === "todo"
            ? "todos"
            : `live:${this.sequence++}`,
    } as ProviderTimelineItem;
  }
}

/**
 * ZCode can rewind to any native message; expose its messageId as the
 * Paseo revert token so the app renders "rewind to this message".
 */
function revertTokenOf(item: NativeTimelineItem): { revertToken: string } | {} {
  if (
    (item.type === "user_message" || item.type === "assistant_message") &&
    typeof item.messageId === "string"
  ) {
    return { revertToken: item.messageId };
  }
  return {};
}
