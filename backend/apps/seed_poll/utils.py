from .models import Poll, FinalSeed


def get_current_poll(poll_id=None):
    if poll_id:
        try:
            return Poll.objects.get(id=poll_id)
        except Poll.DoesNotExist:
            pass

    closed_polls = Poll.objects.filter(status='CLOSED').order_by('-year', '-created_at')
    for poll in closed_polls:
        if FinalSeed.objects.filter(season=poll.season, year=poll.year).exists():
            return poll

    return (
        Poll.objects.filter(status='OPEN').order_by('-created_at').first()
        or Poll.objects.order_by('-created_at').first()
    )


def get_encoding_poll(poll_id=None):
    if poll_id:
        try:
            poll = Poll.objects.get(id=poll_id)
            if poll.status == 'CLOSED' and FinalSeed.objects.filter(season=poll.season, year=poll.year).exists():
                latest = Poll.objects.order_by('-created_at').first()
                if latest and latest.id != poll.id:
                    if latest.status != 'CLOSED' or not FinalSeed.objects.filter(season=latest.season, year=latest.year).exists():
                        return None
                return poll
            return None
        except Poll.DoesNotExist:
            return None

    latest_poll = Poll.objects.order_by('-created_at').first()
    if not latest_poll:
        return None

    if latest_poll.status == 'CLOSED' and FinalSeed.objects.filter(season=latest_poll.season, year=latest_poll.year).exists():
        return latest_poll

    return None


def is_encoding_allowed():
    return get_encoding_poll() is not None