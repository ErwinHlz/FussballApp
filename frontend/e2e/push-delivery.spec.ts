/**
 * Push delivery end to end against the local stack (no browser needed):
 * event trigger -> outbox -> Edge Function push-dispatch -> encrypted request to the device.
 * A small HTTP server plays the push service; the payload is decrypted like a browser would
 * (RFC 8291, aes128gcm). Needs `npm run setup:push` in ../backend.
 */
import { createServer, type IncomingHttpHeaders } from 'node:http'
import crypto from 'node:crypto'
import { expect, test } from '@playwright/test'
import { seedDemo } from './support/seed'

type Received = { headers: IncomingHttpHeaders; body: Buffer }

function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number) {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length))
}

function decrypt(body: Buffer, device: crypto.ECDH, authSecret: Buffer) {
  const salt = body.subarray(0, 16)
  const idLength = body[20]!
  const senderPublic = body.subarray(21, 21 + idLength)
  const ciphertext = body.subarray(21 + idLength)
  const shared = device.computeSecret(senderPublic)
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    device.getPublicKey(),
    senderPublic,
  ])
  const ikm = hkdf(authSecret, shared, keyInfo, 32)
  const key = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)
  const decipher = crypto.createDecipheriv('aes-128-gcm', key, nonce)
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
  const plain = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ])
  return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString('utf8'))
}

test('a new training reaches the player device, encrypted', async () => {
  const received: Received[] = []
  let respondWith = 201
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (d: Buffer) => chunks.push(d))
    req.on('end', () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks) })
      res.writeHead(respondWith).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve))
  const port = (server.address() as { port: number }).port

  try {
    const demo = await seedDemo()
    // The device: key pair + auth secret, like pushManager.subscribe() creates them.
    const device = crypto.createECDH('prime256v1')
    device.generateKeys()
    const authSecret = crypto.randomBytes(16)
    const register = await demo.player.sb.rpc('save_push_subscription', {
      p_endpoint: `http://host.docker.internal:${port}/push/${demo.stamp}`,
      p_p256dh: device.getPublicKey().toString('base64url'),
      p_auth: authSecret.toString('base64url'),
      p_locale: 'de',
    })
    expect(register.error).toBeNull()

    // Older notifications from seeding were sent already; now the coach adds a training.
    await demo.coach.sb.functions.invoke('push-dispatch', { body: {} })
    received.length = 0
    const start = new Date(Date.now() + 5 * 86400_000)
    const created = await demo.coach.sb
      .from('events')
      .insert({
        team_id: demo.team.id,
        type: 'training',
        starts_at: start.toISOString(),
        location: 'Platz 3',
      })
      .select()
      .single()
    expect(created.error).toBeNull()
    const dispatch = await demo.coach.sb.functions.invoke('push-dispatch', { body: {} })
    expect(dispatch.error).toBeNull()

    const ours = received.filter((r) => r.body.length > 0)
    expect(ours).toHaveLength(1)
    const push = ours[0]!
    expect(push.headers['content-encoding']).toBe('aes128gcm')
    expect(push.headers.authorization).toMatch(/^vapid t=.+, k=.+/)
    const message = decrypt(push.body, device, authSecret)
    expect(message).toMatchObject({
      title: 'Neues Training · U17',
      url: `/events/${created.data!.id}`,
    })
    expect(message.body).toContain('Platz 3')

    // The device is gone at the push service (410): it is removed automatically.
    respondWith = 410
    await demo.player.sb.rpc('request_test_push')
    await demo.player.sb.functions.invoke('push-dispatch', { body: {} })
    const devices = await demo.player.sb.from('push_subscriptions').select('id')
    expect(devices.data).toHaveLength(0)
  } finally {
    server.close()
  }
})
