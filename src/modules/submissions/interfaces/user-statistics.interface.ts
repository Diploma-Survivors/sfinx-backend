/**
 * User statistics interfaces
 */

export interface UserStatistics {
  totalSubmissions: number;
  totalAccepted: number;
  totalProblemsAttempted: number;
  totalProblemsSolved: number;
  acceptanceRate: number;
  easyProblems: { solved: number; total: number };
  mediumProblems: { solved: number; total: number };
  hardProblems: { solved: number; total: number };
}

export interface DetailedUserStatistics extends UserStatistics {
  averageAttempts: number;
  averageRuntime: number | null;
  averageMemory: number | null;
  solveStreak: number;
  lastSolvedAt: Date | null;
}
