/**
 * Express HTTP Server Launcher
 */

import { createApp } from './app';
import { config } from './config/index';

const app = createApp();

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Metadata-Filtered RAG Express Backend Server`);
  console.log(`   Running on: http://localhost:${config.port}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   OpenAI Key Present: ${Boolean(config.openaiApiKey)}`);
  console.log(`   Default Search Mode: ${config.defaultSearchMode}`);
  console.log(`=======================================================`);
});
