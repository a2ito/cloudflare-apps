import { describe, expect, it } from "vitest";
import { pickEnglishVoice } from "./speech";

const voice = (lang: string, localService = false, isDefault = false) => ({
  lang,
  localService,
  default: isDefault,
});

describe("pickEnglishVoice", () => {
  it("アメリカ英語の端末内の声を優先する", () => {
    const picked = pickEnglishVoice([
      voice("ja-JP", true, true),
      voice("en-GB", true),
      voice("en-US"),
      voice("en-US", true),
    ]);
    expect(picked).toEqual(voice("en-US", true));
  });

  it("アメリカ英語が無ければほかの英語の声を使う", () => {
    expect(pickEnglishVoice([voice("ja-JP", true), voice("en_GB")])).toEqual(
      voice("en_GB"),
    );
  });

  it("英語の声が無ければ null", () => {
    expect(pickEnglishVoice([voice("ja-JP", true, true)])).toBeNull();
    expect(pickEnglishVoice([])).toBeNull();
  });
});
