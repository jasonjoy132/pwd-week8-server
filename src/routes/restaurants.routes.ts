import { Router } from "express";
import { isAuthenticated, requireAdmin } from "../middleware/auth.middleware";
import * as controller from "../controllers/restaurants.controller";
const router = Router();
router.get("/", controller.list);
router.get("/popular", controller.popular);
router.get("/:id", controller.get);
// [이론: 사용자 식별] 현재 요청의 사용자와 권한을 확인합니다. 맛집 행에 생성자 UUID를 기록하는 기능은 아닙니다.
router.post("/", isAuthenticated, requireAdmin, controller.create);
router.put("/:id", isAuthenticated, requireAdmin, controller.update);
router.delete("/:id", isAuthenticated, requireAdmin, controller.remove);
export default router;
