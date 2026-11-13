package store

import "testing"

func TestSQLiteDSNLeavesUnixPath(t *testing.T) {
	got := sqliteDSN("/var/lib/edu/app.db")
	want := "file:/var/lib/edu/app.db?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)"
	if got != want {
		t.Fatalf("got %s", got)
	}
}

func TestSQLiteDSNWindowsDrive(t *testing.T) {
	got := sqliteDSN(`C:\Program Files\校本智教\data\app.db`)
	want := "file:/C:/Program%20Files/%E6%A0%A1%E6%9C%AC%E6%99%BA%E6%95%99/data/app.db?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)"
	if got != want {
		t.Fatalf("got %s", got)
	}
}
