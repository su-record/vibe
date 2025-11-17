// Browser instance pool for efficient resource management
import puppeteer from 'puppeteer-core';
import { getBrowserLaunchOptions } from './browserUtils.js';
class BrowserPool {
    browser = null;
    lastUsed = 0;
    IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    cleanupTimer = null;
    /**
     * Get or create browser instance
     */
    async getBrowser() {
        // If browser exists and is connected, return it
        if (this.browser && this.browser.isConnected()) {
            this.lastUsed = Date.now();
            this.scheduleCleanup();
            return this.browser;
        }
        // Create new browser instance
        const options = getBrowserLaunchOptions();
        this.browser = await puppeteer.launch(options);
        this.lastUsed = Date.now();
        this.scheduleCleanup();
        return this.browser;
    }
    /**
     * Schedule automatic cleanup of idle browser
     */
    scheduleCleanup() {
        // Clear existing timer
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer);
        }
        // Set new timer
        this.cleanupTimer = setTimeout(async () => {
            const idleTime = Date.now() - this.lastUsed;
            if (idleTime >= this.IDLE_TIMEOUT) {
                await this.closeBrowser();
            }
        }, this.IDLE_TIMEOUT);
    }
    /**
     * Manually close browser instance
     */
    async closeBrowser() {
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        if (this.browser && this.browser.isConnected()) {
            await this.browser.close();
            this.browser = null;
        }
    }
    /**
     * Get a new page from the browser pool
     */
    async getPage() {
        const browser = await this.getBrowser();
        return await browser.newPage();
    }
}
// Singleton instance
export const browserPool = new BrowserPool();
// Cleanup on process exit
process.on('exit', () => {
    browserPool.closeBrowser();
});
process.on('SIGINT', async () => {
    await browserPool.closeBrowser();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await browserPool.closeBrowser();
    process.exit(0);
});
