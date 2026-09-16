import { describe, expect, it } from "vitest";
import {
  isTodoWriteTool,
  mapToolDetail,
  parseTodoWriteEntries,
} from "./tool-detail.js";

describe("mapToolDetail", () => {
  it("maps bash tool with JSON input and complex output to shell detail", () => {
    const detail = mapToolDetail(
      "bash",
      {
        command:
          "export TMPDIR=$(getconf DARWIN_USER_TEMP_DIR); emacsclient -e 'test'",
        description: "run emacsclient",
      },
      {
        success: true,
        content: '("/path/to/tramp-rpc.elc")\n',
        perf: {
          totalMs: 231,
          detail: {
            kind: "command",
            command: {
              runMs: 227,
              exitCode: 0,
            },
          },
        },
        truncated: false,
      },
    );

    expect(detail).toEqual({
      type: "shell",
      command:
        "export TMPDIR=$(getconf DARWIN_USER_TEMP_DIR); emacsclient -e 'test'",
      output: '("/path/to/tramp-rpc.elc")\n',
      exitCode: 0,
    });
  });

  it("maps bash tool with string input and failed output", () => {
    const detail = mapToolDetail("bash", "git status", {
      success: false,
      error: "fatal: not a git repository",
      exitCode: 128,
    });

    expect(detail).toEqual({
      type: "shell",
      command: "git status",
      output: "fatal: not a git repository",
      exitCode: 128,
    });
  });

  it("maps file read tool (Read / view_file) to read detail", () => {
    const detail = mapToolDetail(
      "Read",
      {
        file_path: "/path/to/file.ts",
        offset: 1,
        limit: 50,
      },
      {
        content: "const a = 1;\nconst b = 2;\n",
      },
    );

    expect(detail).toEqual({
      type: "read",
      filePath: "/path/to/file.ts",
      offset: 1,
      limit: 50,
      content: "const a = 1;\nconst b = 2;\n",
    });
  });

  it("maps file edit tool (Edit) with old_string / new_string to edit detail", () => {
    const detail = mapToolDetail(
      "Edit",
      {
        path: "/src/index.ts",
        old_string: "const x = 1;",
        new_string: "const x = 2;",
      },
      "File edited successfully",
    );

    expect(detail).toEqual({
      type: "edit",
      filePath: "/src/index.ts",
      oldString: "const x = 1;",
      newString: "const x = 2;",
    });
  });

  it("maps file write tool (Write) to write detail", () => {
    const detail = mapToolDetail(
      "Write",
      {
        path: "/src/new.ts",
        content: "export const ok = true;\n",
      },
      "File created",
    );

    expect(detail).toEqual({
      type: "write",
      filePath: "/src/new.ts",
      content: "export const ok = true;\n",
    });
  });

  it("maps WebSearch tool to search detail", () => {
    const detail = mapToolDetail(
      "WebSearch",
      {
        query: "Paseo protocol",
      },
      {
        results: [{ title: "Paseo Home", url: "https://getpaseo.ai" }],
      },
    );

    expect(detail).toEqual({
      type: "search",
      query: "Paseo protocol",
      toolName: "web_search",
      webResults: [{ title: "Paseo Home", url: "https://getpaseo.ai" }],
    });
  });

  it("maps WebFetch and web reader tools to fetch detail", () => {
    const detail = mapToolDetail(
      "WebFetch",
      {
        url: "https://example.com",
        prompt: "Summarize the page",
      },
      {
        content: "# Example Domain\nThis domain is for use in examples.",
        status: 200,
      },
    );

    expect(detail).toEqual({
      type: "fetch",
      url: "https://example.com",
      prompt: "Summarize the page",
      result: "# Example Domain\nThis domain is for use in examples.",
      code: 200,
    });
  });

  it("maps Agent tool to sub_agent detail", () => {
    const detail = mapToolDetail(
      "Agent",
      {
        subagent_type: "Explore",
        description: "Search codebase for provider schemas",
      },
      {
        content: "Exploration completed",
        child_session_id: "child-123",
      },
    );

    expect(detail).toEqual({
      type: "sub_agent",
      subAgentType: "Explore",
      description: "Search codebase for provider schemas",
      childSessionId: "child-123",
      log: "Exploration completed",
    });
  });

  it("maps ExitPlanMode to plan detail", () => {
    const detail = mapToolDetail(
      "ExitPlanMode",
      {
        plan: "# My Implementation Plan\n- step 1\n- step 2",
      },
      null,
    );

    expect(detail).toEqual({
      type: "plan",
      text: "# My Implementation Plan\n- step 1\n- step 2",
    });
  });

  it("maps Skill tool to plain_text detail", () => {
    const detail = mapToolDetail(
      "Skill",
      {
        name: "wrap",
        prompt: "Commit and journal",
      },
      "Skill executed",
    );

    expect(detail).toEqual({
      type: "plain_text",
      icon: "sparkles",
      label: "Skill: wrap",
      text: "Commit and journal",
    });
  });

  it("maps SendMessage tool to plain_text detail", () => {
    const detail = mapToolDetail(
      "SendMessage",
      {
        to: "Explore",
        message: "Please inspect mapping.ts",
      },
      "Sent",
    );

    expect(detail).toEqual({
      type: "plain_text",
      icon: "bot",
      label: "Message to Agent (Explore)",
      text: "Please inspect mapping.ts",
    });
  });

  it("maps TodoWrite tool to plain_text detail", () => {
    const detail = mapToolDetail(
      "TodoWrite",
      {
        todos: [
          { content: "Task 1", status: "completed" },
          { content: "Task 2", status: "pending" },
        ],
      },
      "Updated",
    );

    expect(detail).toEqual({
      type: "plain_text",
      icon: "sparkles",
      label: "Update Todo List",
      text: JSON.stringify(
        [
          { content: "Task 1", status: "completed" },
          { content: "Task 2", status: "pending" },
        ],
        null,
        2,
      ),
    });
  });

  it("maps CronCreate tool to plain_text detail", () => {
    const detail = mapToolDetail(
      "CronCreate",
      {
        cron: "0 9 * * *",
        prompt: "Check daily status",
      },
      "Created",
    );

    expect(detail).toEqual({
      type: "plain_text",
      icon: "wrench",
      label: "CronCreate",
      text: "0 9 * * * - Check daily status",
    });
  });

  it("falls back to unknown for unrecognized tools", () => {
    const detail = mapToolDetail(
      "custom_unrecognized_tool",
      { foo: "bar" },
      { result: 123 },
    );

    expect(detail).toEqual({
      type: "unknown",
      input: { foo: "bar" },
      output: { result: 123 },
    });
  });
});

