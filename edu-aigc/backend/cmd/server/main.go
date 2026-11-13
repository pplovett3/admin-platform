package main

import (
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"edu-aigc/internal/httpapi"
	"edu-aigc/internal/modelgw"
	"edu-aigc/internal/secure"
	"edu-aigc/internal/store"
	"edu-aigc/internal/web"
)

func main() {
	dataDir := env("DATA_DIR", defaultDataDir())
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
	pages, err := fs.Sub(web.Dist, "ui")
	if err != nil {
		log.Fatal(err)
	}
	srv := &httpapi.Server{
		Store:      st,
		Secret:     []byte(secret),
		DataKey:    secure.KeyFrom(key),
		DailyLimit: 200,
		StaticDir:  os.Getenv("STATIC_DIR"),
		StaticFS:   pages,
		Gateway: &modelgw.Gateway{
			BaseURL: os.Getenv("MODEL_BASE_URL"),
			APIKey:  os.Getenv("MODEL_API_KEY"),
			Model:   env("MODEL_NAME", ""),
		},
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal(err)
	}
	home := localURL(addr)
	log.Printf("校本智教已启动 %s  数据目录 %s", home, dataDir)
	log.Printf("演示账号 admin / school / lead / teacher / math ，密码 %s", store.DemoPassword)
	if runtime.GOOS == "windows" && env("OPEN_BROWSER", "1") != "0" {
		go openBrowser(home)
	}
	if err := http.Serve(ln, srv.Handler()); err != nil {
		log.Fatal(err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// defaultDataDir 把数据库放在可执行文件旁边。go run 的临时二进制仍用当前目录下的 data，避免写进系统临时目录。
func defaultDataDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "data"
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return dataDirForExecutable(exe)
}

func dataDirForExecutable(exe string) string {
	dir := filepath.Clean(filepath.Dir(exe))
	if strings.Contains(filepath.ToSlash(dir), "/go-build") {
		return "data"
	}
	return filepath.Join(dir, "data")
}

func localURL(addr string) string {
	if strings.HasPrefix(addr, ":") {
		return "http://127.0.0.1" + addr
	}
	if strings.HasPrefix(addr, "http://") || strings.HasPrefix(addr, "https://") {
		return addr
	}
	return "http://" + addr
}

func openBrowser(url string) {
	time.Sleep(400 * time.Millisecond)
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
