-- 새 프로젝트의 빈 restaurants에만 입력합니다. 기존 행을 덮어쓰지 않습니다.
begin;
lock table public.restaurants in exclusive mode;
do $$ begin
if not exists(select 1 from public.restaurants) then
insert into public.restaurants(id,name,category,location,price_range,rating,description,recommended_menu,likes,image) values
(1,'송림식당','한식','경기 수원시 영통구 월드컵로193번길 21 원천동','7,000-13,000원',4.99,'최고의 한식 맛집입니다.',array['순두부','김치찌개','소불고기','제육볶음']::text[],0,'https://mblogthumb-phinf.pstatic.net/MjAyMjA2MTJfODEg/MDAxNjU0OTYzNTM3MjE1.1BfmrmOsz_B6DBHAnhQSs6qfNIDnssofR-DrzMfigIIg.JHHDheG6ifJjtfKUqLss_mLXWFE9fNJ5BmepNUVXSOog.PNG.cary63/image.png?type=w966'),
(2,'별미떡볶이','분식','경기 수원시 영통구 아주로 42 아카데미빌딩','7,000-10,000원',4.92,'바삭한 튀김과 함께하는 행복한 한입',array['떡볶이','튀김','순대','어묵']::text[],0,'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA4MTJfMjcg%2FMDAxNzU0OTQ5ODk1Mjg0.GR6i3mNpJJXyqQrozGEJ65InCDBGlEmxc0aCeVHncJgg.sduDPX67J8hhoGxq4vLohpS4dXk1w-706dQLPfVs1iwg.JPEG%2Foutput%25A3%25DF1564208956.jpg'),
(3,'SOGO','일식','경기 수원시 영통구 월드컵로193번길 7','10,000-16,000원',4.89,'일식 맛집, 구 허수아비,',array['냉모밀','김치돈까스나베','코돈부르']::text[],0,'https://search.pstatic.net/common/?src=https%3A%2F%2Fldb-phinf.pstatic.net%2F20190707_63%2F1562462598960nPDMy_JPEG%2FW7iKQEhTMzCF3flC1t0pzgzF.jpeg.jpg');
perform pg_catalog.setval(pg_catalog.pg_get_serial_sequence('public.restaurants','id'),(select max(id) from public.restaurants),true);
end if;
end $$;
commit;
