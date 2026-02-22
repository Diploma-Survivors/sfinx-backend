import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProblemReportsService } from './problem-reports.service';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';
import { UpdateProblemReportDto } from './dto/update-problem-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslGuard } from '../auth/guards/casl.guard';
import { CheckPolicies, GetUser } from '../../common';
import { Action } from '../rbac/casl';
import { User } from '../auth/entities/user.entity';

@ApiTags('Problem Reports')
@Controller('problem-reports')
export class ProblemReportsController {
  constructor(private readonly problemReportsService: ProblemReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new problem report' })
  create(@Body() createDto: CreateProblemReportDto, @GetUser() user: User) {
    return this.problemReportsService.create(createDto, user.id);
  }

  @Get()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all problem reports (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.problemReportsService.findAll(
      page ? +page : 1,
      limit ? +limit : 10,
      { status, type },
    );
  }

  @Get(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a specific problem report (Admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.problemReportsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update problem report status (Admin only)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProblemReportDto,
  ) {
    return this.problemReportsService.updateStatus(id, updateDto);
  }
}
