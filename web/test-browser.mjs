import { chromium } from "playwright";

export async function openBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    try {
      return await chromium.launch({ channel: "chrome" });
    } catch {
      throw new Error("请先执行 npx playwright install chromium，或安装 Google Chrome。", { cause: error });
    }
  }
}
