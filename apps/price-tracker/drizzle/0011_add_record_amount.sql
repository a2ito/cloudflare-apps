-- 価格記録ごとに 1 個あたりの容量を上書きできるようにする。
-- 既存の記録は NULL のままで、荷姿の容量を使う
ALTER TABLE `price_records` ADD `amount` real;
