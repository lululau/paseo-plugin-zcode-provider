import type { ProviderToolCallDetail } from "@getpaseo/plugin/server/provider";
import { jsonValue, record } from "./mapping.js";

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
    extractString(rec.filePath) ??
    extractString(rec.path) ??
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
    extractString(rec.filePath) ??
    extractString(rec.path) ??
    extractString(rec.file) ??
    extractString(rec.filename) ??
    extractString(rec.TargetFile) ??
    extractString(rec.targetFile);

  if (!filePath) return undefined;

  const oldString =
    extractString(rec.oldString) ??
    extractString(rec.old_str) ??
    extractString(rec.oldStr) ??
    extractString(rec.TargetContent) ??
    extractString(rec.targetContent);
  const newString =
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
    extractString(rec.filePath) ??
    extractString(rec.path) ??
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
  if (lower.includes("grep")) toolName = "grep";
  else if (
    lower.includes("find_by_name") ||
    lower.includes("glob") ||
    lower.includes("list_dir")
  ) {
    toolName = "glob";
  } else if (lower.includes("web") || lower.includes("search_web")) {
    toolName = "web_search";
  }

  const content = extractTextOutput(output);
  let filePaths: string[] | undefined;
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
  }

  return {
    type: "search",
    query,
    toolName,
    ...(content !== undefined ? { content } : {}),
    ...(filePaths !== undefined ? { filePaths } : {}),
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
    extractString(rec.targetUrl);

  if (!url) return undefined;

  const result = extractTextOutput(output);
  const prompt = extractString(rec.prompt);
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

    // 5. Search / Grep / Glob
    if (
      lower.includes("grep") ||
      lower.includes("find_by_name") ||
      lower.includes("search_web") ||
      lower === "search" ||
      lower === "glob"
    ) {
      const searchDetail = parseSearchDetail(name, input, output);
      if (searchDetail) return searchDetail;
    }

    // 6. Fetch / Read URL
    if (
      lower === "fetch" ||
      lower === "read_url_content" ||
      lower === "http_request"
    ) {
      const fetchDetail = parseFetchDetail(input, output);
      if (fetchDetail) return fetchDetail;
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
