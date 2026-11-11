import asyncHandler from "../utils/asyncHandler";
import * as service from "../services/restaurants.service";
export const list = asyncHandler(async (_req, res) => {
  res.json({ data: await service.getAllRestaurants() });
});
export const popular = asyncHandler(async (req, res) => {
  res.json({
    data: await service.getPopularRestaurants(req.query.limit ?? "5"),
  });
});
export const get = asyncHandler(async (req, res) => {
  res.json({ data: await service.getRestaurantById(req.params.id) });
});
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createRestaurant(req.body) });
});
export const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateRestaurant(req.params.id, req.body) });
});
export const remove = asyncHandler(async (req, res) => {
  await service.deleteRestaurant(req.params.id);
  res.status(204).send();
});
