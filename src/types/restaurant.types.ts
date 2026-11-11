export interface RestaurantData {
  id: number;
  name: string;
  category: string;
  location: string;
  priceRange: string;
  rating: number;
  description: string;
  recommendedMenu: string[];
  likes: number;
  image: string;
}

// 모델은 숫자로 전달되거나 문자열로 전달된 값을 모두 숫자로 정규화합니다.
export interface RestaurantInput {
  id: number | string;
  name: string;
  category: string;
  location: string;
  priceRange: string;
  rating: number | string;
  description: string;
  recommendedMenu?: string[];
  likes?: number | string;
  image?: string;
}

export interface CreateRestaurantInput {
  name: string;
  category: string;
  location: string;
  priceRange?: string;
  rating?: number | string;
  description?: string;
  recommendedMenu?: string[];
  image?: string;
}

// HTTP 요청에는 필드가 빠질 수 있으므로 서비스에서 필수 값을 확인합니다.
export type CreateRestaurantBody = Omit<
  Partial<CreateRestaurantInput>,
  "recommendedMenu"
> & {
  recommendedMenu?: unknown;
};
