import { execFile, spawn } from 'node:child_process';
import { platform } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CaptureOptions {
  area?: 'full' | 'region';
  region?: { x: number; y: number; w: number; h: number };
}

interface ImageDimensions {
  width: number;
  height: number;
}

export class ScreenCapture {
  private static lastCaptureTime = 0;
  private static readonly MIN_INTERVAL_MS = 1000;
  private static readonly CAPTURE_TIMEOUT_MS = 5000;
  private static readonly MAX_WIDTH = 1920;
  private static readonly MAX_HEIGHT = 1080;

  /**
   * Captures the screen and returns PNG buffer
   */
  static async capture(options?: CaptureOptions): Promise<Buffer> {
    this.enforceMinInterval();

    const platformType = platform();

    try {
      let buffer: Buffer;

      if (platformType === 'darwin') {
        buffer = await this.captureMacOS(options);
      } else if (platformType === 'win32') {
        buffer = await this.captureWindows(options);
      } else if (platformType === 'linux') {
        buffer = await this.captureLinux(options);
      } else {
        throw new Error(`Unsupported platform: ${platformType}`);
      }

      this.lastCaptureTime = Date.now();
      return await this.resizeIfNeeded(buffer);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Screen capture failed on ${platformType}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * macOS screen capture using screencapture command
   */
  private static async captureMacOS(options?: CaptureOptions): Promise<Buffer> {
    const args = ['-x', '-t', 'png'];

    if (options?.area === 'region' && options.region) {
      const { x, y, w, h } = options.region;
      args.push('-R', `${x},${y},${w},${h}`);
    }

    args.push('-');

    return await this.executeCapture('screencapture', args,
      'Install Xcode command line tools: xcode-select --install');
  }

  /**
   * Windows screen capture using PowerShell
   */
  private static async captureWindows(options?: CaptureOptions): Promise<Buffer> {
    const script = this.buildWindowsPowerShellScript(options);

    return await this.executeCapture(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      'PowerShell is required for screen capture on Windows'
    );
  }

  /**
   * Linux screen capture using scrot or ImageMagick
   */
  private static async captureLinux(options?: CaptureOptions): Promise<Buffer> {
    try {
      return await this.captureWithScrot(options);
    } catch (error) {
      // scrot failed, falling back to ImageMagick import
      return await this.captureWithImageMagick(options);
    }
  }

  /**
   * Capture using scrot command
   */
  private static async captureWithScrot(options?: CaptureOptions): Promise<Buffer> {
    const args = ['-o', '-'];

    if (options?.area === 'region' && options.region) {
      const { x, y, w, h } = options.region;
      args.push('-a', `${x},${y},${w},${h}`);
    }

    return await this.executeCapture('scrot', args,
      'Install scrot: sudo apt-get install scrot (or use your package manager)');
  }

  /**
   * Capture using ImageMagick import command
   */
  private static async captureWithImageMagick(options?: CaptureOptions): Promise<Buffer> {
    const args = ['-window', 'root'];

    if (options?.area === 'region' && options.region) {
      const { x, y, w, h } = options.region;
      args.push('-crop', `${w}x${h}+${x}+${y}`);
    }

    args.push('png:-');

    return await this.executeCapture('import', args,
      'Install ImageMagick: sudo apt-get install imagemagick');
  }

  /**
   * Executes capture command and returns buffer
   */
  private static async executeCapture(
    command: string,
    args: string[],
    helpMessage: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: this.CAPTURE_TIMEOUT_MS,
      });

      const chunks: Buffer[] = [];
      const errorChunks: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr?.on('data', (chunk: Buffer) => errorChunks.push(chunk));

      child.on('error', (error) => {
        reject(new Error(`${error.message}. ${helpMessage}`));
      });

      child.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          const errorMsg = Buffer.concat(errorChunks).toString();
          reject(new Error(`Command failed with code ${code}. ${errorMsg || helpMessage}`));
        }
      });

      setTimeout(() => {
        child.kill();
        reject(new Error(`Screen capture timed out after ${this.CAPTURE_TIMEOUT_MS}ms`));
      }, this.CAPTURE_TIMEOUT_MS);
    });
  }

  /**
   * Builds PowerShell script for Windows screen capture
   */
  private static buildWindowsPowerShellScript(options?: CaptureOptions): string {
    let script = `
      Add-Type -AssemblyName System.Drawing;
      Add-Type -AssemblyName System.Windows.Forms;
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
    `;

    if (options?.area === 'region' && options.region) {
      const { x, y, w, h } = options.region;
      script += `
        $bounds = New-Object System.Drawing.Rectangle(${x}, ${y}, ${w}, ${h});
      `;
    }

    script += `
      $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height);
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap);
      $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
      $stream = New-Object System.IO.MemoryStream;
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png);
      $bytes = $stream.ToArray();
      [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length);
      $graphics.Dispose();
      $bitmap.Dispose();
      $stream.Dispose();
    `;

    return script;
  }

  /**
   * Resizes image if dimensions exceed max resolution
   */
  private static async resizeIfNeeded(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const dimensions = await this.getImageDimensions(imageBuffer);

      if (dimensions.width <= this.MAX_WIDTH && dimensions.height <= this.MAX_HEIGHT) {
        return imageBuffer;
      }

      // Image exceeds max resolution, attempting to resize

      return await this.resizeImage(imageBuffer);
    } catch (error) {
      // Failed to check/resize image - return original
      return imageBuffer;
    }
  }

  /**
   * Gets image dimensions from PNG buffer
   */
  private static async getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
    // PNG header: 8 bytes signature + IHDR chunk (4 bytes length + 4 bytes type + 4 bytes width + 4 bytes height)
    if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
      throw new Error('Invalid PNG format');
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    return { width, height };
  }

  /**
   * Resizes image using platform-specific tools
   */
  private static async resizeImage(imageBuffer: Buffer): Promise<Buffer> {
    const platformType = platform();

    try {
      if (platformType === 'darwin') {
        return await this.resizeMacOS(imageBuffer);
      } else if (platformType === 'win32') {
        return await this.resizeWindows(imageBuffer);
      } else if (platformType === 'linux') {
        return await this.resizeLinux(imageBuffer);
      }
    } catch (error) {
      // Resize failed, returning original image
    }

    return imageBuffer;
  }

  /**
   * Resizes image on macOS using sips
   */
  private static async resizeMacOS(imageBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn('sips', [
        '--resampleWidth', this.MAX_WIDTH.toString(),
        '-s', 'format', 'png',
        '/dev/stdin'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const chunks: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`sips failed with code ${code}`));
        }
      });

      child.stdin?.write(imageBuffer);
      child.stdin?.end();
    });
  }

  /**
   * Resizes image on Windows using PowerShell
   */
  private static async resizeWindows(imageBuffer: Buffer): Promise<Buffer> {
    const script = `
      Add-Type -AssemblyName System.Drawing;
      $stream = New-Object System.IO.MemoryStream(,$input);
      $image = [System.Drawing.Image]::FromStream($stream);
      $ratio = [Math]::Min(${this.MAX_WIDTH} / $image.Width, ${this.MAX_HEIGHT} / $image.Height);
      $newWidth = [int]($image.Width * $ratio);
      $newHeight = [int]($image.Height * $ratio);
      $resized = New-Object System.Drawing.Bitmap($newWidth, $newHeight);
      $graphics = [System.Drawing.Graphics]::FromImage($resized);
      $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight);
      $outStream = New-Object System.IO.MemoryStream;
      $resized.Save($outStream, [System.Drawing.Imaging.ImageFormat]::Png);
      $bytes = $outStream.ToArray();
      [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length);
      $graphics.Dispose();
      $resized.Dispose();
      $image.Dispose();
      $stream.Dispose();
      $outStream.Dispose();
    `;

    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const chunks: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`PowerShell resize failed with code ${code}`));
        }
      });

      child.stdin?.write(imageBuffer);
      child.stdin?.end();
    });
  }

  /**
   * Resizes image on Linux using ImageMagick convert
   */
  private static async resizeLinux(imageBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn('convert', [
        'png:-',
        '-resize', `${this.MAX_WIDTH}x${this.MAX_HEIGHT}>`,
        'png:-'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const chunks: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`convert failed with code ${code}`));
        }
      });

      child.stdin?.write(imageBuffer);
      child.stdin?.end();
    });
  }

  /**
   * Enforces minimum interval between captures
   */
  private static enforceMinInterval(): void {
    const now = Date.now();
    const elapsed = now - this.lastCaptureTime;

    if (elapsed < this.MIN_INTERVAL_MS) {
      const waitTime = this.MIN_INTERVAL_MS - elapsed;
      throw new Error(
        `Screen capture flood protection: wait ${waitTime}ms before next capture`
      );
    }
  }
}
