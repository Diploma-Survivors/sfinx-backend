import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

/** Placeholder that must appear exactly once in every harness template */
const USER_CODE_PLACEHOLDER = '// {{USER_CODE}}';

/**
 * Service responsible for injecting user source code into harness templates.
 * Also performs language-specific code transformations required so the
 * harness can call the user's logic in a loop (e.g. renaming main → userSolve).
 */
@Injectable()
export class HarnessInjectorService {
  private readonly logger = new Logger(HarnessInjectorService.name);

  /**
   * Inject user code into the harness template.
   *
   * @param harnessTemplate - Template string containing USER_CODE_PLACEHOLDER
   * @param userCode        - Raw source code submitted by the user
   * @param languageSlug    - Slug from the ProgrammingLanguage entity (e.g. "cpp", "java")
   * @returns Combined source code ready to send to Judge0
   */
  inject(
    harnessTemplate: string | null | undefined,
    userCode: string,
    languageSlug: string,
  ): string {
    if (!harnessTemplate) {
      throw new BadRequestException(
        `Language '${languageSlug}' does not have a harness template. Batched submission is not supported for this language.`,
      );
    }

    if (!harnessTemplate.includes(USER_CODE_PLACEHOLDER)) {
      throw new InternalServerErrorException(
        `Harness for '${languageSlug}' is missing the required placeholder '${USER_CODE_PLACEHOLDER}'.`,
      );
    }

    const transformedCode = this.transformUserCode(userCode, languageSlug);
    const result = harnessTemplate.replace(
      USER_CODE_PLACEHOLDER,
      transformedCode,
    );

    this.logger.debug(
      `Injected user code into harness for '${languageSlug}' (user: ${userCode.length}B → combined: ${result.length}B)`,
    );

    return result;
  }

  // ─── Language-specific user code transformations ───────────────────────────

  /**
   * Transform user code so it can be called by the harness loop instead of
   * running as a standalone program. Returns code unchanged for languages that
   * don't require transformation (Python, JS, etc.).
   */
  private transformUserCode(code: string, slug: string): string {
    switch (slug) {
      // Java: rename public class Main → class Solution
      //       rename public static void main( → public static void solve(
      case 'java':
        return code
          .replace(/\bpublic\s+class\s+Main\b/g, 'class Solution')
          .replace(
            /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*\w+\s*\)/g,
            'public static void solve()',
          );

      // C#: rename static void Main( → static void UserSolve()
      //     Rename the user's class (Program, Solution, or any name) → UserSolution
      //     Strip duplicate using System* directives — harness already provides them
      case 'csharp':
        return code
          .replace(/^using\s+System(?:\.\w+)*\s*;\s*\n?/gm, '')
          .replace(/\bclass\s+\w+\b/g, 'class UserSolution')
          .replace(
            /\b(?:public\s+)?static\s+void\s+Main\s*\(/g,
            'public static void UserSolve(',
          );

      // Go: strip package declaration and all import blocks, then rename main
      // (harness already has package main + a comprehensive import block)
      case 'go':
        return code
          .replace(/^\s*package\s+\w+\s*\n/m, '')
          .replace(/\bimport\s+\([\s\S]*?\)\s*/g, '')
          .replace(/\bimport\s+"[^"]+"\s*/g, '')
          .replace(/\bfunc\s+main\s*\(\s*\)/g, 'func userSolve()');

      // Kotlin: rename fun main( → fun userSolve(
      case 'kotlin':
        return code.replace(/\bfun\s+main\s*\(/g, 'fun userSolve(');

      // Rust: rename fn main() → fn user_solve()
      //       Strip `use std::io...` imports — harness already imports all needed io items
      case 'rust':
        return code
          .replace(/^use\s+std::io\s*(?:::[^;]*)?\s*;\s*\n?/gm, '')
          .replace(/\bfn\s+main\s*\(\s*\)/g, 'fn user_solve()');

      // PHP: wrap code so it can be eval'd per testcase
      // No structural rename needed; harness uses eval()
      case 'php':
        return code;

      default:
        // Python, JS, TS, C, C++ (via #define), Ruby: no rename needed
        return code;
    }
  }
}
