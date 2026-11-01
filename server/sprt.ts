/**
 * Sequential Probability Ratio Test (SPRT) & Elo Mathematics.
 * Based on the Fishtest / Wald SPRT methodology used in Stockfish.
 */

export interface SprtConfig {
  elo0: number; // Null hypothesis H0 (e.g. 0.0 Elo)
  elo1: number; // Alternative hypothesis H1 (e.g. 5.0 Elo)
  alpha: number; // Type I error rate (default 0.05)
  beta: number; // Type II error rate (default 0.05)
}

export type EloSignificance = 'positive' | 'negative' | 'inconclusive';

export interface SprtResult {
  llr: number;
  lowerBound: number;
  upperBound: number;
  status: 'running' | 'passed' | 'failed';
  elo: number;
  estimatedElo: number;
  eloError: number; // 95% confidence interval margin (+/-)
  eloMin: number;
  eloMax: number;
  winRate: number;
  significance: EloSignificance;
}

export interface PentanomialStats {
  // Pair results: [2-0, 1.5-0.5, 1-1, 0.5-1.5, 0-2]
  ww: number;
  wd: number;
  wlOrDd: number;
  ld: number;
  ll: number;
}

export class SprtCalculator {
  private config: SprtConfig;
  private lowerBound: number;
  private upperBound: number;

  constructor(config: Partial<SprtConfig> = {}) {
    this.config = {
      elo0: config.elo0 ?? 0.0,
      elo1: config.elo1 ?? 5.0,
      alpha: config.alpha ?? 0.05,
      beta: config.beta ?? 0.05,
    };

    // Wald's stopping bounds:
    // lowerBound = ln(beta / (1 - alpha))
    // upperBound = ln((1 - beta) / alpha)
    this.lowerBound = Math.log(this.config.beta / (1 - this.config.alpha));
    this.upperBound = Math.log((1 - this.config.beta) / this.config.alpha);
  }

  public getBounds() {
    return {
      lowerBound: this.lowerBound,
      upperBound: this.upperBound,
    };
  }

  /**
   * Converts Elo to expected score: s = 1 / (1 + 10^(-elo / 400))
   */
  public static eloToScore(elo: number): number {
    return 1.0 / (1.0 + Math.pow(10.0, -elo / 400.0));
  }

  /**
   * Converts score s in (0, 1) to Elo difference: -400 * log10(1 / s - 1)
   */
  public static scoreToElo(score: number): number {
    if (score <= 0.0) return -Infinity;
    if (score >= 1.0) return Infinity;
    return -400.0 * Math.log10(1.0 / score - 1.0);
  }

  /**
   * Calculates Log-Likelihood Ratio (LLR), Elo difference, and 95% CI from W/D/L.
   */
  public calculate(
    wins: number,
    draws: number,
    losses: number,
    anchorElo: number = 1500
  ): SprtResult {
    const totalGames = wins + draws + losses;
    if (totalGames === 0) {
      return {
        llr: 0,
        lowerBound: this.lowerBound,
        upperBound: this.upperBound,
        status: 'running',
        elo: 0,
        estimatedElo: anchorElo,
        eloError: 0,
        eloMin: 0,
        eloMax: 0,
        winRate: 0.5,
        significance: 'inconclusive',
      };
    }

    const rawScore = (wins + 0.5 * draws) / totalGames;
    const winRate = rawScore;

    // Apply Laplace prior (1 pseudo-win, 1 pseudo-loss) to prevent extreme score
    // explosion on small sample sizes (e.g. 2-0 -> +1200 Elo)
    const smoothedScore = (wins + 0.5 * draws + 1.0) / (totalGames + 2.0);

    // Variance of individual game score
    // Var(X) = E[X^2] - (E[X])^2 = (W + 0.25 * D) / N - score^2
    const varScore = Math.max(
      1e-6,
      (wins + 0.25 * draws) / totalGames - rawScore * rawScore
    );
    const stdDevScore = Math.sqrt(varScore / totalGames);

    // 95% Confidence Interval z-score = 1.95996
    const z = 1.95996;
    const scoreMin = Math.max(0.001, Math.min(0.999, smoothedScore - z * stdDevScore));
    const scoreMax = Math.max(0.001, Math.min(0.999, smoothedScore + z * stdDevScore));

    const elo = SprtCalculator.scoreToElo(Math.max(0.001, Math.min(0.999, smoothedScore)));
    const eloMin = SprtCalculator.scoreToElo(scoreMin);
    const eloMax = SprtCalculator.scoreToElo(scoreMax);
    const eloError = Math.max(Math.abs(eloMax - elo), Math.abs(elo - eloMin));

    // Calculate LLR based on normal approximation of score distribution
    const s0 = SprtCalculator.eloToScore(this.config.elo0);
    const s1 = SprtCalculator.eloToScore(this.config.elo1);

    // LLR for normal distribution with variance varScore:
    // LLR = (s1 - s0) * (totalGames * score - totalGames * (s0 + s1) / 2) / varScore
    let llr = 0;
    if (varScore > 0) {
      llr =
        ((s1 - s0) * (totalGames * rawScore - (totalGames * (s0 + s1)) / 2)) /
        (varScore * totalGames);
    }

    let status: 'running' | 'passed' | 'failed' = 'running';
    if (llr >= this.upperBound) {
      status = 'passed';
    } else if (llr <= this.lowerBound) {
      status = 'failed';
    }

    // Statistical significance:
    // positive: SPRT passed OR 95% CI is strictly positive (eloMin > 0) with at least 8 games
    // negative: SPRT failed OR 95% CI is strictly negative (eloMax < 0) with at least 8 games
    // inconclusive: CI spans across zero (noise / within margin of error)
    let significance: EloSignificance = 'inconclusive';
    if (status === 'passed' || (totalGames >= 8 && eloMin > 0)) {
      significance = 'positive';
    } else if (status === 'failed' || (totalGames >= 8 && eloMax < 0)) {
      significance = 'negative';
    }

    const cleanElo = isFinite(elo) ? elo : 0;
    const estimatedElo = Math.round(anchorElo + cleanElo);

    return {
      llr,
      lowerBound: this.lowerBound,
      upperBound: this.upperBound,
      status,
      elo: cleanElo,
      estimatedElo,
      eloError: isFinite(eloError) ? eloError : 0,
      eloMin: isFinite(eloMin) ? eloMin : -100,
      eloMax: isFinite(eloMax) ? eloMax : 100,
      winRate,
      significance,
    };
  }
}
