# 1. 프런트엔드 빌드 스테이지
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. 백엔드 빌드 스테이지
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 3. 실행 스테이지
FROM node:20-alpine
WORKDIR /app

# 백엔드 결과물 복사
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package*.json ./

# 프런트엔드 빌드 결과물 복사
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

# 경로를 명확하게 main.js까지 지정
CMD ["node", "dist/src/main.js"]