export default function isExpired(
  date: Date | string | undefined,
  TTL_IN_HOURS: number,
) {
  if (!date) {
    return true;
  }

  const now = new Date();
  const dateToCompare = new Date(date);

  const diff = now.getTime() - dateToCompare.getTime();
  const diffInHours = diff / 1000 / 60 / 60;

  return diffInHours > TTL_IN_HOURS;
}
