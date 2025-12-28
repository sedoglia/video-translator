import { execSync } from 'child_process';
import type { GPUInfo } from '../../shared/types';
import { logger } from './logger';

export async function detectCudaAvailability(): Promise<GPUInfo> {
  const gpuInfo: GPUInfo = {
    cudaAvailable: false
  };

  try {
    // Check if nvidia-smi is available
    const nvidiaSmiOutput = execSync('nvidia-smi --query-gpu=name,driver_version --format=csv,noheader', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (nvidiaSmiOutput) {
      const [gpuName, driverVersion] = nvidiaSmiOutput.trim().split(',');
      gpuInfo.gpuName = gpuName.trim();
      gpuInfo.driverVersion = driverVersion.trim();
      gpuInfo.cudaAvailable = true; // If nvidia-smi works, GPU is available
      logger.info(`NVIDIA GPU detected: ${gpuInfo.gpuName}, Driver: ${gpuInfo.driverVersion}`);
    }
  } catch (error) {
    logger.debug('nvidia-smi not available or no NVIDIA GPU detected');
  }

  return gpuInfo;
}

export function shouldUseCuda(userPreference: boolean, gpuInfo: GPUInfo): boolean {
  if (!userPreference) return false;
  return gpuInfo.cudaAvailable;
}
