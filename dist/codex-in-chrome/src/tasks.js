import { createChromeTask } from "./api.js";
import { getRuntimeConfig, isApiConfigured } from "./config.js";
import { createNativeTask } from "./native.js";

export async function createCodexTask(payload) {
  const config = await getRuntimeConfig();
  const transport = config.taskTransport;

  if (transport === "api") return createChromeTask(payload, config);
  if (transport === "native") return createNativeTask(payload);

  try {
    return await createNativeTask(payload);
  } catch (nativeError) {
    if (!isApiConfigured(config)) throw nativeError;
    return createChromeTask({ ...payload, nativeError: nativeError.message }, config);
  }
}
