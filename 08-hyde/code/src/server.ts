import { createApp } from './app';
import { config } from './config/environment';

const startServer = async (): Promise<void> => {
  try {
    const app = await createApp();
    app.listen(config.port, () => {
      console.log(`🚀 HyDE RAG Engine Server running on port ${config.port} [ENV: ${config.nodeEnv}]`);
      console.log(`📌 API Base URL: http://localhost:${config.port}/api/v1/hyde`);
      console.log(`💡 OpenAI API Key status: ${config.openaiApiKey ? 'Configured (Active)' : 'Not Set (Using Deterministic Fallbacks)'}`);
    });
  } catch (error) {
    console.error('❌ Failed to launch Express server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}
