import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const TEST_USER = `e2e_${Date.now()}`;
const TEST_PASS = "test1234";

test.describe("RAG Full Flow", () => {
  test("register → login → create KB → upload doc → chat", async ({ page }) => {
    // 1. Register
    await page.goto(`${BASE}/register`);
    await page.fill('input[autocomplete="username"]', TEST_USER);
    await page.fill('input[autocomplete="new-password"]', TEST_PASS);
    // confirm password
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(1).fill(TEST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/");
    await expect(page.locator(".logo")).toBeVisible();

    // 2. Create KB
    await page.click('button:has-text("新建知识库")');
    await page.fill('input[placeholder*="技术文档库"]', "E2E测试库");
    await page.click('button:has-text("创建")');
    await page.waitForURL("**/kb/**");

    // 3. Upload document
    await page.click('button:has-text("文档管理")');
    // Create a temp file via input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "e2e-test.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 考勤制度\n年假5天\n婚假3天\n产假98天"),
    });
    await page.waitForTimeout(2000);

    // 4. Go to chat and ask
    await page.click('button:has-text("问答")');
    await page.fill('input[type="text"]', "年假有多少天？");
    await page.click('button:has-text("发送")');

    // 5. Verify answer
    await page.waitForTimeout(5000);
    const answer = page.locator(".bubble.assistant .content");
    await expect(answer.first()).not.toBeEmpty({ timeout: 30000 });
  });
});
