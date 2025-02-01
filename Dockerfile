FROM node:20.5.0-alpine3.18

# set timezone to HKT
RUN apk add alpine-conf && \
  setup-timezone -z Asia/Hong_Kong && \
  apk del alpine-conf

WORKDIR /home/user/project/data-export-scripts

COPY --chmod=777 . .

RUN yarn global add pnpm && pnpm i

CMD ["pnpm","start"]
