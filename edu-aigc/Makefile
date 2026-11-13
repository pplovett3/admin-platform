.PHONY: test ui run windows

ui:
	cd frontend && npm install && npm run build
	rm -rf backend/internal/web/ui
	mkdir -p backend/internal/web/ui
	cp -a frontend/dist/. backend/internal/web/ui/

test:
	cd backend && go test ./...

run: ui
	cd backend && go run ./cmd/server

windows: ui
	cd backend && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o ../edu-aigc.exe ./cmd/server
