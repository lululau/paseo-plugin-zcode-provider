import { expect, it } from "vitest";
import { rowTimeline } from "./presentation.js";
import { toolDetail } from "./tool-detail.js";

const toolRow = (
  toolName: string,
  input: unknown,
  output: Record<string, unknown> = { text: "" },
  status = "success",
): any => ({
  rowId: 1,
  turnId: "p",
  productTurnId: "p",
  entityId: "t",
  createdAt: 1,
  createdAtSeq: 1,
  kind: "toolCall",
  toolCallId: "t",
  toolName,
  status,
  inputText: "",
  input,
  output,
});

it.each([
  [
    "Read",
    { file_path: "/w/a.ts", offset: 10, limit: 20 },
    "body",
    {
      type: "read",
      filePath: "/w/a.ts",
      content: "body",
      offset: 10,
      limit: 20,
    },
  ],
  [
    "Grep",
    { pattern: "foo", path: "/w", output_mode: "files_with_matches" },
    "Found 2 files\n/w/a.ts\n/w/b.ts",
    {
      type: "search",
      toolName: "grep",
      query: "foo",
      mode: "files_with_matches",
      filePaths: ["/w/a.ts", "/w/b.ts"],
    },
  ],
  [
    "Glob",
    { pattern: "**/*.el", path: "/w" },
    "No files found",
    { type: "search", toolName: "glob", query: "**/*.el", filePaths: [] },
  ],
  [
    "WebSearch",
    { query: "go 1.13" },
    "Web search results",
    { type: "search", toolName: "web_search", query: "go 1.13" },
  ],
  [
    "WebFetch",
    { url: "https://example.com", prompt: "summarize" },
    "# Summary",
    {
      type: "fetch",
      url: "https://example.com",
      prompt: "summarize",
      result: "# Summary",
    },
  ],
  [
    "Agent",
    { description: "review", prompt: "p", subagent_type: "reviewer" },
    "Approved",
    {
      type: "sub_agent",
      subAgentType: "reviewer",
      description: "review",
      log: "Approved",
    },
  ],
  ["ExitPlanMode", { plan: "# Plan" }, "", { type: "plan", text: "# Plan" }],
  [
    "Skill",
    { skill: "agentsview", args: "tmux" },
    "<skill_content>",
    {
      type: "plain_text",
      label: "Skill: agentsview",
      icon: "sparkles",
      text: "tmux",
    },
  ],
  [
    "SendMessage",
    { to: "lead", message: "done", summary: "s" },
    "",
    { type: "plain_text", label: "Message to lead", icon: "bot", text: "done" },
  ],
  [
    "AskUserQuestion",
    { questions: [{ question: "Which?", header: "h", options: [] }] },
    "User answered: A",
    {
      type: "plain_text",
      icon: "mic_vocal",
      text: "Which?\n\nUser answered: A",
    },
  ],
  [
    "CronCreate",
    { prompt: "daily report" },
    "",
    {
      type: "plain_text",
      label: "CronCreate",
      icon: "wrench",
      text: "daily report",
    },
  ],
])("maps ZCode %s input to Paseo detail", (name, input, text, expected) => {
  expect(toolDetail(name, input, text)).toMatchObject(expected);
});

it("keeps unrecognised tools and mismatched inputs generic", () => {
  expect(toolDetail("mcp__paseo__list_providers", {}, "x")).toBeUndefined();
  expect(toolDetail("Grep", { query: "wrong field" }, "x")).toBeUndefined();
  expect(rowTimeline(toolRow("mcp__x__y", { a: 1 }))).toMatchObject({
    detail: { type: "unknown", input: { a: 1 } },
  });
});

it("renders an Edit file_diff display as a unified diff", () => {
  const item = rowTimeline(
    toolRow(
      "Edit",
      { file_path: "/w/a.ts", old_string: "a", new_string: "b" },
      {
        text: "ok",
        display: {
          kind: "file_diff",
          filePath: "/w/a.ts",
          additions: 1,
          deletions: 1,
          structuredPatch: [
            {
              oldStart: 3,
              oldLines: 1,
              newStart: 3,
              newLines: 1,
              lines: ["-a", "+b"],
            },
          ],
        },
      },
    ),
  );
  expect(item).toMatchObject({
    detail: {
      type: "edit",
      oldString: "a",
      newString: "b",
      unifiedDiff: "--- /w/a.ts\n+++ /w/a.ts\n@@ -3,1 +3,1 @@\n-a\n+b",
    },
  });
});

it("uses the background task display for TaskOutput and TaskStop", () => {
  expect(
    toolDetail("TaskOutput", { task_id: "x" }, "<raw/>", {
      kind: "task_output",
      retrievalStatus: "success",
      output: "exit 255",
    }),
  ).toMatchObject({ icon: "square_terminal", text: "exit 255" });
  expect(
    toolDetail("TaskStop", { task_id: "x" }, "<raw/>", {
      kind: "task_stop",
      taskId: "x",
      taskType: "local_bash",
      message: "stopped",
    }),
  ).toMatchObject({ icon: "square_terminal", text: "stopped" });
});

it("leaves successful TodoWrite to the native todo list but shows failures", () => {
  const input = {
    todos: [{ content: "a", status: "pending", priority: "high" }],
  };
  expect(rowTimeline(toolRow("TodoWrite", input))).toBeUndefined();
  expect(
    rowTimeline(toolRow("TodoWrite", input, { text: "" }, "running")),
  ).toBeUndefined();
  expect(
    rowTimeline(toolRow("TodoWrite", input, { text: "" }, "error")),
  ).toMatchObject({ type: "tool_call", status: "failed" });
});
