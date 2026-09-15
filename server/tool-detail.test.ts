import { describe, expect, it } from "vitest";
import { mapToolDetail } from "./tool-detail.js";

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

  it("maps file read tool (view_file / read_file) to read detail", () => {
    const detail = mapToolDetail(
      "view_file",
      {
        AbsolutePath: "/path/to/file.ts",
        StartLine: 1,
        EndLine: 50,
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

  it("maps file edit tool (replace_file_content) to edit detail", () => {
    const detail = mapToolDetail(
      "replace_file_content",
      {
        TargetFile: "/src/index.ts",
        TargetContent: "const x = 1;",
        ReplacementContent: "const x = 2;",
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

  it("maps file write tool (write_to_file) to write detail", () => {
    const detail = mapToolDetail(
      "write_to_file",
      {
        TargetFile: "/src/new.ts",
        CodeContent: "export const ok = true;\n",
      },
      "File created",
    );

    expect(detail).toEqual({
      type: "write",
      filePath: "/src/new.ts",
      content: "export const ok = true;\n",
    });
  });

  it("maps search / grep tool to search detail", () => {
    const detail = mapToolDetail(
      "grep_search",
      {
        Query: "function test",
      },
      {
        content: "src/index.ts:1:function test() {}",
        filePaths: ["src/index.ts"],
      },
    );

    expect(detail).toEqual({
      type: "search",
      query: "function test",
      toolName: "grep",
      content: "src/index.ts:1:function test() {}",
      filePaths: ["src/index.ts"],
    });
  });

  it("maps fetch / read_url_content tool to fetch detail", () => {
    const detail = mapToolDetail(
      "read_url_content",
      {
        Url: "https://example.com",
      },
      {
        content: "# Example Domain\nThis domain is for use in examples.",
        status: 200,
      },
    );

    expect(detail).toEqual({
      type: "fetch",
      url: "https://example.com",
      result: "# Example Domain\nThis domain is for use in examples.",
      code: 200,
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
