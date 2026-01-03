import * as path from 'path';
import * as fs from 'fs';

/**
 * Security utilities for validating and sanitizing file paths
 * Prevents path traversal attacks and other security vulnerabilities
 */

// Base directory under which all output paths must reside
// Adjust this as needed for your deployment environment.
const OUTPUT_ROOT = path.resolve(process.cwd(), 'output');

/**
 * Validates that a path doesn't contain path traversal attempts
 * @param filePath - The path to validate
 * @returns true if the path is safe, false otherwise
 */
export function isPathSafe(filePath: string): boolean {
  // Ensure the path doesn't contain null bytes (security vulnerability)
  if (filePath.includes('\0')) {
    return false;
  }

  // Normalize the path to resolve any . or .. segments
  const normalizedPath = path.normalize(filePath);

  // Basic check for path traversal attempts
  if (normalizedPath.includes('..')) {
    return false;
  }

  return true;
}

/**
 * Sanitizes a file path by removing dangerous characters and sequences
 * @param filePath - The path to sanitize
 * @returns Sanitized path
 */
export function sanitizePath(filePath: string): string {
  // Remove null bytes
  let sanitized = filePath.replace(/\0/g, '');

  // Normalize the path
  sanitized = path.normalize(sanitized);

  return sanitized;
}

/**
 * Validates an input file path for security
 * Ensures the path exists, is a file, and doesn't contain traversal attempts
 * @param inputPath - The input file path to validate
 * @throws Error if path is invalid or unsafe
 */
export function validateInputPath(inputPath: string): void {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Invalid input path: must be a non-empty string');
  }

  // Check for path traversal attempts
  if (!isPathSafe(inputPath)) {
    throw new Error('Invalid input path: path traversal detected');
  }

  // Resolve to absolute path - this is safe after isPathSafe() check
  const absolutePath = path.resolve(inputPath);

  // Additional security check: ensure resolved path doesn't contain '..'
  // after resolution (defense in depth)
  const normalizedResolved = path.normalize(absolutePath);
  if (normalizedResolved.includes('..')) {
    throw new Error('Invalid input path: path traversal detected after resolution');
  }

  // Check if file exists using the sanitized path
  if (!fs.existsSync(normalizedResolved)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  // Ensure it's a file, not a directory
  const stats = fs.statSync(normalizedResolved);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${inputPath}`);
  }
}

/**
 * Validates an output directory path for security
 * Ensures the path is safe and creates it if it doesn't exist
 * @param outputDir - The output directory path to validate
 * @throws Error if path is invalid or unsafe
 */
export function validateOutputDir(outputDir: string): void {
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('Invalid output directory: must be a non-empty string');
  }

  // Check for obvious path traversal attempts on the raw input
  if (!isPathSafe(outputDir)) {
    throw new Error('Invalid output directory: path traversal detected');
  }

  // Resolve the output directory relative to the configured OUTPUT_ROOT.
  // This confines all output under a single safe root directory.
  const absolutePath = path.resolve(OUTPUT_ROOT, outputDir);

  // Additional security check: ensure resolved path stays within OUTPUT_ROOT
  const normalizedResolved = path.normalize(absolutePath);
  if (!normalizedResolved.startsWith(OUTPUT_ROOT + path.sep)) {
    throw new Error('Invalid output directory: path escapes allowed output root');
  }

  // Create directory if it doesn't exist using the sanitized path
  if (!fs.existsSync(normalizedResolved)) {
    fs.mkdirSync(normalizedResolved, { recursive: true });
  }

  // Ensure it's a directory
  const stats = fs.statSync(normalizedResolved);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${outputDir}`);
  }
}

/**
 * Safely joins path segments, preventing path traversal
 * @param basePath - The base directory path
 * @param segments - Path segments to join
 * @returns Safe joined path
 * @throws Error if resulting path would escape basePath
 */
export function safePathJoin(basePath: string, ...segments: string[]): string {
  // Resolve base path
  const resolvedBase = path.resolve(basePath);

  // Join all segments
  const joined = path.join(basePath, ...segments);
  const resolvedJoined = path.resolve(joined);

  // Ensure the result is within the base path
  if (!resolvedJoined.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected');
  }

  return resolvedJoined;
}
