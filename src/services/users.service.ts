import { getSupabase, throwDatabaseError } from "../config/supabase";
import { profileResponse } from "../types/auth.types";
import HttpError from "../utils/httpError";
import { objectBody, textField, uuid } from "../utils/input";

export async function getAllUsers() {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data ?? []).map(profileResponse);
}
export async function updateProfile(id: string, body: unknown) {
  const input = objectBody(body);
  const update: { name?: string; avatar?: string } = {};
  if (input.name !== undefined)
    update.name = textField(input.name, "name", true, 80);
  if (input.avatar !== undefined)
    update.avatar = textField(input.avatar, "avatar");
  if (!Object.keys(update).length)
    throw new HttpError(400, "수정할 이름 또는 아바타를 입력하세요.");
  const { data, error } = await getSupabase()
    .from("profiles")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwDatabaseError(error);
  return profileResponse(data!);
}
export async function changeUserType(id: string, value: unknown) {
  const { userType } = objectBody(value);
  if (userType !== "user" && userType !== "admin")
    throw new HttpError(400, "userType은 user 또는 admin이어야 합니다.");
  const { data, error } = await getSupabase().rpc("set_foodmap_user_type", {
    p_user_id: uuid(id),
    p_user_type: userType,
  });
  if (error) throwDatabaseError(error);
  return profileResponse(data![0]);
}
export async function deactivateAccount(id: string) {
  const { error } = await getSupabase().rpc("deactivate_foodmap_account", {
    p_user_id: id,
  });
  if (error) throwDatabaseError(error);
}
