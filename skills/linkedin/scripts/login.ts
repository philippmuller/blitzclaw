/**
 * LinkedIn Login Script
 * Handles authentication including 2FA
 */

import { chromium, Browser, Page } from 'playwright';

interface LoginResult {
  success: boolean;
  error?: string;
  needs2FA?: boolean;
}

interface LoginOptions {
  email: string;
  password: string;
  twoFactorCode?: string;
  headless?: boolean;
}

export async function login(options: LoginOptions): Promise<{ browser: Browser; page: Page }> {
  const { email, password, twoFactorCode, headless = true } = options;

  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    // Navigate to LinkedIn login
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });

    // Fill in credentials
    await page.fill('#username', email);
    await page.fill('#password', password);

    // Click sign in
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForTimeout(3000);

    // Check if we need 2FA
    const is2FAPage = await page.$('input[name="pin"]');
    if (is2FAPage) {
      if (!twoFactorCode) {
        throw new Error('2FA_REQUIRED');
      }
      await page.fill('input[name="pin"]', twoFactorCode);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    // Check if login succeeded (should be on feed or profile)
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      throw new Error('Login failed - check credentials or security checkpoint');
    }

    console.log('✅ LinkedIn login successful');
    return { browser, page };

  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function logout(page: Page, browser: Browser): Promise<void> {
  try {
    // Navigate to logout
    await page.goto('https://www.linkedin.com/m/logout/', { waitUntil: 'networkidle' });
  } catch (e) {
    // Ignore logout errors
  } finally {
    await browser.close();
  }
}

// CLI usage
if (require.main === module) {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  const twoFactorCode = process.argv[2];

  if (!email || !password) {
    console.error('Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD environment variables');
    process.exit(1);
  }

  login({ email, password, twoFactorCode })
    .then(async ({ browser, page }) => {
      console.log('Login successful!');
      console.log('Current URL:', page.url());
      await logout(page, browser);
    })
    .catch((error) => {
      console.error('Login failed:', error.message);
      process.exit(1);
    });
}
