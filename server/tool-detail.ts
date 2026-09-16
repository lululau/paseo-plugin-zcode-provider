import type { ProviderToolCallDetail } from "@getpaseo/plugin/server/provider";
import { jsonValue, record } from "./mapping.js";

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export interface TodoWriteEntry {
  text: string;
  completed: boolean;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

const TODO_STATUSES = ["pending", "in_progress", "completed"] as const;

function normalizeToolName(name: string): string {
  return name
    .trim()
    .replace(/[.\s-]+/g, "_")
    .toLowerCase();
}

export function isTodoWriteTool(name: string): boolean {
  const normalized = normalizeToolName(name);
  return normalized === "todowrite" || normalized === "todo_write";
}

export function parseTodoWriteEntries(
  input: unknown,
): TodoWriteEntry[] | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const todos = rec.todos ?? rec.items;
  if (!Array.isArray(todos)) return undefined;
  const entries: TodoWriteEntry[] = [];
  for (const todo of todos) {
    if (todo === null || typeof todo !== "object") return undefined;
    const item = todo as Record<string, unknown>;
    const content = extractString(item.content);
    if (
      content === undefined ||
      !TODO_STATUSES.includes(item.status as (typeof TODO_STATUSES)[number])
    ) {
      return undefined;
    }
    const status = item.status as (typeof TODO_STATUSES)[number];
    const activeForm = extractString(item.activeForm);
    entries.push({
      text: content,
      completed: status === "completed",
      status,
      ...(activeForm !== undefined ? { activeForm } : {}),
    });
  }
  return entries;
}

function extractNumber(value: unknown): number | undefined {
  return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}

function extractTextOutput(output: unknown): string | undefined {
  if (typeof output === "string") return output;
  if (output === null || output === undefined) return undefined;
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.output === "string") return obj.output;
    if (typeof obj.stdout === "string") return obj.stdout;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.result === "string") return obj.result;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;
  }
  return undefined;
}

function extractExitCode(output: unknown): number | null | undefined {
  if (output === null || output === undefined) return undefined;
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    // Check perf.detail.command.exitCode
    const perf = record(obj.perf);
    const detail = record(perf.detail);
    const command = record(detail.command);
    if (typeof command.exitCode === "number") return command.exitCode;

    if (typeof obj.exitCode === "number") return obj.exitCode;
    if (typeof obj.exit_code === "number") return obj.exit_code;
    if (obj.success === true) return 0;
    if (obj.success === false) return 1;
  }
  return undefined;
}

function parseShellDetail(
  input: unknown,
  output: unknown,
): ProviderToolCallDetail | undefined {
  let command: string | undefined;
  let cwd: string | undefined;

  if (typeof input === "string") {
    command = input;
  } else if (input !== null && typeof input === "object") {
    const rec = input as Record<string, unknown>;
    command =
      extractString(rec.command) ??
      extractString(rec.cmd) ??
      extractString(rec.script);
    cwd =
      extractString(rec.cwd) ??
      extractString(rec.workingDir) ??
      extractString(rec.working_dir) ??
      extractString(rec.workingDirectory);
  }

  if (command === undefined) return undefined;

  const outputText = extractTextOutput(output);
  const exitCode = extractExitCode(output);

  return {
    type: "shell",
    command,
    ...(cwd !== undefined ? { cwd } : {}),
    ...(outputText !== undefined ? { output: outputText } : {}),
    ...(exitCode !== undefined ? { exitCode } : {}),
  };
}

function parseReadDetail(
  input: unknown,
  output: unknown,
): ProviderToolCallDetail | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const filePath =
    extractString(rec.path) ??
    extractString(rec.file_path) ??
    extractString(rec.filePath) ??
    extractString(rec.file) ??
    extractString(rec.filename) ??
    extractString(rec.AbsolutePath) ??
    extractString(rec.targetFile);

  if (!filePath) return undefined;

  const offset =
    extractNumber(rec.offset) ??
    extractNumber(rec.start_line) ??
    extractNumber(rec.startLine) ??
    extractNumber(rec.StartLine);
  const limit =
    extractNumber(rec.limit) ??
    extractNumber(rec.end_line) ??
    extractNumber(rec.endLine) ??
    extractNumber(rec.EndLine);
  const content = extractTextOutput(output);

  return {
    type: "read",
    filePath,
    ...(offset !== undefined ? { offset } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(content !== undefined ? { content } : {}),
  };
}

