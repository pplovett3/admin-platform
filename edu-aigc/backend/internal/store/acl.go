package store

import (
	"encoding/json"
	"strings"
)

func CanReadKB(u User, kb KB) bool {
	if u.Status != "active" || kb.ID == "" {
		return false
	}
	if u.Role == "admin" {
		return true
	}
	if u.TenantID != kb.TenantID {
		return false
	}
	if u.Role == "school_admin" {
		return true
	}
	if kb.OwnerID == u.ID || aclHas(kb.ACLUserIDs, u.ID) {
		return true
	}
	if kb.ShareType == "public" {
		return true
	}
	if kb.ShareType == "group" && inGroup(u, kb.GroupID) {
		return true
	}
	return false
}

func CanWriteKB(u User, kb KB) bool {
	if !CanReadKB(u, kb) && u.Role != "admin" && !(u.Role == "school_admin" && u.TenantID == kb.TenantID) {
		if kb.OwnerID != u.ID {
			return false
		}
	}
	if u.Role == "admin" || (u.Role == "school_admin" && u.TenantID == kb.TenantID) {
		return true
	}
	if kb.OwnerID == u.ID {
		return true
	}
	if u.Role == "group_lead" && kb.ShareType == "group" && inGroup(u, kb.GroupID) && kb.TenantID == u.TenantID {
		return true
	}
	return false
}

func CanReadAgent(u User, a Agent) bool {
	if u.Status != "active" || a.ID == "" {
		return false
	}
	if u.Role == "admin" {
		return true
	}
	if u.TenantID != a.TenantID {
		return false
	}
	if u.Role == "school_admin" || a.OwnerID == u.ID {
		return true
	}
	if a.ShareType == "public" {
		return true
	}
	if a.ShareType == "group" && inGroup(u, a.GroupID) {
		return true
	}
	return false
}

func CanWriteAgent(u User, a Agent) bool {
	if u.Role == "admin" || (u.Role == "school_admin" && u.TenantID == a.TenantID) {
		return true
	}
	if a.OwnerID == u.ID && a.TenantID == u.TenantID {
		return true
	}
	if u.Role == "group_lead" && a.ShareType == "group" && inGroup(u, a.GroupID) && a.TenantID == u.TenantID {
		return true
	}
	return false
}

func AllowedShare(u User, share string) bool {
	switch share {
	case "private":
		return true
	case "group":
		return u.Role == "group_lead" || u.Role == "school_admin" || u.Role == "admin"
	case "public":
		return u.Role == "school_admin" || u.Role == "admin"
	default:
		return false
	}
}

func inGroup(u User, groupID string) bool {
	if groupID == "" {
		return false
	}
	for _, id := range u.GroupIDs {
		if id == groupID {
			return true
		}
	}
	return false
}

func SharesGroup(a, b User) bool {
	for _, id := range a.GroupIDs {
		if inGroup(b, id) {
			return true
		}
	}
	return false
}

func aclHas(raw, userID string) bool {
	if userID == "" || strings.TrimSpace(raw) == "" {
		return false
	}
	var ids []string
	if json.Unmarshal([]byte(raw), &ids) == nil {
		for _, id := range ids {
			if id == userID {
				return true
			}
		}
		return false
	}
	return strings.Contains(","+raw+",", ","+userID+",")
}
