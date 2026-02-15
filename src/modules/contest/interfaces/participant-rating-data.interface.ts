export interface IParticipantRatingData {
  userId: number;
  contestId: number;
  currentRating: number;
  actualRank: number;
  seed: number;
  delta: number;
}
