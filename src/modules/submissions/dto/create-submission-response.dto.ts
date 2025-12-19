import { ApiProperty } from '@nestjs/swagger';

export class CreateSubmissionResponseDto {
  @ApiProperty({ description: 'Submission ID', type: String })
  submissionId: string;
}
