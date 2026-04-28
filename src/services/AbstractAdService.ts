export type RewardedAdCallback = () => void;

type AdPlatform = "yandex" | "ios" | "itch";

const YANDEX_SESSION_BLOCK_MS = 30_000;

function detectAdPlatform(): AdPlatform {
  if (typeof window === "undefined") return "itch";
  const w = window as Window & {
    YaGames?: unknown;
    ysdk?: unknown;
    webkit?: { messageHandlers?: Record<string, { postMessage?: (payload?: unknown) => void }> };
  };
  const ua = navigator.userAgent.toLowerCase();
  const host = window.location.hostname.toLowerCase();
  if (w.YaGames || w.ysdk || host.includes("yandex") || ua.includes("yabrowser")) {
    return "yandex";
  }
  if (w.webkit?.messageHandlers?.rewardedVideo || /iphone|ipad|ipod/.test(ua)) {
    return "ios";
  }
  return "itch";
}

async function loadYandexSdk(): Promise<unknown | null> {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    YaGames?: { init?: () => Promise<unknown> };
    ysdk?: unknown;
  };
  if (w.ysdk) return w.ysdk;
  if (!w.YaGames || typeof w.YaGames.init !== "function") return null;
  try {
    const sdk = await w.YaGames.init();
    w.ysdk = sdk;
    return sdk;
  } catch {
    return null;
  }
}

export class AbstractAdService {
  private readonly sessionStartedAt = Date.now();

  async showRewarded(onRewarded: RewardedAdCallback): Promise<boolean> {
    const platform = detectAdPlatform();
    if (platform === "yandex") {
      return this.showYandexRewarded(onRewarded);
    }
    if (platform === "ios") {
      return this.showIosRewarded(onRewarded);
    }
    onRewarded();
    return true;
  }

  private async showYandexRewarded(onRewarded: RewardedAdCallback): Promise<boolean> {
    if (Date.now() - this.sessionStartedAt < YANDEX_SESSION_BLOCK_MS) {
      return false;
    }
    const sdk = (await loadYandexSdk()) as
      | {
          adv?: {
            showRewardedVideo?: (opts: {
              callbacks?: {
                onRewarded?: () => void;
                onClose?: () => void;
                onError?: () => void;
              };
            }) => void;
          };
        }
      | null;
    if (!sdk?.adv?.showRewardedVideo) return false;
    return await new Promise<boolean>((resolve) => {
      let rewarded = false;
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              rewarded = true;
              onRewarded();
            },
            onClose: () => resolve(rewarded),
            onError: () => resolve(false),
          },
        });
      } catch {
        resolve(false);
      }
    });
  }

  private async showIosRewarded(onRewarded: RewardedAdCallback): Promise<boolean> {
    try {
      const w = window as Window & {
        webkit?: { messageHandlers?: Record<string, { postMessage?: (payload?: unknown) => void }> };
      };
      const bridge = w.webkit?.messageHandlers?.rewardedVideo;
      if (bridge?.postMessage) {
        bridge.postMessage({ type: "showRewarded" });
        return false;
      }
    } catch {
      return false;
    }
    onRewarded();
    return true;
  }
}
