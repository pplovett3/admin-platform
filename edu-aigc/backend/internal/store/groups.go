package store

import (
	"errors"
	"strings"
)

type ResearchGroup struct {
	ID          string   `json:"id"`
	TenantID    string   `json:"tenant_id"`
	Name        string   `json:"name"`
	Mode        string   `json:"mode"`
	Subject     string   `json:"subject"`
	GradeLabel  string   `json:"grade_label"`
	Description string   `json:"description"`
	CreatedAt   string   `json:"created_at"`
	MemberIDs   []string `json:"member_ids,omitempty"`
	Members     []Member `json:"members,omitempty"`
}

type Member struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

func ValidGroupMode(mode string) bool {
	switch mode {
	case "subject", "grade", "custom":
		return true
	default:
		return false
	}
}

func (s *Store) attachGroups(u *User) error {
	rows, err := s.db.Query(`SELECT g.id, g.tenant_id, g.name, g.mode, g.subject, g.grade_label, g.description, g.created_at
		FROM research_groups g JOIN user_groups ug ON ug.group_id=g.id WHERE ug.user_id=? ORDER BY g.name`, u.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	u.Groups = []ResearchGroup{}
	u.GroupIDs = []string{}
	for rows.Next() {
		var g ResearchGroup
		if err := rows.Scan(&g.ID, &g.TenantID, &g.Name, &g.Mode, &g.Subject, &g.GradeLabel, &g.Description, &g.CreatedAt); err != nil {
			return err
		}
		u.Groups = append(u.Groups, g)
		u.GroupIDs = append(u.GroupIDs, g.ID)
	}
	return rows.Err()
}

func (s *Store) ListGroups(u User) ([]ResearchGroup, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, mode, subject, grade_label, description, created_at FROM research_groups WHERE tenant_id=? OR ?='admin' ORDER BY name`, u.TenantID, u.Role)
	if err != nil {
		return nil, err
	}
	var out []ResearchGroup
	for rows.Next() {
		var g ResearchGroup
		if err := rows.Scan(&g.ID, &g.TenantID, &g.Name, &g.Mode, &g.Subject, &g.GradeLabel, &g.Description, &g.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		if u.Role != "admin" && u.Role != "school_admin" && !inGroup(u, g.ID) {
			continue
		}
		out = append(out, g)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	if out == nil {
		out = []ResearchGroup{}
	}
	// 成员查询必须等上面的结果集关掉。SQLite 只开一条连接，套着查会把整个服务卡住。
	for i := range out {
		members, err := s.groupMembers(out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Members = members
		for _, m := range members {
			out[i].MemberIDs = append(out[i].MemberIDs, m.ID)
		}
	}
	return out, nil
}

func (s *Store) GetGroup(id string) (ResearchGroup, error) {
	var g ResearchGroup
	err := s.db.QueryRow(`SELECT id, tenant_id, name, mode, subject, grade_label, description, created_at FROM research_groups WHERE id=?`, id).
		Scan(&g.ID, &g.TenantID, &g.Name, &g.Mode, &g.Subject, &g.GradeLabel, &g.Description, &g.CreatedAt)
	return g, err
}

func (s *Store) SaveGroup(g ResearchGroup) error {
	g.Name = strings.TrimSpace(g.Name)
	g.Mode = strings.TrimSpace(g.Mode)
	if g.Name == "" {
		return errors.New("请填写教研组名称")
	}
	if !ValidGroupMode(g.Mode) {
		return errors.New("教研组类型只能是学科、年级或自定义")
	}
	if g.Mode == "subject" && strings.TrimSpace(g.Subject) == "" {
		return errors.New("按学科建组时请填写学科")
	}
	if g.Mode == "grade" && strings.TrimSpace(g.GradeLabel) == "" {
		return errors.New("按年级建组时请填写年级")
	}
	var n int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM research_groups WHERE id=?`, g.ID).Scan(&n)
	if n == 0 {
		_, err := s.db.Exec(`INSERT INTO research_groups (id, tenant_id, name, mode, subject, grade_label, description, created_at) VALUES (?,?,?,?,?,?,?,?)`,
			g.ID, g.TenantID, g.Name, g.Mode, g.Subject, g.GradeLabel, g.Description, g.CreatedAt)
		return err
	}
	_, err := s.db.Exec(`UPDATE research_groups SET name=?, mode=?, subject=?, grade_label=?, description=? WHERE id=? AND tenant_id=?`,
		g.Name, g.Mode, g.Subject, g.GradeLabel, g.Description, g.ID, g.TenantID)
	return err
}

func (s *Store) DeleteGroup(id, tenantID string) error {
	if _, err := s.db.Exec(`DELETE FROM user_groups WHERE group_id=?`, id); err != nil {
		return err
	}
	_, err := s.db.Exec(`DELETE FROM research_groups WHERE id=? AND tenant_id=?`, id, tenantID)
	return err
}

func (s *Store) AddMember(groupID, userID string) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?,?)`, userID, groupID)
	return err
}

func (s *Store) RemoveMember(groupID, userID string) error {
	_, err := s.db.Exec(`DELETE FROM user_groups WHERE group_id=? AND user_id=?`, groupID, userID)
	return err
}

func (s *Store) groupMembers(groupID string) ([]Member, error) {
	rows, err := s.db.Query(`SELECT u.id, u.username, u.display_name, u.role FROM users u JOIN user_groups ug ON ug.user_id=u.id WHERE ug.group_id=? ORDER BY u.display_name`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if out == nil {
		out = []Member{}
	}
	return out, rows.Err()
}

func (s *Store) ListUsers(tenantID string) ([]Member, error) {
	rows, err := s.db.Query(`SELECT id, username, display_name, role FROM users WHERE tenant_id=? ORDER BY display_name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if out == nil {
		out = []Member{}
	}
	return out, rows.Err()
}

func (s *Store) seedOrg(now string) error {
	groups := []ResearchGroup{
		{ID: GroupYuwen, TenantID: TenantID, Name: "语文教研组", Mode: "subject", Subject: "语文", Description: "按学科组织的语文组", CreatedAt: now},
		{ID: GroupMath, TenantID: TenantID, Name: "数学教研组", Mode: "subject", Subject: "数学", Description: "按学科组织的数学组", CreatedAt: now},
		{ID: GroupGrade3, TenantID: TenantID, Name: "三年级组", Mode: "grade", GradeLabel: "三年级", Description: "按年级组织，语文和数学教师都可以加入", CreatedAt: now},
		{ID: GroupCustom, TenantID: TenantID, Name: "校本课程组", Mode: "custom", Description: "学校自定义的跨学科小组", CreatedAt: now},
	}
	for _, g := range groups {
		if err := s.SaveGroup(g); err != nil {
			return err
		}
	}
	pairs := [][2]string{
		{UserLead, GroupYuwen},
		{UserTeacher, GroupYuwen},
		{UserTeacher, GroupGrade3},
		{UserMath, GroupMath},
		{UserMath, GroupGrade3},
		{UserSchool, GroupCustom},
	}
	for _, p := range pairs {
		if err := s.AddMember(p[1], p[0]); err != nil {
			return err
		}
	}
	_, err := s.db.Exec(`INSERT INTO school_settings (tenant_id, model_base_url, model_api_key, model_name, ocr_engine, identity_mode, identity_config_json, curriculum_version, curriculum_source, curriculum_note)
		VALUES (?,?,?,?,?,?,?,?,?,?)`, TenantID, "", "", "", "auto", "local", "{}", "", "", "")
	return err
}
