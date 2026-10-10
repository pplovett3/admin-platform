FROM node:22-bookworm AS web
WORKDIR /src/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-bookworm AS build
WORKDIR /src/backend
COPY backend/ ./
RUN go build -o /out/edu-aigc ./cmd/server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/edu-aigc /usr/local/bin/edu-aigc
COPY --from=web /src/frontend/dist /srv/web
ENV STATIC_DIR=/srv/web
ENV DATA_DIR=/data
EXPOSE 8080
VOLUME ["/data"]
CMD ["edu-aigc"]
