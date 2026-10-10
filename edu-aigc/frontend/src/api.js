const TOKEN = 'edu_token'
const USER = 'edu_user'

export const roleLabel = {
  admin: '超级管理员',
  school_admin: '学校管理员',
  group_lead: '教研组长',
  teacher: '教师'
}

export const shareLabel = {
  private: '私有',
  group: '教研组',
  public: '全校'
}

export const statusLabel = {
  uploading: '上传中',
  desensitizing: '脱敏中',
  vectoring: '向量化',
  finished: '已入库',
  blocked: '已拦截',
  failed: '解析失败'
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER) || 'null')
  } catch {
    return null
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN, token)
  localStorage.setItem(USER, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN)
  localStorage.removeItem(USER)
}

export function token() {
  return localStorage.getItem(TOKEN) || ''
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  if (token()) headers.Authorization = 'Bearer ' + token()
  const res = await fetch(path, { ...options, headers })
  if (res.status === 401) {
    clearSession()
    if (!location.pathname.startsWith('/login')) location.href = '/login'
    throw new Error('请先登录')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '请求失败')
  return data
}

export async function downloadResource(id) {
  const res = await fetch('/api/resource/download?id=' + encodeURIComponent(id), {
    headers: { Authorization: 'Bearer ' + token() }
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || '下载失败')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '教学资源-' + id.slice(0, 8) + '.docx'
  a.click()
  URL.revokeObjectURL(url)
}

export function parseMaybe(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}
