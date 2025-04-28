import { persistentAtom } from "@nanostores/persistent";
import type { Setting } from "../type";
import { stunServers } from "../configs";
import { starWars, uniqueNamesGenerator } from "unique-names-generator";

export const defaultSetting: Setting = {
  iceServer: stunServers[0],
  name: uniqueNamesGenerator({
    dictionaries: [starWars],
  }),
  autoDownload: true,
};

export const settingAtom = persistentAtom<Setting>("setting", defaultSetting, {
  encode: JSON.stringify,
  decode: JSON.parse,
});
