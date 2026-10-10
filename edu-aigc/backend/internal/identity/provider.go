// Package identity 预留统一身份认证。当前启用的只有本校用户名密码。
// CAS 与 OAuth 可以以后注册进来，未注册或未启用时登录仍走本地账号。
package identity

import (
	"sync"

	"edu-aigc/internal/store"
)

type Provider interface {
	Mode() string
	Enabled() bool
	Label() string
	Authenticate(username, password string, local func(string, string) (store.User, error)) (store.User, error)
}

type Local struct{}

func (Local) Mode() string  { return "local" }
func (Local) Enabled() bool { return true }
func (Local) Label() string { return "本校用户名密码" }
func (Local) Authenticate(username, password string, local func(string, string) (store.User, error)) (store.User, error) {
	return local(username, password)
}

type Reserved struct {
	Name string
	Text string
}

func (r Reserved) Mode() string  { return r.Name }
func (r Reserved) Enabled() bool { return false }
func (r Reserved) Label() string {
	if r.Text != "" {
		return r.Text
	}
	return r.Name
}
func (r Reserved) Authenticate(string, string, func(string, string) (store.User, error)) (store.User, error) {
	return store.User{}, errNotReady
}

var errNotReady = reservedError("统一身份认证尚未接入，请使用本校用户名和密码登录")

type reservedError string

func (e reservedError) Error() string { return string(e) }

var (
	mu    sync.Mutex
	extra = map[string]Provider{}
)

func Register(p Provider) {
	mu.Lock()
	defer mu.Unlock()
	extra[p.Mode()] = p
}

func Unregister(mode string) {
	mu.Lock()
	defer mu.Unlock()
	delete(extra, mode)
}

// Active 返回当前真正用来登录的提供者。未启用的 CAS/OAuth 不会替换本地登录。
func Active(configured string) Provider {
	mu.Lock()
	defer mu.Unlock()
	if p, ok := extra[configured]; ok && p.Enabled() {
		return p
	}
	return Local{}
}

type Descriptor struct {
	Mode    string `json:"mode"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
	Active  bool   `json:"active"`
}

func Catalog(configured string) []Descriptor {
	active := Active(configured)
	items := []Provider{
		Local{},
		Reserved{Name: "cas", Text: "CAS 统一身份（接口已预留）"},
		Reserved{Name: "oauth", Text: "OAuth 统一身份（接口已预留）"},
	}
	mu.Lock()
	defer mu.Unlock()
	out := make([]Descriptor, 0, len(items))
	seen := map[string]struct{}{}
	for _, item := range items {
		p := item
		if reg, ok := extra[item.Mode()]; ok {
			p = reg
		}
		seen[p.Mode()] = struct{}{}
		out = append(out, Descriptor{Mode: p.Mode(), Label: p.Label(), Enabled: p.Enabled(), Active: p.Mode() == active.Mode() && p.Enabled()})
	}
	return out
}
