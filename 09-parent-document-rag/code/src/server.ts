import { createApp } from './app';
import { config } from './config/environment';

const startServer = async (): Promise<void> => {
  try {
    const app = await createApp();
    app.listen(config.port, () => {
      console.log(`🚀 Parent-Document RAG Engine Server running on port ${config.port} [ENV: ${config.nodeEnv}]`);
      console.log(`📌 API Base URL: http://localhost:${config.port}/api/v1/parent-document`);
      console.log(
        `💡 OpenAI API Key status: ${config.openaiApiKey ? 'Configured (Active)' : 'Not Set (Using Deterministic Fallbacks)'}`
      );
    });
  } catch (error) {
    console.error('❌ Failed to launch Express server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}
