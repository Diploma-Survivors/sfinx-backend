import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RankingType } from '../enums/ranking-type.enum';
import { RankingStrategy } from '../interfaces/ranking-strategy.interface';
import { IoiRankingStrategy } from './ioi-ranking.strategy';

@Injectable()
export class RankingStrategyFactory implements OnModuleInit {
  private readonly logger = new Logger(RankingStrategyFactory.name);
  private readonly strategies = new Map<RankingType, RankingStrategy>();

  constructor(private readonly ioiStrategy: IoiRankingStrategy) {}

  onModuleInit() {
    this.registerStrategy(this.ioiStrategy);
    this.logger.log(
      `Registered ${this.strategies.size} ranking strategies: [${[...this.strategies.keys()].join(', ')}]`,
    );
  }

  getStrategy(rankingType: RankingType): RankingStrategy {
    const strategy = this.strategies.get(rankingType);
    if (!strategy) {
      throw new Error(
        `No ranking strategy registered for type: ${rankingType}`,
      );
    }
    return strategy;
  }

  private registerStrategy(strategy: RankingStrategy): void {
    this.strategies.set(strategy.getRankingType(), strategy);
  }
}
