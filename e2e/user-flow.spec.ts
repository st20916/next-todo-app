import { expect, test, type Page } from "@playwright/test";

const EMAIL = "e2e@example.com";
const PASSWORD = "e2e-password-1234";

/** Registers the e2e member on first use, logs in on later runs within the same server. */
async function login(page: Page) {
  await page.goto("/register");
  await page.getByLabel("이메일").fill(EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
  await page.getByLabel("비밀번호 확인").fill(PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
  if (await page.getByText("이미 가입된 이메일입니다.").isVisible().catch(() => false)) {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(EMAIL);
    await page.getByLabel("비밀번호").fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
  }
  await expect(page).toHaveURL(/\/board\?date=\d{4}-\d{2}-\d{2}/);
}

async function addTodo(page: Page, title: string) {
  await page.getByRole("button", { name: "+ 할 일" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 추가" });
  await dialog.getByLabel("제목 *").fill(title);
  await dialog.getByLabel("주간 계획").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "추가" }).click();
  await expect(dialog).toBeHidden();
}

async function drag(page: Page, from: ReturnType<Page["locator"]>, to: ReturnType<Page["locator"]>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 12 });
  await page.mouse.up();
}

test("unauthenticated visitors are sent to /login and API returns 401", async ({ page, request }) => {
  await page.goto("/board");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/todos")).status()).toBe(401);
  expect((await request.get("/api/health")).status()).toBe(200);

  await page.getByLabel("이메일").fill(EMAIL);
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
});

test("PRD user flow: goal -> weekly plan -> todos -> drag to done -> progress", async ({ page }) => {
  await login(page);

  // 1. year goal
  await page.goto("/goals");
  await page.getByRole("button", { name: "+ 1년 목표" }).click();
  await page.getByLabel("목표 제목 *").fill("E2E 목표");
  await page.getByRole("button", { name: "목표 만들기" }).click();
  await expect(page.getByRole("link", { name: "E2E 목표" })).toBeVisible();

  // 2. weekly plan linked to the goal (defaults to the current Monday-Sunday)
  await page.goto("/weeks");
  await page.getByRole("button", { name: "+ 주간 계획" }).click();
  await page.getByLabel("제목 *").fill("E2E 주간");
  await page.getByLabel("1년 목표").selectOption({ index: 1 });
  await page.getByRole("button", { name: "계획 만들기" }).click();
  await expect(page.getByRole("link", { name: "E2E 주간" })).toBeVisible();
  await expect(page.getByText("0% · 0/0").first()).toBeVisible(); // no todos -> 0%

  // 3. three todos on today's board
  await page.goto("/board");
  await expect(page).toHaveURL(/\/board\?date=/);
  for (const t of ["할일 A", "할일 B", "할일 C"]) await addTodo(page, t);
  const todoCol = page.getByRole("region", { name: "할 일", exact: true });
  const doneCol = page.getByRole("region", { name: "완료", exact: true });
  await expect(todoCol.getByText("할일 A")).toBeVisible();
  await expect(todoCol.getByText("할일 C")).toBeVisible();

  // 4-6. drag A to the done column
  const moved = page.waitForResponse(
    (r) => r.url().includes("/api/todos/") && r.url().endsWith("/move") && r.request().method() === "PATCH",
  );
  await drag(page, page.locator('li[aria-label^="할일 A"]'), doneCol);
  expect((await moved).status()).toBe(200);
  await expect(doneCol.getByText("할일 A")).toBeVisible();
  await expect(todoCol.getByText("할일 A")).toHaveCount(0);

  // persisted after reload
  await page.reload();
  await expect(page.getByRole("region", { name: "완료", exact: true }).getByText("할일 A")).toBeVisible();

  // 7. weekly and goal progress: 1 of 3 = 33%
  await page.goto("/weeks");
  await expect(page.getByText("33% · 1/3").first()).toBeVisible();
  await page.goto("/goals");
  await expect(page.getByText("33% · 1/3").first()).toBeVisible();

  // delete B -> 1 of 2 = 50% (confirm dialog required)
  await page.goto("/board");
  await page.locator('li[aria-label^="할일 B"]').getByRole("button", { name: "삭제" }).click();
  const confirm = page.getByRole("dialog", { name: "할 일 삭제" });
  await confirm.getByRole("button", { name: "취소" }).click();
  await expect(page.locator('li[aria-label^="할일 B"]')).toBeVisible(); // cancel keeps it
  await page.locator('li[aria-label^="할일 B"]').getByRole("button", { name: "삭제" }).click();
  await confirm.getByRole("button", { name: "삭제" }).click();
  await expect(page.locator('li[aria-label^="할일 B"]')).toHaveCount(0);

  await page.goto("/weeks");
  await expect(page.getByText("50% · 1/2").first()).toBeVisible();

  // goal screen shows the connected weekly plan and its progress
  await page.goto("/goals");
  await page.getByRole("link", { name: "E2E 목표" }).first().click();
  await expect(page.getByRole("link", { name: "E2E 주간" })).toBeVisible();
  await expect(page.getByText("50% · 1/2").first()).toBeVisible();
});

