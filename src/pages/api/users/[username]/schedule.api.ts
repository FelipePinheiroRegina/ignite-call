import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextApiRequest, NextApiResponse } from 'next'
import dayjs from 'dayjs'
import { google } from 'googleapis'
import { getGoogleOAuthToken } from '@/lib/google'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const username = String(req.query.username)

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  })

  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }

  const schemaBody = z.object({
    name: z.string(),
    email: z.string().email(),
    observations: z.string().optional(),
    date: z.string().datetime(),
  })

  const { name, email, observations, date } = schemaBody.parse(req.body)

  const schedulingDate = dayjs(date).startOf('hour')

  if (schedulingDate.isBefore(new Date())) {
    res.status(400).json({ message: 'Date is in the past' })
    return
  }

  const conflictingScheduling = await prisma.scheduling.findFirst({
    where: {
      user_id: user.id,
      date: schedulingDate.toDate(),
    },
  })

  if (conflictingScheduling) {
    res
      .status(400)
      .json({ message: 'There is another scheduling at the same time' })
    return
  }

  const scheduling = await prisma.scheduling.create({
    data: {
      user_id: user.id,
      name,
      email,
      observations,
      date: schedulingDate.toDate(),
    },
  })

  const calendar = google.calendar({
    version: 'v3',
    auth: await getGoogleOAuthToken(user.id),
  })

  await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: `Ignite Call: ${name}`,
      description: observations,
      start: {
        dateTime: schedulingDate.format(),
      },
      end: {
        dateTime: schedulingDate.add(1, 'hour').format(),
      },
      attendees: [{ email, displayName: name }],
      conferenceData: {
        createRequest: {
          requestId: scheduling.id,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    },
  })

  res.status(201).end()
}
