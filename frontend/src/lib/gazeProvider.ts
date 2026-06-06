import type { GazeFrame, GazePoint, GazeProviderStatus } from "../types";

export type ProviderMode = "mediapipe" | "pointer";

export interface GazeProvider {
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): GazeProviderStatus;
  getLatestFrame(): GazeFrame | null;
  collectCalibrationSample(target: GazePoint): void;
}