test("period integrity: a todo outside the weekly plan period cannot be linked", async ({ page }) => {
  await login(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "+ 할 일" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 추가" });
  await dialog.getByLabel("날짜").fill("2031-01-15");
  const plan = dialog.getByLabel("주간 계획");
  // every existing plan is this year's week, so each option is disabled for 2031
  const options = plan.locator("option:not([value=''])");
  expect(await options.count()).toBeGreaterThan(0);
  const disabled = await options.evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).disabled));
  expect(disabled.every(Boolean)).toBe(true);
});

test("P1: unlinked list, URL filters and carry-over", async ({ page }) => {
  await login(page);
  await page.goto("/board");
  await expect(page).toHaveURL(/\/board\?date=/);

  // two unlinked todos: one doing, one done
  for (const [title, status] of [["이월대상", "doing"], ["끝난일", "done"]] as const) {
    await page.getByRole("button", { name: "+ 할 일" }).click();
    const dialog = page.getByRole("dialog", { name: "할 일 추가" });
    await dialog.getByLabel("제목 *").fill(title);
    await dialog.getByRole("button", { name: "추가" }).click();
    await expect(dialog).toBeHidden();
    const from = page.locator(`li[aria-label^="${title}"]`);
    const col = page.getByRole("region", { name: status === "doing" ? "진행 중" : "완료", exact: true });
    const moved = page.waitForResponse((r) => r.url().endsWith("/move") && r.request().method() === "PATCH");
    await drag(page, from, col);
    expect((await moved).status()).toBe(200);
  }

  // unlinked view lists them
  await page.goto("/todos?unlinked=true");
  await expect(page.getByRole("heading", { name: "미연결 할 일" })).toBeVisible();
  await expect(page.getByText("이월대상")).toBeVisible();
  await expect(page.getByText("끝난일")).toBeVisible();

  // status filter is reflected in the URL and narrows the list
  await page.getByLabel("상태").selectOption("doing");
  await page.getByRole("button", { name: "적용" }).click();
  await expect(page).toHaveURL(/status=doing/);
  await expect(page.getByText("이월대상")).toBeVisible();
  await expect(page.getByText("끝난일")).toHaveCount(0);

  // carry-over moves only the unfinished one and keeps its status
  await page.goto("/board");
  const carryButton = page.getByRole("button", { name: /미완료 \d+개 다음 날로 이월/ });
  await expect(carryButton).toBeEnabled();
  await carryButton.click();
  await expect(page.getByText(/개를 \d{4}-\d{2}-\d{2}로 이월했습니다/)).toBeVisible();
  await expect(page.getByText("이월대상")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "완료", exact: true }).getByText("끝난일")).toBeVisible();
  await page.getByRole("link", { name: "다음 날" }).click();
  await expect(page.getByRole("region", { name: "진행 중", exact: true }).getByText("이월대상")).toBeVisible();
});
