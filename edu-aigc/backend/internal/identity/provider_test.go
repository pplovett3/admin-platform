package identity

import (
	"testing"

	"edu-aigc/internal/store"
)

type fake struct {
	mode    string
	enabled bool
}

func (f fake) Mode() string  { return f.mode }
func (f fake) Enabled() bool { return f.enabled }
func (f fake) Label() string { return "测试提供者" }
func (f fake) Authenticate(username, password string, local func(string, string) (store.User, error)) (store.User, error) {
	return store.User{ID: "from-plugin", Username: username}, nil
}

func TestReservedIdentityDoesNotReplaceLocalLogin(t *testing.T) {
	Register(fake{mode: "cas", enabled: false})
	t.Cleanup(func() { Unregister("cas") })
	if Active("cas").Mode() != "local" {
		t.Fatal("未启用的 CAS 不能替换本地登录")
	}
	if Active("oauth").Mode() != "local" {
		t.Fatal("未接入的 OAuth 应回退到本地登录")
	}
}

func TestEnabledPluginCanBeSelected(t *testing.T) {
	Register(fake{mode: "cas", enabled: true})
	t.Cleanup(func() { Unregister("cas") })
	p := Active("cas")
	if p.Mode() != "cas" || !p.Enabled() {
		t.Fatal("已启用的插件应成为当前登录方式")
	}
	u, err := p.Authenticate("teacher", "x", nil)
	if err != nil || u.ID != "from-plugin" {
		t.Fatalf("插件认证失败: %+v %v", u, err)
	}
	if Active("local").Mode() != "local" {
		t.Fatal("未选择插件时应仍是本地登录")
	}
}
