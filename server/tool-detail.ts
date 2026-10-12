import type { ProviderToolCallDetail } from "@getpaseo/plugin/server/provider";
import type { ToolCallRow } from "./vendor/zcode/packages/shared/src/zcode-protocol-v4/rows.js";
import { record } from "./mapping.js";

type Display = NonNullable<ToolCallRow["output"]>["display"];
type PlainTextIcon = Extract<
  ProviderToolCallDetail,
  { type: "plain_text" }
>["icon"];

// Field names are ZCode's built-in tool input schemas. A tool whose input does
// not match returns undefined and keeps the generic presentation.
export function toolDetail(
  name: string,
  rawInput: unknown,
  text: string,
  display?: Display,
): ProviderToolCallDetail | undefined {
  const input = record(rawInput);
  const s = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : undefined;
  const n = (key: string) =>
    typeof input[key] === "number" ? (input[key] as number) : undefined;
  const filePath = s("file_path");
  switch (name) {
    case "Bash": {
      const command = s("command");
      return command === undefined
        ? undefined
        : { type: "shell", command, output: text };
    }
    case "Read":
      return filePath === undefined
        ? undefined
        : {
            type: "read",
            filePath,
            content: text,
            ...optional("offset", n("offset")),
            ...optional("limit", n("limit")),
          };
    case "Write":
      return filePath === undefined
        ? undefined
        : { type: "write", filePath, ...optional("content", s("content")) };
    case "Edit":
      return filePath === undefined
        ? undefined
        : {
            type: "edit",
            filePath,
            ...optional("oldString", s("old_string")),
            ...optional("newString", s("new_string")),
            ...optional(
              "unifiedDiff",
              display?.kind === "file_diff" ? unifiedDiff(display) : undefined,
            ),
          };
    case "Grep": {
      const pattern = s("pattern");
      if (pattern === undefined) return;
      const mode = s("output_mode");
      const knownMode = (
        ["content", "files_with_matches", "count"] as const
      ).find((m) => m === mode);
      return {
        type: "search",
        toolName: "grep",
        query: pattern,
        content: text,
        ...optional("mode", knownMode),
        ...(knownMode === "files_with_matches"
          ? { filePaths: absolutePaths(text) }
          : {}),
      };
    }
    case "Glob": {
      const pattern = s("pattern");
      return pattern === undefined
        ? undefined
        : {
            type: "search",
            toolName: "glob",
            query: pattern,
            content: text,
            filePaths: absolutePaths(text),
          };
    }
    case "WebSearch":
    case "web_search": {
      const query = s("query");
      return query === undefined
        ? undefined
        : { type: "search", toolName: "web_search", query, content: text };
    }
    case "WebFetch": {
      const url = s("url");
      return url === undefined
        ? undefined
        : {
            type: "fetch",
            url,
            ...optional("prompt", s("prompt")),
            result: text,
          };
    }
    case "Agent":
      return {
        type: "sub_agent",
        ...optional("subAgentType", s("subagent_type")),
        ...optional("description", s("description")),
        log: text,
      };
    case "ExitPlanMode": {
      const plan = s("plan");
      return plan === undefined ? undefined : { type: "plan", text: plan };
    }
    case "EnterPlanMode":
      return plain("Enter plan mode", "brain", text);
    case "Skill": {
      const skill = s("skill") ?? s("name");
      return skill === undefined
        ? undefined
        : plain(`Skill: ${skill}`, "sparkles", s("args"));
    }
    case "TodoRead":
      return plain("Read todo list", "eye", text);
    case "TaskOutput":
      return plain(
        "Background task output",
        "square_terminal",
        display?.kind === "task_output" ? (display.output ?? text) : text,
      );
    case "TaskStop":
      return plain(
        "Stop background task",
        "square_terminal",
        display?.kind === "task_stop" ? display.message : text,
      );
    case "SendMessage": {
      const to = s("to");
      return plain(
        to ? `Message to ${to}` : "Send message",
        "bot",
        s("message") ?? text,
      );
    }
    case "AskUserQuestion": {
      const questions = Array.isArray(input.questions)
        ? input.questions.flatMap((q) => {
            const question = record(q).question;
            return typeof question === "string" ? [question] : [];
          })
        : [];
      return plain(
        "Ask user",
        "mic_vocal",
        [...questions, text].filter(Boolean).join("\n\n"),
      );
    }
  }
  if (/^(Cron|OffPeak)[A-Z]/u.test(name))
    return plain(name, "wrench", s("prompt") ?? s("title") ?? text);
  return;
}

function plain(
  label: string,
  icon: PlainTextIcon,
  text?: string,
): ProviderToolCallDetail {
  return {
    type: "plain_text",
    label,
    icon,
    ...optional("text", text || undefined),
  };
}

function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

function absolutePaths(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(line));
}

function unifiedDiff(
  display: Extract<Display, { kind: "file_diff" }>,
): string | undefined {
  if (display.structuredPatch.length === 0) return;
  return [
    `--- ${display.filePath}`,
    `+++ ${display.filePath}`,
    ...display.structuredPatch.flatMap((hunk) => [
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      ...hunk.lines,
    ]),
  ].join("\n");
}
