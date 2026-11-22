-- 商品そのものに付けていた売り切れの印をやめ、その商品の出品（価格の記録）すべてに移す。
-- 全部の出品が売れた商品は売り切れとして扱われるので、見え方は変わらない。
-- 出品が 1 件も無い商品は移す先が無いので、印をそのまま残す（使われないが、消すと情報が失われる）
UPDATE `price_records` SET `sold_out` = 1 WHERE `product_id` IN (SELECT `id` FROM `products` WHERE `sold_out` = 1);
--> statement-breakpoint
UPDATE `products` SET `sold_out` = 0 WHERE `sold_out` = 1 AND `id` IN (SELECT `product_id` FROM `price_records`);
