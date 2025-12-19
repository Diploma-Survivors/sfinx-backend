export interface ResultDescription {
  message: string;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  stderr?: string;
  compileOutput?: string;
}
