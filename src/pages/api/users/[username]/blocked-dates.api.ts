import { prisma } from '@/lib/prisma'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const username = String(req.query.username)
  const { year, month } = req.query

  if (!year || !month) {
    res.status(400).json({ message: 'year and month is required.' })
    return
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  })

  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }

  const availableWeekDays = await prisma.userTimeInterval.findMany({
    select: {
      week_day: true,
    },
    where: {
      user_id: user.id,
    },
  })

  const blockedWeekDays = [0, 1, 2, 3, 4, 5, 6].filter((weekDay) => {
    return !availableWeekDays.some(
      (availableWeekDay) => availableWeekDay.week_day === weekDay,
    )
  })

  const blockedDatesRaw: Array<{ date: string }> = await prisma.$queryRaw`
  SELECT
    EXTRACT(DAY FROM S.date) AS date,
    COUNT(S.date) AS amount,
    ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60.0) AS size
  FROM scheduling S

  LEFT JOIN user_time_intervals UTI
    ON UTI.week_day = EXTRACT(DOW FROM S.date)

  WHERE S.user_id = ${user.id}
    AND TO_CHAR(S.date, 'YYYY-MM') = ${`${year}-${month.toString().padStart(2, '0')}`}

  GROUP BY EXTRACT(DAY FROM S.date),
    UTI.time_end_in_minutes,
    UTI.time_start_in_minutes

  HAVING COUNT(S.date) >= ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60.0)
`

  const blockedDates = blockedDatesRaw.map((item) => Number(item.date))
  res.status(200).json({ blockedWeekDays, blockedDates })
}
