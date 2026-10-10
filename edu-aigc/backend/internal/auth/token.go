package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type payload struct {
	UID string `json:"uid"`
	Exp int64  `json:"exp"`
}

func Sign(secret []byte, userID string, ttl time.Duration) (string, error) {
	p := payload{UID: userID, Exp: time.Now().Add(ttl).Unix()}
	raw, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(body))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return body + "." + sig, nil
}

func Parse(secret []byte, token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", errors.New("登录已失效")
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(parts[0]))
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(sig, mac.Sum(nil)) {
		return "", errors.New("登录已失效")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", errors.New("登录已失效")
	}
	var p payload
	if err := json.Unmarshal(raw, &p); err != nil {
		return "", errors.New("登录已失效")
	}
	if time.Now().Unix() > p.Exp {
		return "", errors.New("登录已过期")
	}
	if p.UID == "" {
		return "", errors.New("登录已失效")
	}
	return p.UID, nil
}
