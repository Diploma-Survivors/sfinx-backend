/**
 * CASL Controller Examples
 *
 * This file demonstrates various ways to use CASL for authorization in NestJS controllers.
 * These are example implementations showing different CASL patterns.
 */

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckAbility, CheckPolicies, GetUser } from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Submission } from '../../submissions/entities/submission.entity';
import { Action } from '../casl/casl-ability.factory';
import {
  AdminAccessPolicy,
  ManageProblemsPolicy,
  PremiumAccessPolicy,
} from '../casl/policies';
import { RbacService } from '../rbac.service';

@ApiTags('CASL Examples')
@Controller('examples/casl')
@ApiBearerAuth('JWT-auth')
export class CaslExamplesController {
  constructor(private readonly rbacService: RbacService) {}

  // ==================== SIMPLE PERMISSION CHECK ====================

  /**
   * Example 1: Simple action + subject check
   * User must have the ability to 'create' on 'Problem' subject
   */
  @Post('problems')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Create, subject: 'Problem' })
  @ApiOperation({ summary: 'Create problem - Simple CASL check' })
  createProblem(@Body() data: unknown, @GetUser() user: User) {
    // Your logic here
    return { message: 'Problem created', userId: user.id, data };
  }

  // ==================== MULTIPLE PERMISSIONS CHECK ====================

  /**
   * Example 2: Multiple permission checks (user needs ALL of these)
   * User must be able to both 'update' and 'delete' problems
   */
  @Put('problems/:id/manage')
  @UseGuards(CaslGuard)
  @CheckAbility(
    { action: Action.Update, subject: 'Problem' },
    { action: Action.Delete, subject: 'Problem' },
  )
  @ApiOperation({ summary: 'Manage problem - Multiple CASL checks' })
  manageProblem(@Param('id') id: string, @GetUser() user: User) {
    return { message: 'Problem managed', problemId: id, userId: user.id };
  }

  // ==================== CONDITIONAL PERMISSION CHECK ====================

  /**
   * Example 3: Conditional permission - check ownership
   * This shows how to check permission on a specific instance
   * In practice, you'd load the submission and check if user owns it
   */
  @Put('submissions/:id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: 'Submission' })
  @ApiOperation({ summary: 'Update submission - Conditional check' })
  updateSubmission(
    @Param('id') id: string,
    @Body() data: unknown,
    @GetUser() user: User,
  ) {
    // Load the submission (example)
    const submission = { id: +id, user: { id: user.id } } as Submission;

    // Check if user can update THIS specific submission
    const ability = this.rbacService.getUserAbility(user);
    if (!ability.can(Action.Update, submission)) {
      throw new ForbiddenException('You can only update your own submissions');
    }

    return { message: 'Submission updated', submissionId: id, data };
  }

  // ==================== FIELD-LEVEL PERMISSION CHECK ====================

  /**
   * Example 4: Field-level permissions
   * Check if user can access specific fields
   */
  @Get('users/:id/profile')
  @UseGuards(CaslGuard)
  @CheckAbility({
    action: Action.Read,
    subject: 'User',
    fields: ['email', 'phone'],
  })
  @ApiOperation({ summary: 'Get user profile - Field-level check' })
  getUserProfile(@Param('id') id: string, @GetUser() user: User) {
    // User can read the email and phone fields
    return {
      userId: id,
      email: user.email,
    };
  }

  // ==================== POLICY-BASED AUTHORIZATION ====================

  /**
   * Example 5: Using policy handler class
   * Policies allow complex authorization logic
   */
  @Post('problems/advanced')
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageProblemsPolicy())
  @ApiOperation({ summary: 'Create problem - Policy-based check' })
  createProblemWithPolicy(@Body() data: unknown, @GetUser() user: User) {
    return { message: 'Problem created using policy', userId: user.id, data };
  }

  /**
   * Example 6: Using inline policy handler (callback)
   * Good for simple, one-off checks
   */
  @Get('admin/dashboard')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Admin dashboard - Inline policy' })
  getAdminDashboard(@GetUser() user: User) {
    return {
      message: 'Admin dashboard',
      userRole: user.role?.slug,
    };
  }

  /**
   * Example 7: Multiple policies (user needs to pass ALL)
   */
  @Post('admin/roles')
  @UseGuards(CaslGuard)
  @CheckPolicies(new AdminAccessPolicy(), (ability) =>
    ability.can(Action.Roles, 'Admin'),
  )
  @ApiOperation({ summary: 'Manage roles - Multiple policies' })
  manageRoles(@Body() data: unknown, @GetUser() user: User) {
    return { message: 'Roles managed', user, data };
  }

  // ==================== PREMIUM CONTENT ACCESS ====================

  /**
   * Example 8: Premium content access
   * Automatically checks user.isPremium status
   */
  @Get('problems/premium/:id')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.ReadPremium, subject: 'Problem' })
  @ApiOperation({ summary: 'View premium problem - Premium check' })
  getPremiumProblem(@Param('id') id: string, @GetUser() user: User) {
    // CASL will automatically check if user.isPremium = true
    return {
      problemId: id,
      isPremium: user.isPremium,
      message: 'Premium content accessed',
    };
  }

  /**
   * Example 9: Using premium policy
   */
  @Get('contests/premium')
  @UseGuards(CaslGuard)
  @CheckPolicies(new PremiumAccessPolicy())
  @ApiOperation({ summary: 'Premium contests - Policy check' })
  getPremiumContests(@GetUser() user: User) {
    return {
      contests: [],
      isPremiumUser: user.isPremium,
    };
  }

  // ==================== RUNTIME PERMISSION CHECKS ====================

  /**
   * Example 10: Manual runtime permission check
   * Use RbacService methods for complex logic
   */
  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete post - Runtime check' })
  deletePost(@Param('id') id: string, @GetUser() user: User) {
    // Load the post (example)
    const post = { id: +id, user: { id: 123 } } as {
      id: number;
      user: { id: number };
    };

    // Option 1: Check using RbacService
    const canDelete = this.rbacService.canUserPerformAction(
      user,
      Action.Delete,
      'Post',
    );

    // Option 2: Check ownership
    const isOwner = post.user.id === user.id;
    const canDeleteOwn = this.rbacService.canUserPerformAction(
      user,
      Action.Delete,
      'Post',
    );

    if (!canDelete && !(isOwner && canDeleteOwn)) {
      throw new ForbiddenException(
        'You can only delete your own posts or have delete permission',
      );
    }

    return { message: 'Post deleted', postId: id };
  }

  // ==================== COMPLEX BUSINESS LOGIC ====================

  /**
   * Example 11: Complex authorization with business logic
   * Combine CASL with custom business rules
   */
  @Put('problems/:id/publish')
  @UseGuards(CaslGuard)
  @CheckAbility({ action: Action.Update, subject: 'Problem' })
  @ApiOperation({ summary: 'Publish problem - Complex logic' })
  publishProblem(@Param('id') id: string, @GetUser() user: User) {
    const problem = { id: +id, createdBy: 456 } as {
      id: number;
      createdBy: number;
    };

    // Get all actions user can perform on Problem
    const actions = this.rbacService.getUserActionsForSubject(user, 'Problem');

    // Check if user is admin OR owner
    const isAdmin = user.role?.slug === 'admin';
    const isOwner = problem.createdBy === user.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Only admin or problem creator can publish');
    }

    // Additional business logic
    // e.g., check if problem has testcases, is valid, etc.

    return {
      message: 'Problem published',
      problemId: id,
      userActions: actions,
    };
  }

  // ==================== PERMISSION SUMMARY ====================

  /**
   * Example 12: Get user's permission summary
   * Useful for frontend to show/hide UI elements
   */
  @Get('me/permissions')
  @ApiOperation({ summary: 'Get my permissions' })
  async getMyPermissions(@GetUser() user: User) {
    const summary = await this.rbacService.getUserPermissionSummary(user);

    // Get specific abilities
    const abilities = {
      canCreateProblem: this.rbacService.canUserPerformAction(
        user,
        Action.Create,
        'Problem',
      ),
      canViewAllSubmissions: this.rbacService.canUserPerformAction(
        user,
        Action.ReadAll,
        'Submission',
      ),
      canAccessAdmin: this.rbacService.canUserPerformAction(
        user,
        Action.Access,
        'Admin',
      ),
      canAccessPremium: this.rbacService.canUserPerformAction(
        user,
        Action.ReadPremium,
        'Problem',
      ),
    };

    return {
      ...summary,
      abilities,
    };
  }

  // ==================== BULK PERMISSION CHECK ====================

  /**
   * Example 13: Check multiple permissions at once
   */
  @Get('me/abilities')
  @ApiOperation({ summary: 'Check multiple abilities' })
  checkMultipleAbilities(@GetUser() user: User) {
    const checks = [
      { action: Action.Create, subject: 'Problem' as const },
      { action: Action.Create, subject: 'Contest' as const },
      { action: Action.ReadAll, subject: 'Submission' as const },
      { action: Action.Ban, subject: 'User' as const },
    ];

    const results = this.rbacService.checkMultiplePermissions(user, checks);

    return {
      canCreateProblem: results[0],
      canCreateContest: results[1],
      canViewAllSubmissions: results[2],
      canBanUsers: results[3],
    };
  }
}
