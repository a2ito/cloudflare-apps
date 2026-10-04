-- プロテインやサプリを置くカテゴリを足す。
-- 画面から同じ名前で先に作られていても失敗しないよう、名前の一意制約に当たれば何もしない
INSERT OR IGNORE INTO `categories` (`name`) VALUES ('健康食品・サプリ');
