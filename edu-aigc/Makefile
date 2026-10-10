.PHONY: test ui run

ui:
	cd frontend && npm install && npm run build

test:
	cd backend && go test ./...

run: ui
	cd backend && go run ./cmd/server
