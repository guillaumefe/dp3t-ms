#!/usr/bin/env node
require('dotenv').config()

const {json, send} = require('micro')
const Redis = require('ioredis')

const {methodNotAllowed} = require('../../lib/util/http')

const redis = new Redis(process.env.REDIS_URL, {keyPrefix: 'keys:'})

const ONE_DAY = 24 * 3600

async function declareCase(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  const body = await json(req)
  const {contactKeys} = body

  if (!contactKeys || !Array.isArray(contactKeys)) {
    return send(res, 400, {
      code: 400,
      message: 'contactKeys is required and must be an array'
    })
  }

  console.log(`Declared case: ${contactKeys.length} contact keys`)

  await redis
    .multi(contactKeys.map(contactKey => {
      return ['setex', contactKey, 21 * ONE_DAY, {addedAt: new Date()}]
    }))
    .exec()

  return send(res, 204)
}

async function checkStatus(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  const body = await json(req)
  const {personalKeys} = body

  if (!personalKeys || !Array.isArray(personalKeys)) {
    return send(res, 400, {
      code: 400,
      message: 'personalKeys is required and must be an array'
    })
  }

  const matches = await redis
    .multi(personalKeys.map(personalKey => {
      return ['exists', personalKey]
    }))
    .exec()

  const matchedKeys = personalKeys.filter((personalKey, i) => {
    return matches[i][1] === 1
  })

  if (matchedKeys.length > 0) {
    return {
      status: 'positive',
      matchedKeys
    }
  }

  return {
    status: 'negative'
  }
}

module.exports = (req, res) => {
  if (req.url === '/declare-case') {
    return declareCase(req, res)
  }

  if (req.url === '/check-status') {
    return checkStatus(req, res)
  }

  return send(res, 404)
}
