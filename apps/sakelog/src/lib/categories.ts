/**
 * お酒の種類と、種類ごとに変わるものの定義。
 *
 * 保存する値・フォームの選択肢・一覧の絞り込み・詳細の表示・ガイド画面を、すべてここから
 * 組み立てる。種類を増やすときはこの配列に 1 つ足す（DB のカラムを増やすのは固有項目を
 * 足すときだけ）。env にも drizzle にも触れないので、クライアントからも読める。
 *
 * 材料と分類に付けた note は、入力欄の候補としてだけでなく /guide にも出す。
 * 「この品種はどんな味か」を思い出せないまま記録するのを避けるため、
 * 解説を別の場所に持たず、候補と同じ 1 か所に置いている。
 */

export const CATEGORIES = [
  "wine",
  "beer",
  "sake",
  "shochu",
  "whisky",
  "gin",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** 名前と、一言の説明。材料と分類の両方で使う */
export type Term = { name: string; note: string };

/**
 * 種類ごとの固有項目。DB の列と 1 対 1 で対応する。
 * どの種類でどれを出すかは CATEGORY_DEFS の fields が決める。
 */
export const SPECIFIC_FIELDS = {
  /** 日本酒: 精米歩合（%）。磨くほど小さい */
  polishingRate: {
    label: "精米歩合",
    unit: "%",
    kind: "integer",
    min: 1,
    max: 100,
    placeholder: "50",
    note: "米をどれだけ削ったか。数字が小さいほど雑味が減り、華やかで軽い味になりやすい",
  },
  /** 日本酒度。+ が辛口、- が甘口 */
  sakeMeterValue: {
    label: "日本酒度",
    unit: "",
    kind: "decimal",
    min: -30,
    max: 30,
    placeholder: "+3",
    note: "糖分の目安。+ が大きいほど辛口、- が大きいほど甘口",
  },
  /** 日本酒: 酸度 */
  acidity: {
    label: "酸度",
    unit: "",
    kind: "decimal",
    min: 0,
    max: 10,
    placeholder: "1.4",
    note: "1.4 前後が標準。高いほど味が濃く感じられ、低いほど淡麗に感じる",
  },
  /** ウイスキー: 熟成年数。NAS（年数表記なし）なら空 */
  agedYears: {
    label: "熟成年数",
    unit: "年",
    kind: "integer",
    min: 0,
    max: 100,
    placeholder: "12",
    note: "樽で寝かせた年数。長いほど樽由来の香りが濃く、まろやかになりやすい",
  },
  /** ウイスキー: 樽の種類 */
  caskType: {
    label: "樽",
    unit: "",
    kind: "text",
    placeholder: "シェリー / バーボン",
    note: "シェリー樽はレーズンや甘い香り、バーボン樽はバニラや蜂蜜の香りが出やすい",
  },
  /** ビール: 苦さの指標 */
  ibu: {
    label: "IBU",
    unit: "",
    kind: "integer",
    min: 0,
    max: 200,
    placeholder: "45",
    note: "苦さの指標。ラガーは 10〜20、IPA は 40〜70 あたりが目安",
  },
  /** 焼酎: 蒸留方法 */
  distillation: {
    label: "蒸留",
    unit: "",
    kind: "choice",
    choices: ["常圧", "減圧", "その他"],
    placeholder: "",
    note: "常圧は原料の香りが濃く出る。減圧はすっきり軽く、クセが穏やかになる",
  },
} as const;

export type SpecificField = keyof typeof SPECIFIC_FIELDS;

export const SPECIFIC_FIELD_KEYS = Object.keys(
  SPECIFIC_FIELDS,
) as SpecificField[];

export type CategoryDef = {
  key: Category;
  label: string;
  emoji: string;
  /** ガイドに出す、その種類の成り立ちと味の見どころ */
  description: string;
  /** 造り手の呼び方。種類で変わる（生産者 / 蔵元 / ブルワリー / 蒸留所） */
  makerLabel: string;
  /** 材料タグの呼び方（品種 / ホップ / 酒米 / ボタニカル） */
  ingredientLabel: string;
  /** 材料タグの入力候補と、その特性 */
  ingredients: readonly Term[];
  /** サブ種別の候補と説明。自由入力も許すので、あくまで候補 */
  styles: readonly Term[];
  /** 年の欄を出すか。出す場合の呼び方（ヴィンテージ / 蒸留年） */
  yearLabel: string | null;
  /** この種類でだけ出す入力欄 */
  fields: readonly SpecificField[];
};

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  {
    key: "wine",
    label: "ワイン",
    emoji: "🍷",
    description:
      "ブドウを発酵させた醸造酒。品種・産地・造り方で味が大きく変わる。渋み（タンニン）は主に果皮と種から来るため、果皮ごと発酵させる赤は渋く、果汁だけで造る白は酸が主役になる。",
    makerLabel: "生産者",
    ingredientLabel: "品種",
    ingredients: [
      {
        name: "カベルネ・ソーヴィニヨン",
        note: "渋みと骨格が強い赤。カシスや杉の香り。熟成で丸くなる",
      },
      {
        name: "メルロー",
        note: "渋みが穏やかでまろやかな赤。プラムのような果実味。飲みやすい",
      },
      {
        name: "ピノ・ノワール",
        note: "色は淡いが香りは華やか。赤い果実ときのこ。渋みは軽く酸がきれい",
      },
      {
        name: "シラー",
        note: "黒胡椒のようなスパイス感と濃い果実味。産地により力強さが変わる",
      },
      {
        name: "ネッビオーロ",
        note: "バローロの品種。強い渋みと高い酸、バラやタールの香り。長期熟成向き",
      },
      {
        name: "サンジョヴェーゼ",
        note: "キャンティの主役。酸が高くチェリーの風味。トマト料理と合う",
      },
      {
        name: "テンプラニーリョ",
        note: "スペインの主要品種。樽熟成でバニラや革の香りが乗る",
      },
      {
        name: "シャルドネ",
        note: "産地と造りで激変する白。樽を使うとバター香、冷涼地ではシャープな酸",
      },
      {
        name: "ソーヴィニヨン・ブラン",
        note: "ハーブや柑橘の香りが立つ辛口白。酸が高く爽やか",
      },
      {
        name: "リースリング",
        note: "白。柑橘と石のような香り。辛口から甘口まで幅広く、酸が命",
      },
      {
        name: "甲州",
        note: "日本固有の白。穏やかな香りと軽い苦味。和食に寄り添う",
      },
      {
        name: "マスカット・ベーリーA",
        note: "日本の赤。イチゴやキャンディのような甘い香り。渋みは軽い",
      },
    ],
    styles: [
      {
        name: "赤",
        note: "黒ブドウを果皮ごと発酵。渋みがあり常温〜やや低温で飲む",
      },
      { name: "白", note: "果汁を発酵。酸が主役で冷やして飲む" },
      { name: "ロゼ", note: "赤の造りを途中で止めたもの。果実味と軽さの中間" },
      {
        name: "スパークリング",
        note: "瓶内二次発酵などで泡を持たせたもの。シャンパーニュが代表",
      },
      {
        name: "オレンジ",
        note: "白ブドウを果皮ごと発酵。白なのに渋みがあり、香りが複雑",
      },
      {
        name: "酒精強化",
        note: "発酵中にアルコールを加えて止めたもの。シェリーやポート",
      },
      {
        name: "デザート",
        note: "貴腐や陰干しで糖度を上げた甘口。少量をゆっくり飲む",
      },
    ],
    yearLabel: "ヴィンテージ",
    fields: [],
  },
  {
    key: "beer",
    label: "ビール",
    emoji: "🍺",
    description:
      "麦芽を糖化して発酵させた醸造酒。上面発酵のエールは香り豊かで常温寄り、下面発酵のラガーはすっきり冷やして飲む。ホップは苦味と香りの両方を担う。",
    makerLabel: "ブルワリー",
    ingredientLabel: "ホップ・原料",
    ingredients: [
      {
        name: "シトラ",
        note: "グレープフルーツやライチのような華やかな柑橘香。IPA の定番",
      },
      {
        name: "モザイク",
        note: "トロピカルフルーツとベリー。香りが厚く、ヘイジーで多用される",
      },
      {
        name: "ギャラクシー",
        note: "パッションフルーツや桃。豪州産で香りが強い",
      },
      {
        name: "カスケード",
        note: "アメリカンペールエールの象徴。グレープフルーツと花の香り",
      },
      {
        name: "ネルソンソーヴィン",
        note: "白ワインのような香り。白ブドウを思わせる独特さ",
      },
      {
        name: "ザーツ",
        note: "チェコのピルスナーの伝統ホップ。穏やかで上品な苦味",
      },
      {
        name: "小麦",
        note: "麦芽の一部を小麦に。泡持ちが良く、口当たりがやわらかい",
      },
      {
        name: "オーツ",
        note: "とろりとした口当たりを出す。ヘイジー IPA やスタウトで使う",
      },
    ],
    styles: [
      {
        name: "IPA",
        note: "ホップを大量に使う。強い苦味と華やかな香り。度数はやや高め",
      },
      {
        name: "ヘイジーIPA",
        note: "濁った外観。苦味は控えめでトロピカルな香りとジューシーさが主役",
      },
      {
        name: "ペールエール",
        note: "IPA より穏やか。麦の甘みとホップ香のバランスが良い",
      },
      {
        name: "ピルスナー",
        note: "淡色ラガー。すっきりしてキレがあり、苦味は上品",
      },
      { name: "ラガー", note: "低温で発酵・熟成。クセが少なく飲みやすい" },
      {
        name: "ヴァイツェン",
        note: "小麦のビール。バナナやクローブのような酵母由来の香り",
      },
      {
        name: "スタウト",
        note: "焙煎麦芽の黒ビール。コーヒーやチョコレートの香ばしさ",
      },
      {
        name: "ポーター",
        note: "スタウトより軽めの黒。ロースト感とカラメルの甘み",
      },
      {
        name: "セゾン",
        note: "ベルギー発の農家のビール。スパイシーでドライ、酸が心地よい",
      },
      {
        name: "サワー",
        note: "乳酸などで酸味を持たせたもの。果実を加えることも多い",
      },
      {
        name: "ベルジャン",
        note: "酵母由来の複雑な香り。度数が高くても飲み口は軽い",
      },
    ],
    yearLabel: null,
    fields: ["ibu"],
  },
  {
    key: "sake",
    label: "日本酒",
    emoji: "🍶",
    description:
      "米・米麹・水で造る醸造酒。麹が米のでんぷんを糖に変え、同時に酵母が発酵する並行複発酵が特徴。精米歩合が小さいほど華やかで軽く、大きいほど米の旨みが濃く出やすい。",
    makerLabel: "蔵元",
    ingredientLabel: "酒米",
    ingredients: [
      {
        name: "山田錦",
        note: "酒米の王様。バランスが良く、華やかで上品な酒になりやすい",
      },
      { name: "五百万石", note: "北陸中心。淡麗ですっきりした軽快な味わい" },
      {
        name: "美山錦",
        note: "長野など寒冷地。硬質でシャープ、キレのある酒質",
      },
      {
        name: "雄町",
        note: "岡山中心の古い品種。ふくよかで濃く、独特の野性味がある",
      },
      {
        name: "愛山",
        note: "希少。甘みと厚みが強く、とろりとした濃醇な味わい",
      },
      {
        name: "亀の尾",
        note: "復活した古米。酸と旨みがしっかりして骨格がある",
      },
      { name: "八反錦", note: "広島。穏やかな香りと軽快な後味" },
    ],
    styles: [
      {
        name: "純米大吟醸",
        note: "米と米麹のみ・精米 50% 以下。華やかな香りと繊細な味",
      },
      {
        name: "大吟醸",
        note: "醸造アルコールを少量添加・精米 50% 以下。香りが立ちキレが良い",
      },
      {
        name: "純米吟醸",
        note: "米と米麹のみ・精米 60% 以下。香りと旨みのバランスが良い",
      },
      { name: "吟醸", note: "精米 60% 以下。軽快で香り高い" },
      { name: "特別純米", note: "精米や造りに特別な工夫。旨みがしっかり" },
      { name: "純米", note: "米と米麹のみ。米の旨みと厚みが出る。燗にも向く" },
      {
        name: "本醸造",
        note: "醸造アルコールを少量添加。すっきりして食中に向く",
      },
      { name: "生酛", note: "乳酸菌を自然に取り込む伝統製法。酸が豊かで複雑" },
      { name: "山廃", note: "生酛の工程を一部省いたもの。濃厚で野性的な旨み" },
    ],
    yearLabel: null,
    fields: ["polishingRate", "sakeMeterValue", "acidity"],
  },
  {
    key: "shochu",
    label: "焼酎",
    emoji: "🍠",
    description:
      "麹で糖化させたもろみを蒸留する日本の蒸留酒。原料の個性がそのまま香りに出る。蒸留方法（常圧か減圧か）で印象が大きく変わり、水割り・お湯割りで香りの開き方も変わる。",
    makerLabel: "蔵元",
    ingredientLabel: "原料",
    ingredients: [
      {
        name: "芋",
        note: "甘く濃い香り。品種と麹で花のような華やかさから土の香りまで幅広い",
      },
      { name: "麦", note: "香ばしく軽快。クセが少なく飲みやすい" },
      { name: "米", note: "やわらかい甘みと丸み。日本酒に近い穏やかな香り" },
      {
        name: "黒糖",
        note: "奄美産。ほのかな甘い香りがあるが、味わいはすっきり辛口",
      },
      { name: "そば", note: "穏やかで上品な香り。クセがなく飲み飽きない" },
      {
        name: "泡盛",
        note: "沖縄。黒麹と全麹仕込みで濃厚。熟成させた古酒はまろやか",
      },
    ],
    styles: [
      { name: "芋", note: "鹿児島・宮崎が中心。お湯割りで香りが開く" },
      { name: "麦", note: "大分・壱岐が中心。ロックや水割りで軽快に" },
      { name: "米", note: "熊本・球磨が中心。冷やしても燗でも" },
      { name: "黒糖", note: "奄美群島のみで製造が認められている" },
      { name: "そば", note: "宮崎など。香りは穏やか" },
      { name: "泡盛", note: "沖縄の伝統酒。3 年以上寝かせたものが古酒" },
    ],
    yearLabel: null,
    fields: ["distillation"],
  },
  {
    key: "whisky",
    label: "ウイスキー",
    emoji: "🥃",
    description:
      "穀物を発酵・蒸留し、木樽で熟成させた酒。色と香りの多くは樽から来る。ピート（泥炭）で麦芽を乾燥させると、スモーキーで薬品的な香りが付く。加水すると香りが開くことが多い。",
    makerLabel: "蒸留所",
    ingredientLabel: "原料",
    ingredients: [
      {
        name: "モルト",
        note: "大麦麦芽のみ。原料の個性と蒸留所の癖が出やすい",
      },
      {
        name: "グレーン",
        note: "トウモロコシや小麦。軽くて甘く、ブレンドの土台になる",
      },
      { name: "コーン", note: "バーボンの主原料。甘くふくよかな味わい" },
      { name: "ライ麦", note: "スパイシーでドライ。ピリッとした刺激がある" },
      {
        name: "ピート",
        note: "麦芽を乾かす泥炭。煙・ヨード・正露丸に例えられる香りが付く",
      },
    ],
    styles: [
      {
        name: "シングルモルト",
        note: "一つの蒸留所の大麦麦芽のみ。個性がはっきり出る",
      },
      {
        name: "ブレンデッド",
        note: "モルトとグレーンを混ぜたもの。バランス型で飲みやすい",
      },
      {
        name: "ブレンデッドモルト",
        note: "複数蒸留所のモルトのみを混ぜたもの",
      },
      {
        name: "バーボン",
        note: "米国。コーン主体で新樽熟成。バニラと甘い香りが濃い",
      },
      { name: "ライ", note: "ライ麦主体。辛口でスパイシー。カクテル向き" },
      { name: "グレーン", note: "穀物主体で軽快。加水やハイボールで映える" },
      {
        name: "ジャパニーズ",
        note: "繊細でバランス重視。ミズナラ樽は白檀のような香りが出る",
      },
    ],
    yearLabel: "蒸留年",
    fields: ["agedYears", "caskType"],
  },
  {
    key: "gin",
    label: "ジン",
    emoji: "🍸",
    description:
      "蒸留酒にボタニカル（草根木皮）で香りを付けた酒。ジュニパーベリーの香りが必須で、それ以外の組み合わせが銘柄の個性になる。近年は地域の素材を使うクラフトジンが多い。",
    makerLabel: "蒸留所",
    ingredientLabel: "ボタニカル",
    ingredients: [
      {
        name: "ジュニパーベリー",
        note: "ジンに必須。針葉樹のような清涼感のある香りの芯",
      },
      {
        name: "コリアンダー",
        note: "柑橘とスパイスの中間。ジュニパーの次に使われる定番",
      },
      {
        name: "アンジェリカ",
        note: "土と麝香の香り。他のボタニカルをまとめる役",
      },
      { name: "レモンピール", note: "明るい柑橘の香り。軽快さを出す" },
      {
        name: "柚子",
        note: "和柑橘。丸みのある華やかな香りでジャパニーズジンの定番",
      },
      {
        name: "山椒",
        note: "痺れるような刺激と爽やかさ。和のクラフトジンで人気",
      },
      { name: "カルダモン", note: "甘く上品なスパイス。余韻に複雑さを足す" },
      { name: "桜", note: "花と葉の香り。優しい甘さを感じさせる" },
    ],
    styles: [
      {
        name: "ロンドンドライ",
        note: "甘味を加えない辛口。ジュニパーがはっきり立つ王道",
      },
      { name: "ドライ", note: "辛口全般。産地や製法の制約はゆるい" },
      { name: "オールドトム", note: "わずかに甘味を持たせた古典的なスタイル" },
      {
        name: "スロー",
        note: "スピノサスモモを漬け込んだ甘酸っぱいリキュール寄り",
      },
      {
        name: "クラフト",
        note: "小規模蒸留所が地域の素材を使うもの。個性が振り切れている",
      },
      {
        name: "ネイビーストレングス",
        note: "度数 57% 前後の高アルコール。香りが濃く出る",
      },
    ],
    yearLabel: null,
    fields: [],
  },
  {
    key: "other",
    label: "その他",
    emoji: "🥂",
    description:
      "上のどれにも当てはまらないもの（ラム・テキーラ・リキュール・シードルなど）。",
    makerLabel: "造り手",
    ingredientLabel: "原料",
    ingredients: [],
    styles: [],
    yearLabel: null,
    fields: [],
  },
];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** 未知の値でも画面を壊さないよう、その他の定義で受ける */
export function categoryDef(value: string): CategoryDef {
  return (
    CATEGORY_DEFS.find((c) => c.key === value) ??
    CATEGORY_DEFS[CATEGORY_DEFS.length - 1]
  );
}

export function categoryLabel(value: string): string {
  return CATEGORY_DEFS.find((c) => c.key === value)?.label ?? value;
}

export function categoryEmoji(value: string): string {
  return categoryDef(value).emoji;
}

/** その種類で意味を持つ固有項目か（他の種類の値が紛れ込むのを防ぐ） */
export function allowsField(category: string, field: SpecificField): boolean {
  return categoryDef(category).fields.includes(field);
}

/** 材料や分類の説明を引く（ガイドと詳細画面で使う）。知らない名前なら null */
export function termNote(category: string, name: string): string | null {
  const def = categoryDef(category);
  const needle = name.trim().toLowerCase();
  const found =
    def.ingredients.find((t) => t.name.toLowerCase() === needle) ??
    def.styles.find((t) => t.name.toLowerCase() === needle);
  return found?.note ?? null;
}