function parseEditDetail(
  input: unknown,
  _output: unknown,
): ProviderToolCallDetail | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const filePath =
    extractString(rec.path) ??
    extractString(rec.file_path) ??
    extractString(rec.filePath) ??
    extractString(rec.file) ??
    extractString(rec.filename) ??
    extractString(rec.TargetFile) ??
    extractString(rec.targetFile);

  if (!filePath) return undefined;

  const oldString =
    extractString(rec.old_string) ??
    extractString(rec.oldString) ??
    extractString(rec.old_str) ??
    extractString(rec.oldStr) ??
    extractString(rec.TargetContent) ??
    extractString(rec.targetContent);
  const newString =
    extractString(rec.new_string) ??
    extractString(rec.newString) ??
    extractString(rec.new_str) ??
    extractString(rec.newStr) ??
    extractString(rec.ReplacementContent) ??
    extractString(rec.replacementContent);
  const unifiedDiff =
    extractString(rec.unifiedDiff) ??
    extractString(rec.diff) ??
    extractString(rec.patch);

  return {
    type: "edit",
    filePath,
    ...(oldString !== undefined ? { oldString } : {}),
    ...(newString !== undefined ? { newString } : {}),
    ...(unifiedDiff !== undefined ? { unifiedDiff } : {}),
  };
}

function parseWriteDetail(
  input: unknown,
  _output: unknown,
): ProviderToolCallDetail | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const filePath =
    extractString(rec.path) ??
    extractString(rec.file_path) ??
    extractString(rec.filePath) ??
    extractString(rec.file) ??
    extractString(rec.filename) ??
    extractString(rec.TargetFile) ??
    extractString(rec.targetFile);

  if (!filePath) return undefined;

  const content =
    extractString(rec.content) ??
    extractString(rec.CodeContent) ??
    extractString(rec.codeContent) ??
    extractString(rec.fileContent) ??
    extractString(rec.text);

  return {
    type: "write",
    filePath,
    ...(content !== undefined ? { content } : {}),
  };
}

function parseSearchDetail(
  name: string,
  input: unknown,
  output: unknown,
): ProviderToolCallDetail | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const query =
    extractString(rec.query) ??
    extractString(rec.Query) ??
    extractString(rec.pattern) ??
    extractString(rec.Pattern) ??
    extractString(rec.keyword);

  if (query === undefined) return undefined;

  let toolName: "search" | "grep" | "glob" | "web_search" = "search";
  const lower = name.toLowerCase();
  if (lower.includes("web") || lower === "websearch") {
    toolName = "web_search";
  } else if (lower.includes("grep")) {
    toolName = "grep";
  } else if (
    lower.includes("find_by_name") ||
    lower.includes("glob") ||
    lower.includes("list_dir")
  ) {
    toolName = "glob";
  }

  const content = extractTextOutput(output);
  let filePaths: string[] | undefined;
  let webResults: Array<{ title: string; url: string }> | undefined;

  if (output !== null && typeof output === "object") {
    const outRec = output as Record<string, unknown>;
    if (Array.isArray(outRec.filePaths)) {
      filePaths = outRec.filePaths.filter(
        (p): p is string => typeof p === "string",
      );
    } else if (Array.isArray(outRec.files)) {
      filePaths = outRec.files.filter(
        (p): p is string => typeof p === "string",
      );
    }
    if (Array.isArray(outRec.results) || Array.isArray(outRec.webResults)) {
      const arr = (outRec.results ?? outRec.webResults) as unknown[];
      const mapped = arr
        .map((item) => {
          if (item && typeof item === "object") {
            const i = item as Record<string, unknown>;
            if (typeof i.url === "string") {
              return {
                title: typeof i.title === "string" ? i.title : i.url,
                url: i.url,
              };
            }
          }
          return undefined;
        })
        .filter((i): i is { title: string; url: string } => i !== undefined);
      if (mapped.length > 0) webResults = mapped;
    }
  }

  return {
    type: "search",
    query,
    toolName,
    ...(content !== undefined ? { content } : {}),
    ...(filePaths !== undefined ? { filePaths } : {}),
    ...(webResults !== undefined ? { webResults } : {}),
  };
}

