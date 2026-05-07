import { Router, type IRouter } from "express";
import healthRouter from "./health";
import downloadRouter from "./download";
import signRouter from "./sign";

const router: IRouter = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use(signRouter);

export default router;
