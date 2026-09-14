export function artifactPathsValid(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 16 && value.every(file =>
    typeof file === 'string' && file.length <= 500 && !/[\\:\x00-\x1f]/.test(file)
    && !file.startsWith('/') && file.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part))
    && !['.git', '.vibe'].includes(file.split('/')[0]!.toLowerCase()));
}
