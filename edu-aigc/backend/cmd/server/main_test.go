package main

import (
	"path/filepath"
	"testing"
)

func TestDataDirNextToExecutable(t *testing.T) {
	exe := filepath.Join("/opt", "edu-aigc", "edu-aigc")
	got := dataDirForExecutable(exe)
	want := filepath.Join("/opt", "edu-aigc", "data")
	if got != want {
		t.Fatalf("got %s want %s", got, want)
	}
}

func TestDataDirSkipsGoBuildCache(t *testing.T) {
	exe := filepath.Join("/tmp", "go-build998877", "b001", "exe", "server")
	if got := dataDirForExecutable(exe); got != "data" {
		t.Fatalf("go run 临时目录应退回相对 data，得到 %s", got)
	}
}

func TestLocalURL(t *testing.T) {
	if got := localURL(":8080"); got != "http://127.0.0.1:8080" {
		t.Fatal(got)
	}
	if got := localURL("127.0.0.1:9090"); got != "http://127.0.0.1:9090" {
		t.Fatal(got)
	}
}
