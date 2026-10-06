// Test-only entry: never referenced by wrangler.local.jsonc or production configuration.
import worker from "../src/index";
import { restoreBackup } from "../src/backup";
import type { Env } from "../src/types";
export default {
  async fetch(
    request: Request,
    env: Env & { RESTORE_DB: D1Database },
    ctx: ExecutionContext,
  ) {
    const path = new URL(request.url).pathname;
    if (path === "/__test/scheduled") {
      const body = (await request.json()) as { cron: string; time: number };
      await worker.scheduled(
        { cron: body.cron, scheduledTime: body.time } as ScheduledController,
        env,
        ctx,
      );
      return new Response("OK");
    }
    if (path === "/__test/restore") {
      const list = await env.BACKUPS!.list({ prefix: "daily/" });
      const object = await env.BACKUPS!.get(list.objects.at(-1)!.key);
      await restoreBackup(env.RESTORE_DB, await object!.text());
      const rows = await env.RESTORE_DB.prepare(
        "SELECT id FROM inquiries",
      ).all();
      return Response.json({ restored: rows.results.length });
    }
    return worker.fetch(request, env, ctx);
  },
};
