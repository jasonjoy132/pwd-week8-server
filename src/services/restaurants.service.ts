import { getSupabase, throwDatabaseError } from "../config/supabase";
import Restaurant from "../models/restaurant.model";
import type { RestaurantInsert } from "../types/database.types";
import HttpError from "../utils/httpError";
import { menuField, numericId, objectBody, textField } from "../utils/input";

function restaurantInput(
  value: unknown,
  partial = false,
): Partial<RestaurantInsert> {
  const input = objectBody(value);
  const row: Partial<RestaurantInsert> = {};
  for (const field of ["name", "category", "location"] as const) {
    if (!partial || input[field] !== undefined)
      row[field] = textField(input[field], field, true, 300);
  }
  for (const [external, column] of [
    ["priceRange", "price_range"],
    ["description", "description"],
    ["image", "image"],
  ] as const) {
    if (input[external] !== undefined)
      row[column] = textField(input[external], external);
  }
  if (input.rating !== undefined) {
    if (
      !["string", "number"].includes(typeof input.rating) ||
      input.rating === ""
    )
      throw new HttpError(400, "평점은 0~5 사이의 숫자여야 합니다.");
    const rating = Number(input.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5)
      throw new HttpError(400, "평점은 0~5 사이의 숫자여야 합니다.");
    row.rating = rating;
  }
  if (input.recommendedMenu !== undefined)
    row.recommended_menu = menuField(input.recommendedMenu);
  if (partial && !Object.keys(row).length)
    throw new HttpError(400, "수정할 값을 입력하세요.");
  return row;
}
export async function getAllRestaurants() {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .order("id");
  if (error) throwDatabaseError(error);
  return (data ?? []).map(Restaurant.fromDatabase);
}
export async function getRestaurantById(id: string) {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .eq("id", numericId(id))
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Restaurant not found");
  return Restaurant.fromDatabase(data);
}
export async function getPopularRestaurants(limit: unknown = "5") {
  if (
    typeof limit !== "string" ||
    !/^\d+$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 50
  )
    throw new HttpError(400, "limit은 1~50 사이의 정수여야 합니다.");
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .order("rating", { ascending: false })
    .order("id")
    .limit(Number(limit));
  if (error) throwDatabaseError(error);
  return (data ?? []).map(Restaurant.fromDatabase);
}
export async function createRestaurant(value: unknown) {
  const row = restaurantInput(value) as RestaurantInsert;
  const { data, error } = await getSupabase()
    .from("restaurants")
    .insert(row)
    .select("*")
    .single();
  if (error) throwDatabaseError(error);
  return Restaurant.fromDatabase(data!);
}
export async function updateRestaurant(id: string, value: unknown) {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .update(restaurantInput(value, true))
    .eq("id", numericId(id))
    .select("*")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Restaurant not found");
  return Restaurant.fromDatabase(data);
}
export async function deleteRestaurant(id: string) {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .delete()
    .eq("id", numericId(id))
    .select("id")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Restaurant not found");
}
