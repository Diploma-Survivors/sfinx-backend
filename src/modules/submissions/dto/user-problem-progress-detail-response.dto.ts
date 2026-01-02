import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionListResponseDto } from './submission-response.dto';
import { UserProblemProgressResponseDto } from './user-problem-progress-response.dto';

export class UserProblemProgressDetailResponseDto extends UserProblemProgressResponseDto {
  @ApiPropertyOptional({
    description: 'Best submission details',
    type: SubmissionListResponseDto,
  })
  bestSubmission?: SubmissionListResponseDto;
}
