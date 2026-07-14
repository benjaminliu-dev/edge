FROM node:slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENTRYPOINT [ "npx", "tsx", "src/index.ts" ]