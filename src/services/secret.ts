// 密钥混淆/加密工具
//
// 历史：早期仅用 base64 混淆（encodeSecret/decodeSecret），避免明文可见，但并非加密。
// 现状：新增 Web Crypto AES-GCM 加密（encryptSecret/decryptSecret），密钥由固定应用串 +
//       随机 salt 经 PBKDF2 派生，存储内容为 salt:iv:ciphertext（base64）。相比 base64，
//       至少保证密钥在 localStorage / 日志 / 数据库意外泄露时不是明文。
//
// 重要局限：纯前端存储无法对抗 XSS——加密密钥同样在前端 JS 中，攻击者脚本仍可解密。
// 真正的安全做法是用户自行保管 key、不持久化。此处加密仅为“不裸奔”的纵深防御。

const APP_SECRET = 'zxs-smart-dashboard-v1' // 固定派生盐，非机密（仅用于派生，不单独保护密文）

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64FromBytes(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0)
  return btoa(bin)
}

function bytesFromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// 基础混淆（base64），作为 AES 不可用时的回退，并兼容历史数据
export function encodeSecret(value: string): string {
  try {
    return btoa(encodeURIComponent(value))
  } catch {
    return ''
  }
}

export function decodeSecret(value: string): string {
  try {
    return decodeURIComponent(atob(value))
  } catch {
    return ''
  }
}

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const mat = await crypto.subtle.importKey('raw', enc.encode(APP_SECRET) as BufferSource, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    mat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// AES-GCM 加密，输出 v1:<salt>:<iv>:<ciphertext>（均为 base64）
export async function encryptSecret(value: string): Promise<string> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return encodeSecret(value)
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(salt)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(value) as BufferSource)
    return `v1:${b64FromBytes(salt)}:${b64FromBytes(iv)}:${b64FromBytes(new Uint8Array(ct))}`
  } catch {
    return encodeSecret(value)
  }
}

// AES-GCM 解密；非 v1 前缀或解密失败时回退 base64 解码（兼容历史数据）
export async function decryptSecret(payload: string): Promise<string> {
  try {
    if (payload.startsWith('v1:')) {
      const parts = payload.split(':')
      if (parts.length === 4) {
        const salt = bytesFromB64(parts[1] || '')
        const iv = bytesFromB64(parts[2] || '')
        const ct = bytesFromB64(parts[3] || '')
        const key = await deriveKey(salt)
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource)
        return dec.decode(pt)
      }
    }
    return decodeSecret(payload)
  } catch {
    return decodeSecret(payload)
  }
}
