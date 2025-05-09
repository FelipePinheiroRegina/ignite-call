import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }
  const { name, username } = req.body

  const userExists = await prisma.user.findUnique({
    where: {
      username,
    },
  })

  if (userExists) {
    return res.status(400).json({ message: 'username already exists' })
  }

  const user = await prisma.user.create({
    data: {
      name,
      username,
    },
  })

  res.setHeader(
    'Set-Cookie',
    `@ignitecall:userId=${user.id}; Max-Age=${60 * 60 * 24 * 7}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  )

  return res.status(201).json(user)
}
