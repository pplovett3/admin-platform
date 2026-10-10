package plugin

func IDForTask(task string) string {
	switch task {
	case "lesson", "comment":
		return "lesson"
	case "ppt":
		return "ppt"
	case "quiz":
		return "quiz"
	case "grade":
		return "grade"
	case "analytics":
		return "analytics"
	case "rewrite":
		return "rewrite"
	default:
		return ""
	}
}

func Allows(mounted []string, task string) bool {
	id := IDForTask(task)
	if id == "" {
		return true
	}
	if len(mounted) == 0 {
		return true
	}
	for _, m := range mounted {
		if m == id {
			return true
		}
	}
	return false
}
