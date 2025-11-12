import * as crypto from 'crypto';

// 去除易混淆字符的字符集：去除 0O1Il
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 生成随机激活码，格式：ABCD-EFGH-IJKL
 */
export function generateActivationCode(): string {
  const segments: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      const randomIndex = crypto.randomInt(0, CHARSET.length);
      segment += CHARSET[randomIndex];
    }
    segments.push(segment);
  }
  
  return segments.join('-');
}

/**
 * 批量生成唯一的激活码
 */
export function generateUniqueCodes(count: number): string[] {
  const codes = new Set<string>();
  
  while (codes.size < count) {
    codes.add(generateActivationCode());
  }
  
  return Array.from(codes);
}

/**
 * 验证激活码格式
 */
export function isValidActivationCodeFormat(code: string): boolean {
  const pattern = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
  return pattern.test(code);
}

