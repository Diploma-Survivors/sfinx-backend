import { AppAbility } from './casl-ability.factory';

/**
 * Interface for policy handlers
 * Policy handlers allow you to define complex authorization logic
 */
export interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

/**
 * Type for policy handler functions
 */
export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

/**
 * Union type for both handler types
 */
export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
