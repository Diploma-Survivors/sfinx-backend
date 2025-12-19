/**
 * CASL Module Exports
 *
 * Central export file for CASL-related components.
 * Import from here for convenience:
 *
 * @example
 * import { CaslAbilityFactory, Action, Subjects } from '@modules/rbac/casl';
 */

// Core
export * from './casl-ability.factory';
export * from './casl.module';

// Policy handler interface
export * from './policy-handler.interface';

// Built-in policies
export * from './policies';
