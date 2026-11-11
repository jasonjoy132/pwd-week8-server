import asyncHandler from "../utils/asyncHandler";
import * as service from "../services/users.service";
export const profile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.auth } });
});
export const updateProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: await service.updateProfile(req.auth!.id, req.body) },
  });
});
export const list = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { users: await service.getAllUsers() } });
});
export const changeType = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: await service.changeUserType(req.params.userId, req.body) },
  });
});
export const deactivate = asyncHandler(async (req, res) => {
  await service.deactivateAccount(req.auth!.id);
  res.json({ success: true, message: "계정을 비활성화했습니다." });
});
