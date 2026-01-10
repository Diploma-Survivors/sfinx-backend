import { LeaderboardProblemStatus } from '../dto';

export interface ILeaderboardUser {
  id: number;
  username: string;
  avatarUrl?: string;
  fullName?: string;
}

export interface IProblemStatus {
  problemId: number;
  problemOrder: number;
  status: LeaderboardProblemStatus;
  score?: number;
  attempts?: number;
}

/**
 * Leaderboard entry interface for contest rankings
 */
export interface ILeaderboardEntry {
  rank: number;
  user: ILeaderboardUser;
  totalScore: number;
  problemStatus: IProblemStatus[];
}

/**
 * SSE event data for leaderboard updates
 */
export interface ILeaderboardUpdateEvent {
  contestId: number;
  entry: ILeaderboardEntry;
  timestamp: number;
}
