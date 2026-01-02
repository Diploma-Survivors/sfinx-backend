import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResultDescription {
  @ApiProperty({
    description: 'Result description',
    example: 'Compilation error: missing semicolon',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Input used for the submission',
    example: '1 2 3',
  })
  input?: string;

  @ApiPropertyOptional({
    description: 'Expected output for the submission',
    example: '6',
  })
  expectedOutput?: string;

  @ApiPropertyOptional({
    description: 'Actual output produced by the submission',
    example: '5',
  })
  actualOutput?: string;

  @ApiPropertyOptional({
    description: 'Standard error output produced by the submission',
    example: 'Error: Division by zero',
  })
  stderr?: string;

  @ApiPropertyOptional({
    description: 'Compile output produced by the submission',
    example: 'Compiled successfully',
  })
  compileOutput?: string;
}
