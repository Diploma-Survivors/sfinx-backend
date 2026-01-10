/**
 * Base event class for contest events
 */
export abstract class ContestEvent {
  constructor(
    public readonly contestId: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a contest is created
 */
export class ContestCreatedEvent extends ContestEvent {
  constructor(contestId: number) {
    super(contestId);
  }
}

/**
 * Event emitted when a contest is updated
 */
export class ContestUpdatedEvent extends ContestEvent {
  constructor(contestId: number) {
    super(contestId);
  }
}

/**
 * Event emitted when a contest is deleted
 */
export class ContestDeletedEvent extends ContestEvent {
  constructor(contestId: number) {
    super(contestId);
  }
}
