# Build stage
FROM node:24-alpine AS build

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

ENV HUSKY=0

RUN npm ci

COPY --chown=node:node . .

RUN npm run build

RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules

COPY --chown=node:node --from=build /usr/src/app/dist ./dist

RUN install -d -o node -g node /usr/src/app/src/temp/uploads/testcases

USER node

EXPOSE 3000

CMD ["node", "dist/src/main.js"]