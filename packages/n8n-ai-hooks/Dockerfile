# n8n with AI hooks
FROM n8nio/n8n:1.71.1

USER root

# Установка дополнительных зависимостей
RUN npm install -g pnpm@8.15.0

# Копируем наши AI hooks
WORKDIR /opt/n8n-ai-hooks
COPY package.json tsconfig.json ./
COPY *.ts ./
COPY INTEGRATION.md ./

# Устанавливаем зависимости для hooks
RUN pnpm install

# Компилируем TypeScript
RUN pnpm build

# Создаем патч для n8n
WORKDIR /usr/local/lib/node_modules/n8n

# Добавляем наши зависимости в n8n
RUN npm install @n8n-ai/schemas@file:/opt/n8n-ai-hooks

# Копируем скрипт интеграции
COPY integrate-ai-hooks.js /opt/

# Применяем патч при старте
USER node
WORKDIR /home/node

# Переопределяем entrypoint для применения hooks
ENTRYPOINT ["sh", "-c", "node /opt/integrate-ai-hooks.js && n8n"]