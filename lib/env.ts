export const env = {
  genesisBaseUrl: process.env.GENESIS_BASE_URL || "https://gas.copycoders.ai/api/v1",
  genesisKey: process.env.GENESIS_API_KEY || "",
  marioSlug: process.env.MARIO_SLUG || "mario-bot-",
  openrouterKey: process.env.OPENROUTER_API_KEY || "",
  visionModel: process.env.VISION_MODEL || "google/gemini-3.8-flash",
  scrapeCreatorsKey: process.env.SCRAPECREATORS_API_KEY || "",
};

export function keyStatus() {
  return {
    genesis: Boolean(env.genesisKey),
    openrouter: Boolean(env.openrouterKey),
    scrapecreators: Boolean(env.scrapeCreatorsKey),
  };
}
