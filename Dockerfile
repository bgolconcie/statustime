FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "server/index.js"]
