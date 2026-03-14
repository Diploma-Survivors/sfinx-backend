import { Injectable } from '@nestjs/common';

export interface HarnessTestResult {
  status: 'AC' | 'WA' | 'RE';
  timeMs: number;
  stdout: string;
  /** Empty string for AC testcases */
  input: string;
  /** Empty string for AC testcases */
  expected: string;
}

/**
 * Protocol (byte-count prefix):
 *
 * STDIN (BE → harness):
 *   N\n
 *   input_byte_len\n <input_bytes>
 *   expected_byte_len\n <expected_bytes>
 *   ... (repeated N times, no separator between data and next length line)
 *
 * STDOUT (harness → BE):
 *   M\n                         (M ≤ N, harness stops on first WA/RE)
 *   STATUS\n                    (AC | WA | RE)
 *   time_ms\n
 *   stdout_byte_len\n <stdout_bytes>
 *   input_byte_len\n <input_bytes>    (0\n for AC)
 *   expected_byte_len\n <expected_bytes>  (0\n for AC)
 *   ... (repeated M times)
 */
@Injectable()
export class PackedProtocolService {
  /** Sentinel value sent as expected output when there is no expected output (test run) */
  static readonly NO_CHECK_SENTINEL = '__NOCHECK__';

  /**
   * Encode testcases into packed stdin and return as base64 string
   * (ready to pass directly as Judge0 stdin field)
   */
  encodeStdinBase64(
    testcases: Array<{ input: string; expectedOutput: string }>,
  ): string {
    return this.buildStdinBuffer(testcases).toString('base64');
  }

  /**
   * Decode Judge0 base64-encoded stdout into per-testcase results
   */
  decodeStdoutBase64(base64Stdout: string): HarnessTestResult[] {
    const buf = Buffer.from(base64Stdout, 'base64');
    return this.parseStdoutBuffer(buf);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildStdinBuffer(
    testcases: Array<{ input: string; expectedOutput: string }>,
  ): Buffer {
    const parts: Buffer[] = [Buffer.from(`${testcases.length}\n`, 'ascii')];

    for (const tc of testcases) {
      const inBuf = Buffer.from(tc.input, 'utf-8');
      const expBuf = Buffer.from(tc.expectedOutput, 'utf-8');
      parts.push(Buffer.from(`${inBuf.length}\n`, 'ascii'), inBuf);
      parts.push(Buffer.from(`${expBuf.length}\n`, 'ascii'), expBuf);
    }

    return Buffer.concat(parts);
  }

  private parseStdoutBuffer(buf: Buffer): HarnessTestResult[] {
    let pos = 0;

    const readLine = (): string => {
      const nl = buf.indexOf('\n', pos);
      if (nl === -1)
        throw new Error(`Unexpected end of harness output at pos ${pos}`);
      const line = buf.subarray(pos, nl).toString('ascii').trim();
      pos = nl + 1;
      return line;
    };

    const readBlock = (): string => {
      const lenStr = readLine();
      const n = parseInt(lenStr, 10);
      if (isNaN(n) || n < 0)
        throw new Error(`Invalid block length: "${lenStr}"`);
      const data = buf.subarray(pos, pos + n).toString('utf-8');
      pos += n;
      return data;
    };

    const m = parseInt(readLine(), 10);
    if (isNaN(m) || m < 0) throw new Error('Invalid harness output: bad M');

    const results: HarnessTestResult[] = [];

    for (let i = 0; i < m; i++) {
      const statusStr = readLine();
      const status = this.parseStatus(statusStr);
      const timeMs = parseInt(readLine(), 10);
      const stdout = readBlock();
      const input = readBlock();
      const expected = readBlock();
      results.push({ status, timeMs, stdout, input, expected });
    }

    return results;
  }

  private parseStatus(s: string): 'AC' | 'WA' | 'RE' {
    if (s === 'AC' || s === 'WA' || s === 'RE') return s;
    // Treat unknown harness status as RE
    return 'RE';
  }
}