describe("parseTodoWriteEntries", () => {
  it("maps todos with status and activeForm", () => {
    expect(
      parseTodoWriteEntries({
        todos: [
          { content: "Task 1", status: "completed", activeForm: "Doing 1" },
          { content: "Task 2", status: "in_progress" },
          { content: "Task 3", status: "pending" },
        ],
      }),
    ).toEqual([
      {
        text: "Task 1",
        completed: true,
        status: "completed",
        activeForm: "Doing 1",
      },
      { text: "Task 2", completed: false, status: "in_progress" },
      { text: "Task 3", completed: false, status: "pending" },
    ]);
  });

  it("accepts an empty list and rejects malformed input", () => {
    expect(parseTodoWriteEntries({ todos: [] })).toEqual([]);
    expect(parseTodoWriteEntries({ todos: "not-an-array" })).toBeUndefined();
    expect(
      parseTodoWriteEntries({ items: [{ content: "Task" }] }),
    ).toBeUndefined();
    expect(
      parseTodoWriteEntries({ todos: [{ content: "Task", status: "future" }] }),
    ).toBeUndefined();
    expect(
      parseTodoWriteEntries({ todos: [{ status: "pending" }] }),
    ).toBeUndefined();
    expect(parseTodoWriteEntries(null)).toBeUndefined();
    expect(parseTodoWriteEntries("[]")).toBeUndefined();
  });
});

describe("isTodoWriteTool", () => {
  it("matches TodoWrite spellings across separators", () => {
    expect(isTodoWriteTool("TodoWrite")).toBe(true);
    expect(isTodoWriteTool("todowrite")).toBe(true);
    expect(isTodoWriteTool("todo.write")).toBe(true);
    expect(isTodoWriteTool("todo_write")).toBe(true);
    expect(isTodoWriteTool("TodoRead")).toBe(false);
  });
});
