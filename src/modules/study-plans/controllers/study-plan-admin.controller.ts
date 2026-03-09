import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  CheckAbility,
  GetUser,
  Language,
} from 'src/common';
import { CaslGuard } from 'src/modules/auth/guards/casl.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Action } from 'src/modules/rbac/casl/casl-ability.factory';
import { AddStudyPlanItemDto } from '../dto/add-study-plan-item.dto';
import { CreateStudyPlanDto } from '../dto/create-study-plan.dto';
import { FilterStudyPlanDto } from '../dto/filter-study-plan.dto';
import { ReorderItemsDto } from '../dto/reorder-items.dto';
import { StudyPlanSummaryResponseDto } from '../dto/study-plan-response.dto';
import { UpdateStudyPlanDto } from '../dto/update-study-plan.dto';
import { StudyPlan } from '../entities/study-plan.entity';
import { StudyPlanItem } from '../entities/study-plan-item.entity';
import { StudyPlanService } from '../services/study-plan.service';

@ApiTags('Admin - Study Plans')
@ApiBearerAuth()
@Controller('admin/study-plans')
@UseGuards(JwtAuthGuard, CaslGuard)
export class StudyPlanAdminController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Create a new study plan' })
  @ApiResponse({ status: 201, type: StudyPlan })
  create(@GetUser('id') userId: number, @Body() dto: CreateStudyPlanDto) {
    return this.studyPlanService.create(userId, dto);
  }

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'List all study plans (including drafts)' })
  @ApiPaginatedResponse(StudyPlanSummaryResponseDto)
  findAll(@Query() query: FilterStudyPlanDto, @Language() lang: string) {
    return this.studyPlanService.findAllAdmin(query, lang);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Get study plan detail for editing' })
  @ApiResponse({ status: 200, type: StudyPlan })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.studyPlanService.findOneAdmin(id);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Update study plan' })
  @ApiResponse({ status: 200, type: StudyPlan })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudyPlanDto,
  ) {
    return this.studyPlanService.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: Action.Delete, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Delete study plan' })
  @ApiResponse({ status: 200, description: 'Study plan deleted' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studyPlanService.remove(id);
  }

  @Post(':id/publish')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Publish a draft study plan' })
  @ApiResponse({ status: 200, type: StudyPlan })
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.studyPlanService.publish(id);
  }

  @Post(':id/archive')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Archive a study plan' })
  @ApiResponse({ status: 200, type: StudyPlan })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.studyPlanService.archive(id);
  }

  @Post(':id/cover-image')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload cover image' })
  @ApiResponse({ status: 200, type: StudyPlan })
  uploadCoverImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.studyPlanService.uploadCoverImage(id, file);
  }

  // ─── Item management ────────────────────────────────────────────────

  @Post(':id/items')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Add a problem to the study plan' })
  @ApiResponse({ status: 201, type: StudyPlanItem })
  addItem(
    @Param('id', ParseIntPipe) planId: number,
    @Body() dto: AddStudyPlanItemDto,
  ) {
    return this.studyPlanService.addItem(planId, dto);
  }

  @Delete(':id/items/:itemId')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Remove an item from the study plan' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  removeItem(
    @Param('id', ParseIntPipe) planId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.studyPlanService.removeItem(planId, itemId);
  }

  @Patch(':id/items/reorder')
  @CheckAbility({ action: Action.Update, subject: 'StudyPlan' })
  @ApiOperation({ summary: 'Reorder items in the study plan' })
  @ApiResponse({ status: 200, description: 'Items reordered' })
  reorderItems(
    @Param('id', ParseIntPipe) planId: number,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.studyPlanService.reorderItems(planId, dto);
  }
}
