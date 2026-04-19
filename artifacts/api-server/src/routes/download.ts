import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/download/goutstoso", (_req, res) => {
  const filePath = path.join(process.cwd(), "goutstoso-infomaniak.tar.gz");
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found", cwd: process.cwd() });
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="goutstoso-infomaniak.tar.gz"');
  res.setHeader("Content-Type", "application/gzip");
  res.sendFile(filePath);
});

export default router;
