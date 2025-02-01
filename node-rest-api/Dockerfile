FROM node:20.5.0-alpine3.18

# set timezone to HKT
RUN apk add alpine-conf && \
  setup-timezone -z Asia/Hong_Kong && \
  apk del alpine-conf

WORKDIR /home/user/project/data-export-scripts/node-rest-api

ENV PORT=8000

COPY --chmod=777 . .

RUN npm install -g pnpm

RUN pnpm i 

EXPOSE 8000

CMD ["node", "converter.js"]


