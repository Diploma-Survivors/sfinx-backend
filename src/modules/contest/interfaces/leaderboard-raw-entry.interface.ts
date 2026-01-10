export interface RawLeaderboardEntry {
  userId: number;
  totalScore: string; // decimal type returns string
  solvedCount: number;
  finishTime: number;
  problemScores: Record<
    number,
    {
      score: number;
      submissions: number;
      lastSubmitTime: string | null;
      firstAcTime: string | null;
    }
  >;
  username: string;
  avatarKey: string | null;
  fullName: string | null;
  rank: string; // dense_rank returns string/bigint
}
