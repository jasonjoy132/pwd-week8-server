import HttpError from "./httpError";

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "JSON 객체를 입력하세요.");
  return value as Record<string, unknown>;
}
export function textField(
  value: unknown,
  field: string,
  required = false,
  max = 2000,
): string {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `'${field}' is required`);
    return "";
  }
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  ) {
    throw new HttpError(400, `'${field}' 값이 올바르지 않습니다.`);
  }
  return value.trim();
}
export function menuField(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  const menu: unknown =
    typeof value === "string" ? value.split(/[,\n]/) : value;
  if (
    !Array.isArray(menu) ||
    menu.length > 30 ||
    menu.some((item) => typeof item !== "string" || item.trim().length > 100)
  ) {
    throw new HttpError(400, "추천 메뉴는 문자열 배열이어야 합니다.");
  }
  return menu.map((item) => String(item).trim()).filter(Boolean);
}
export function numericId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new HttpError(400, "ID는 양의 정수여야 합니다.");
  return Number(value);
}
export function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, "사용자 ID가 올바르지 않습니다.");
  return value;
}
