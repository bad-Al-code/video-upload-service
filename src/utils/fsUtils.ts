import { existsSync, mkdirSync } from 'node:fs';

export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    try {
      mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } catch (error: any) {
      console.error(`Error creating directory ${dirPath}: `, error);

      throw new Error(`ailed tp create essential directory: ${dirPath}`);
    }
  }
}
