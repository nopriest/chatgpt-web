import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'

async function bootstrap() {
  const app = createApp(App)
  setupAssets() // 使用naive ui

  setupStore(app) // 使用pinia

  setupI18n(app) // 国际化

  await setupRouter(app) // 路由

  app.mount('#app')
}

bootstrap()
