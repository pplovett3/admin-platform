package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"edu-aigc/internal/httpapi"
	"edu-aigc/internal/modelgw"
	"edu-aigc/internal/secure"
	"edu-aigc/internal/store"
)

func main() {
	dataDir := env("DATA_DIR", "data")
	dbPath := env("DB_PATH", filepath.Join(dataDir, "app.db"))
	addr := env("ADDR", ":8080")
	secret := env("JWT_SECRET", "edu-aigc-dev-secret-change-me")
	key := env("DATA_KEY", "edu-aigc-dev-key-change-me")
	st, err := store.Open(dbPath, dataDir)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		log.Fatal(err)
	}
	if err := st.Seed(); err != nil {
		log.Fatal(err)
	}
	srv := &httpapi.Server{
		Store:      st,
		Secret:     []byte(secret),
		DataKey:    secure.KeyFrom(key),
		DailyLimit: 200,
		StaticDir:  os.Getenv("STATIC_DIR"),
		Gateway: &modelgw.Gateway{
			BaseURL: os.Getenv("MODEL_BASE_URL"),
			APIKey:  os.Getenv("MODEL_API_KEY"),
			Model:   env("MODEL_NAME", ""),
		},
	}
	log.Printf("校本智教已启动 %s  数据目录 %s", addr, dataDir)
	log.Printf("演示账号 admin / school / lead / teacher / math ，密码 %s", store.DemoPassword)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatal(err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
