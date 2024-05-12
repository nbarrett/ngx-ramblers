import Bottleneck from "bottleneck";

export function createBottleneckWithRatePerSecond(ratePerSecond: number): Bottleneck {
  return new Bottleneck({minTime: 1000 / ratePerSecond});
}
