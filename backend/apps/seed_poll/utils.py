# apps/seed_poll/utils.py

from .models import Poll


def get_current_poll(poll_id=None):
    """
    Single source of truth for 'which season are we in?'

    Priority order:
    1. Specific poll_id (for historical views)
    2. OPEN poll — active season kung saan nag-eencode pa
    3. LOCKED poll — finalized pero hindi pa closed
    4. Most recent CLOSED poll — for display after season ends

    Returns Poll instance or None.
    """
    if poll_id:
        try:
            return Poll.objects.get(id=poll_id)
        except Poll.DoesNotExist:
            pass

    return (
        Poll.objects.filter(status='OPEN').order_by('-created_at').first()
        or Poll.objects.filter(status='LOCKED').order_by('-created_at').first()
        or Poll.objects.filter(status='CLOSED').order_by('-year', '-created_at').first()
    )