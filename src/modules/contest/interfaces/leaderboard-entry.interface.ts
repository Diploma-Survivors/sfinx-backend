/**
 * Leaderboard entry interface for contest rankings
 */
export interface ILeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  avatarUrl: string | null;
  totalScore: number;
  problemScores: IProblemScore[];
  totalSubmissions: number;
  lastSubmissionAt: string | null;
}

/**
 * Score breakdown for a single problem
 */
export interface IProblemScore {
  problemId: number;
  score: number;
  submissions: number;
  lastSubmitTime: string | null;
}

/**
 * SSE event data for leaderboard updates
 */
export interface ILeaderboardUpdateEvent {
  contestId: number;
  entry: ILeaderboardEntry;
  timestamp: number;
}
