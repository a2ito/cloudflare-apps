-- 荷姿（容量・入数）を商品から切り出し、荷姿違いを 1 つの商品にまとめる。
-- 最安値は荷姿ごとに判定するので、価格記録は荷姿に紐づける。

-- 1. 荷姿を作る。既存の商品 1 件につき 1 件、id を商品と同じにして、
--    価格記録の product_id をそのまま variant_id として使えるようにする
CREATE TABLE `variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`amount` real NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);
--> statement-breakpoint
INSERT INTO `variants` (`id`, `product_id`, `amount`, `count`, `created_at`)
SELECT `id`, `id`, `amount`, `count`, `created_at` FROM `products`;
--> statement-breakpoint

-- 2. 価格記録を作り直し、荷姿を参照させる
CREATE TABLE `__new_price_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`store` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`recorded_at` text NOT NULL,
	`url` text,
	`image_key` text,
	`memo` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_price_records` (`id`, `variant_id`, `store`, `price`, `quantity`, `recorded_at`, `url`, `image_key`, `memo`, `created_at`)
SELECT `id`, `product_id`, `store`, `price`, `quantity`, `recorded_at`, `url`, `image_key`, `memo`, `created_at` FROM `price_records`;
--> statement-breakpoint
DROP TABLE `price_records`;
--> statement-breakpoint
ALTER TABLE `__new_price_records` RENAME TO `price_records`;
--> statement-breakpoint
CREATE INDEX `price_records_variant_idx` ON `price_records` (`variant_id`);
--> statement-breakpoint

-- 3. 0005 で荷姿ごとに分けた商品をまとめる。
--    名前が「元の名前 + 空白 + 容量 + 単位」で終わる商品から元の名前を取り出す。
--    容量の書き方は 0005 と同じく、整数なら小数点以下を落とす。
--    LIKE は D1 でパターンが複雑すぎると弾かれるため、末尾を切り出して等値で判定する
CREATE TABLE `_variant_merge` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`base` text NOT NULL,
	`unit` text NOT NULL,
	`target_id` integer
);
--> statement-breakpoint
INSERT INTO `_variant_merge` (`product_id`, `base`, `unit`)
SELECT id, substr(name, 1, length(name) - length(suffix)), unit
FROM (
  SELECT id, name, unit,
    ' ' ||
      CASE WHEN amount = CAST(amount AS INTEGER)
        THEN CAST(CAST(amount AS INTEGER) AS TEXT)
        ELSE CAST(amount AS TEXT) END
      || unit AS suffix
  FROM products
)
WHERE length(name) > length(suffix) AND substr(name, -length(suffix)) = suffix;
--> statement-breakpoint

-- 4. 元の名前と単位が同じものが 2 件以上あれば、id の最も小さい商品へ寄せる。
--    1 件しか無いものは、利用者が付けた名前かもしれないので触らない
UPDATE `_variant_merge`
SET target_id = (
  SELECT MIN(m.product_id) FROM `_variant_merge` m
  WHERE m.base = `_variant_merge`.base AND m.unit = `_variant_merge`.unit
)
WHERE (
  SELECT COUNT(*) FROM `_variant_merge` m
  WHERE m.base = `_variant_merge`.base AND m.unit = `_variant_merge`.unit
) >= 2;
--> statement-breakpoint
DELETE FROM `_variant_merge` WHERE target_id IS NULL;
--> statement-breakpoint
UPDATE `variants`
SET product_id = (SELECT target_id FROM `_variant_merge` WHERE product_id = `variants`.product_id)
WHERE product_id IN (SELECT product_id FROM `_variant_merge`);
--> statement-breakpoint
UPDATE `products`
SET name = (SELECT base FROM `_variant_merge` WHERE product_id = `products`.id)
WHERE id IN (SELECT target_id FROM `_variant_merge`);
--> statement-breakpoint
-- 荷姿は付け替え済みなので、CASCADE で消えるものは無い
DELETE FROM `products`
WHERE id IN (SELECT product_id FROM `_variant_merge` WHERE product_id <> target_id);
--> statement-breakpoint
DROP TABLE `_variant_merge`;
--> statement-breakpoint

-- 5. 容量と入数は荷姿へ移したので商品から外す
ALTER TABLE `products` DROP COLUMN `amount`;
--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `count`;
