// Loads the 10 sample posts into the database (no API keys needed).
import { loadDemo } from "../lib/demo";

loadDemo({ animate: false }).then(() => {
  console.log("Loaded 10 sample posts. Start the app with `pnpm dev` and open http://localhost:3000");
});
