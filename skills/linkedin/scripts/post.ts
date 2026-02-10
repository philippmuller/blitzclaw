/**
 * LinkedIn Post Script
 * Creates a text post on LinkedIn
 */

import { login, logout } from './login';

interface PostOptions {
  email: string;
  password: string;
  content: string;
  twoFactorCode?: string;
}

interface PostResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

export async function createPost(options: PostOptions): Promise<PostResult> {
  const { email, password, content, twoFactorCode } = options;

  let browser, page;

  try {
    // Login
    const session = await login({ email, password, twoFactorCode });
    browser = session.browser;
    page = session.page;

    // Navigate to feed
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click "Start a post" button
    const startPostButton = await page.$('button.share-box-feed-entry__trigger');
    if (!startPostButton) {
      throw new Error('Could not find "Start a post" button');
    }
    await startPostButton.click();
    await page.waitForTimeout(1500);

    // Wait for the post modal to appear
    const postEditor = await page.waitForSelector('.ql-editor[data-placeholder]', { timeout: 10000 });
    if (!postEditor) {
      throw new Error('Post editor did not appear');
    }

    // Type the content
    await postEditor.click();
    await page.keyboard.type(content, { delay: 50 }); // Human-like typing speed
    await page.waitForTimeout(1000);

    // Click the Post button
    const postButton = await page.$('button.share-actions__primary-action');
    if (!postButton) {
      throw new Error('Could not find Post button');
    }
    await postButton.click();

    // Wait for post to be submitted
    await page.waitForTimeout(3000);

    // Try to get the post URL (navigate to profile activity)
    await page.goto('https://www.linkedin.com/in/me/recent-activity/all/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Get the first post link
    const firstPostLink = await page.$('a[data-urn]');
    let postUrl = 'https://www.linkedin.com/feed/';
    if (firstPostLink) {
      const href = await firstPostLink.getAttribute('href');
      if (href) {
        postUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
      }
    }

    console.log('✅ Post created successfully');
    return { success: true, postUrl };

  } catch (error) {
    console.error('❌ Failed to create post:', (error as Error).message);
    return { success: false, error: (error as Error).message };

  } finally {
    if (browser && page) {
      await logout(page, browser);
    }
  }
}

// CLI usage
if (require.main === module) {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  const content = process.argv[2];
  const twoFactorCode = process.argv[3];

  if (!email || !password) {
    console.error('Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD environment variables');
    process.exit(1);
  }

  if (!content) {
    console.error('Usage: npx ts-node post.ts "Your post content" [2FA_CODE]');
    process.exit(1);
  }

  createPost({ email, password, content, twoFactorCode })
    .then((result) => {
      if (result.success) {
        console.log('Post URL:', result.postUrl);
      } else {
        console.error('Error:', result.error);
        process.exit(1);
      }
    });
}