function parseFetchDetail(
  input: unknown,
  output: unknown,
): ProviderToolCallDetail | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const url =
    extractString(rec.url) ??
    extractString(rec.Url) ??
    extractString(rec.target_url) ??
    extractString(rec.targetUrl);

  if (!url) return undefined;

  const result = extractTextOutput(output);
  const prompt = extractString(rec.prompt) ?? extractString(rec.question);
  let code: number | undefined;
  if (output !== null && typeof output === "object") {
    const outRec = output as Record<string, unknown>;
    code = extractNumber(outRec.status) ?? extractNumber(outRec.code);
  }

  return {
    type: "fetch",
    url,
    ...(prompt !== undefined ? { prompt } : {}),
    ...(result !== undefined ? { result } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}

function parseSubAgentDetail(
  input: unknown,
  output: unknown,
): ProviderToolCallDetail | undefined {
  const rec =
    input !== null && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const subAgentType =
    extractString(rec.subagent_type) ??
    extractString(rec.subAgentType) ??
    extractString(rec.type);
  const description =
    extractString(rec.description) ??
    extractString(rec.prompt) ??
    extractString(rec.task);

  const outRec =
    output !== null && typeof output === "object"
      ? (output as Record<string, unknown>)
      : {};
  const childSessionId =
    extractString(outRec.child_session_id) ??
    extractString(outRec.childSessionId) ??
    extractString(outRec.sessionId);
  const log =
    extractTextOutput(output) ??
    (output ? JSON.stringify(output, null, 2) : "");

  return {
    type: "sub_agent",
    log,
    ...(subAgentType !== undefined ? { subAgentType } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(childSessionId !== undefined ? { childSessionId } : {}),
  };
}

export function mapToolDetail(
  name: string,
  input: unknown,
  output: unknown,
): ProviderToolCallDetail {
  const lower = name.toLowerCase();

  try {
    // 1. Shell / Bash execution
    if (
      lower === "bash" ||
      lower === "terminal" ||
      lower === "execute_command" ||
      lower === "run_command" ||
      lower === "shell"
    ) {
      const shellDetail = parseShellDetail(input, output);
      if (shellDetail) return shellDetail;
    }

    // 2. Read file
    if (
      lower === "read" ||
      lower === "read_file" ||
      lower === "readfile" ||
      lower === "read_file_content" ||
      lower === "view_file" ||
      lower === "cat"
    ) {
      const readDetail = parseReadDetail(input, output);
      if (readDetail) return readDetail;
    }

    // 3. Edit file
    if (
      lower === "edit" ||
      lower === "edit_file" ||
      lower === "editfile" ||
      lower === "replace_file_content" ||
      lower === "str_replace_editor" ||
      lower === "patch"
    ) {
      const editDetail = parseEditDetail(input, output);
      if (editDetail) return editDetail;
    }

    // 4. Write / Create file
    if (
      lower === "write" ||
      lower === "write_file" ||
      lower === "writefile" ||
      lower === "write_to_file" ||
      lower === "create_file" ||
      lower === "save_file"
    ) {
      const writeDetail = parseWriteDetail(input, output);
      if (writeDetail) return writeDetail;
    }

    // 5. Search / WebSearch / Grep / Glob
    if (
      lower === "websearch" ||
      lower.includes("search_web") ||
      lower.includes("grep") ||
      lower.includes("find_by_name") ||
      lower === "search" ||
      lower === "glob"
    ) {
      const searchDetail = parseSearchDetail(name, input, output);
      if (searchDetail) return searchDetail;
    }

    // 6. Fetch / WebFetch / Read URL
    if (
      lower === "webfetch" ||
      lower === "fetch" ||
      lower === "read_url_content" ||
      lower === "http_request" ||
      lower.includes("web_reader") ||
      lower.includes("webreader")
    ) {
      const fetchDetail = parseFetchDetail(input, output);
      if (fetchDetail) return fetchDetail;
    }

    // 7. SubAgent (Agent)
    if (
      lower === "agent" ||
      lower === "subagent" ||
      lower === "invoke_subagent"
    ) {
      const subAgentDetail = parseSubAgentDetail(input, output);
      if (subAgentDetail) return subAgentDetail;
    }

    // 8. Plan Mode (ExitPlanMode / EnterPlanMode)
    if (lower === "exitplanmode") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const plan = extractString(rec.plan);
      if (plan) return { type: "plan", text: plan };
    }
    if (lower === "enterplanmode") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      return {
        type: "plain_text",
        icon: "brain",
        label: "Enter Plan Mode",
        text: extractString(rec.reason) ?? "Entering plan mode...",
      };
    }

    // 9. Skill
    if (lower === "skill") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const skillName =
        extractString(rec.name) ??
        extractString(rec.skill) ??
        extractString(rec.skill_name);
      const prompt =
        extractString(rec.prompt) ??
        extractString(rec.arguments) ??
        (rec.args ? JSON.stringify(rec.args) : undefined);
      return {
        type: "plain_text",
        icon: "sparkles",
        label: skillName ? `Skill: ${skillName}` : "Skill",
        ...(prompt !== undefined ? { text: prompt } : {}),
      };
    }

    // 10. SendMessage
    if (lower === "sendmessage") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const to =
        extractString(rec.to) ??
        extractString(rec.recipient) ??
        extractString(rec.subagent_id);
      const message =
        extractString(rec.message) ??
        extractString(rec.content) ??
        extractString(rec.text);
      return {
        type: "plain_text",
        icon: "bot",
        label: to ? `Message to Agent (${to})` : "Message to SubAgent",
        ...(message !== undefined ? { text: message } : {}),
      };
    }

    // 11. TodoWrite / TodoRead
    if (lower === "todowrite" || lower === "todoread") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const todos = rec.todos ?? rec.items;
      const text =
        typeof todos === "string"
          ? todos
          : todos
            ? JSON.stringify(todos, null, 2)
            : extractTextOutput(output);
      return {
        type: "plain_text",
        icon: "sparkles",
        label: lower === "todowrite" ? "Update Todo List" : "Read Todo List",
        ...(text !== undefined ? { text } : {}),
      };
    }

    // 12. TaskOutput / TaskStop
    if (lower === "taskoutput" || lower === "taskstop") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const taskId =
        extractString(rec.task_id) ??
        extractString(rec.taskId) ??
        extractString(rec.id);
      const text = extractTextOutput(output);
      return {
        type: "plain_text",
        icon: "square_terminal",
        label:
          lower === "taskstop"
            ? `Stop Task ${taskId ? `(${taskId})` : ""}`.trim()
            : `Task Output ${taskId ? `(${taskId})` : ""}`.trim(),
        ...(text !== undefined ? { text } : {}),
      };
    }

    // 13. AskUserQuestion
    if (lower === "askuserquestion") {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const question = extractString(rec.question) ?? extractString(rec.prompt);
      return {
        type: "plain_text",
        icon: "mic_vocal",
        label: "Ask Question",
        ...(question !== undefined ? { text: question } : {}),
      };
    }

    // 14. Cron & OffPeak Automation
    if (lower.startsWith("cron") || lower.startsWith("offpeak")) {
      const rec =
        input !== null && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      const schedule =
        extractString(rec.cron) ??
        extractString(rec.schedule) ??
        extractString(rec.cron_expression);
      const task =
        extractString(rec.prompt) ??
        extractString(rec.command) ??
        extractString(rec.task);
      const summary = [schedule, task].filter(Boolean).join(" - ");
      return {
        type: "plain_text",
        icon: lower.startsWith("cron") ? "wrench" : "square_terminal",
        label: name,
        ...(summary ? { text: summary } : {}),
      };
    }
  } catch {
    // Fallback to unknown on parsing error
  }

  return {
    type: "unknown",
    input: jsonValue(input ?? null),
    output: jsonValue(output ?? null),
  };
}
