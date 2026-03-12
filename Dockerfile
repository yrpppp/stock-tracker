# 1. 빌드 스테이지
# node:18 대신 node:20 (LTS 버전)을 사용합니다.
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 설치
COPY package*.json ./
RUN npm install

# 전체 소스 복사
COPY . .

# 실행 권한 부여 (혹시 모를 에러 방지)
RUN chmod -R +x node_modules/.bin

# 빌드 실행
RUN npm run build

# 2. 실행 스테이지
FROM node:20-alpine
WORKDIR /app

# 빌드 결과물만 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000
CMD ["node", "dist/main"]