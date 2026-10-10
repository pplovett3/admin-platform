// Package rag 提供本地混合检索：字符哈希向量 + BM25，再按词面重合做轻量重排。
// 向量只存在调用方传入的切片上，本包不保存原文库。
package rag

import (
	"math"
	"sort"
	"strings"
	"unicode"
)

const Dim = 256

type Chunk struct {
	ID     string
	DocID  string
	KBID   string
	Text   string
	Meta   string
	Vector []float32
}

type Hit struct {
	Chunk Chunk
	Score float64
}

func Embed(text string) []float32 {
	vec := make([]float32, Dim)
	rs := []rune(strings.ToLower(text))
	if len(rs) == 0 {
		return vec
	}
	for _, r := range rs {
		vec[hash1(r)%Dim] += 0.5
	}
	for i := 0; i < len(rs)-1; i++ {
		vec[hash2(rs[i], rs[i+1])%Dim] += 1
	}
	var sum float64
	for _, v := range vec {
		sum += float64(v) * float64(v)
	}
	if sum == 0 {
		return vec
	}
	n := float32(math.Sqrt(sum))
	for i := range vec {
		vec[i] /= n
	}
	return vec
}

func hash1(r rune) int {
	return int(r * 131)
}

func hash2(a, b rune) int {
	return int(a*131 + b*17)
}

func cosine(a, b []float32) float64 {
	if len(a) == 0 || len(b) == 0 || len(a) != len(b) {
		return 0
	}
	var s float64
	for i := range a {
		s += float64(a[i]) * float64(b[i])
	}
	return s
}

type termDoc struct {
	tf map[string]int
	n  int
}

func tokenize(s string) []string {
	s = strings.ToLower(s)
	var toks []string
	var buf []rune
	flush := func() {
		if len(buf) == 0 {
			return
		}
		toks = append(toks, string(buf))
		// 中文再切成双字，便于短查询命中。
		if len(buf) >= 2 {
			allHan := true
			for _, r := range buf {
				if !unicode.Is(unicode.Han, r) {
					allHan = false
					break
				}
			}
			if allHan {
				for i := 0; i < len(buf)-1; i++ {
					toks = append(toks, string(buf[i:i+2]))
				}
			}
		}
		buf = buf[:0]
	}
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.Is(unicode.Han, r) {
			buf = append(buf, r)
			continue
		}
		flush()
	}
	flush()
	return toks
}

// Retrieve 在已按权限筛过的候选集上做混合检索与重排。
func Retrieve(query string, chunks []Chunk, topK int, maxRunes int) []Hit {
	if topK <= 0 {
		topK = 4
	}
	if maxRunes <= 0 {
		maxRunes = 1800
	}
	qVec := Embed(query)
	qTerms := tokenize(query)
	docs := make([]termDoc, len(chunks))
	df := map[string]int{}
	totalLen := 0
	for i, c := range chunks {
		tf := map[string]int{}
		toks := tokenize(c.Text)
		seen := map[string]struct{}{}
		for _, t := range toks {
			tf[t]++
			if _, ok := seen[t]; !ok {
				df[t]++
				seen[t] = struct{}{}
			}
		}
		docs[i] = termDoc{tf: tf, n: len(toks)}
		totalLen += len(toks)
	}
	avg := 1.0
	if len(chunks) > 0 && totalLen > 0 {
		avg = float64(totalLen) / float64(len(chunks))
	}
	N := float64(len(chunks))
	const k1 = 1.2
	const b = 0.75
	hits := make([]Hit, 0, len(chunks))
	var maxBM float64
	rawBM := make([]float64, len(chunks))
	for i, c := range chunks {
		bm := 0.0
		for _, t := range qTerms {
			f := float64(docs[i].tf[t])
			if f == 0 || df[t] == 0 {
				continue
			}
			idf := math.Log(1 + (N-float64(df[t])+0.5)/(float64(df[t])+0.5))
			denom := f + k1*(1-b+b*float64(docs[i].n)/avg)
			bm += idf * (f * (k1 + 1) / denom)
		}
		rawBM[i] = bm
		if bm > maxBM {
			maxBM = bm
		}
		_ = c
	}
	for i, c := range chunks {
		cos := cosine(qVec, c.Vector)
		if len(c.Vector) == 0 {
			cos = cosine(qVec, Embed(c.Text))
		}
		bm := 0.0
		if maxBM > 0 {
			bm = rawBM[i] / maxBM
		}
		phrase := 0.0
		if strings.Contains(c.Text, strings.TrimSpace(query)) && strings.TrimSpace(query) != "" {
			phrase = 0.15
		}
		overlap := 0.0
		for _, t := range qTerms {
			if docs[i].tf[t] > 0 && len([]rune(t)) >= 2 {
				overlap += 0.04
			}
		}
		if overlap > 0.2 {
			overlap = 0.2
		}
		score := 0.55*cos + 0.35*bm + phrase + overlap
		if score < 0.12 {
			continue
		}
		hits = append(hits, Hit{Chunk: c, Score: score})
	}
	sort.Slice(hits, func(i, j int) bool { return hits[i].Score > hits[j].Score })
	if len(hits) > topK {
		hits = hits[:topK]
	}
	used := 0
	trimmed := hits[:0]
	for _, h := range hits {
		n := len([]rune(h.Chunk.Text))
		if used+n > maxRunes && len(trimmed) > 0 {
			break
		}
		trimmed = append(trimmed, h)
		used += n
	}
	return trimmed
}
