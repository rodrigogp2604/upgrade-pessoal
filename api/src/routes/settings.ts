import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import { getPublicSettings, putSetting } from "../services/settings.service";

export const settingsRouter = Router();

// todas as configs como objeto { key: value } — menos as escondidas (ver settings.service)
settingsRouter.get(
  "/",
  route(async (_req, res) => {
    res.json(await getPublicSettings());
  })
);

const putSchema = z.object({ value: z.string() });

settingsRouter.put(
  "/:key",
  route(async (req, res) => {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await putSetting(req.params.key, parsed.data.value));
  })
);
