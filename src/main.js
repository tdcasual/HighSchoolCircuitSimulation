/**
 * main.js - 应用程序入口（v2 runtime）
 */

import { bootstrapV2 } from './v2/main/bootstrapV2.js';
import { AppRuntimeV2 } from './app/AppRuntimeV2.js';

export { AppRuntimeV2 as CircuitSimulatorApp };

bootstrapV2({
    AppClass: AppRuntimeV2
});
