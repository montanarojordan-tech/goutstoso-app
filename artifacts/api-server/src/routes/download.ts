import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/download/goutstoso", (_req, res) => {
  const candidates = [
    path.resolve(__dirname, "..", "goutstoso-infomaniak.tar.gz"),
    path.resolve(process.cwd(), "artifacts", "api-server", "goutstoso-infomaniak.tar.gz"),
    path.resolve(process.cwd(), "goutstoso-infomaniak.tar.gz"),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="goutstoso-infomaniak.tar.gz"');
  res.setHeader("Content-Type", "application/gzip");
  res.sendFile(filePath);
});

export default router;
