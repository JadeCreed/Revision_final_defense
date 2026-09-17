# apps/crop_monitoring/date_validation.py
"""
Date Observed validation against the season/year cycle.

Independent of seed_poll's poll-selection logic. Only answers one
question: does a given date fall inside a given season/year's valid
calendar range?

Rules:
  Dry Season Y: November 1 of (Y-1) through April 30 of Y, inclusive.
  Wet Season Y: May 1 through October 31 of Y, inclusive.
"""
from datetime import date


def get_season_date_range(season, year):
    """
    Returns (start_date, end_date) as date objects, inclusive, for the
    given season code ('DRY' or 'WET') and year. Returns (None, None)
    for an unrecognized season code.
    """
    if season == 'DRY':
        return date(year - 1, 11, 1), date(year, 4, 30)
    if season == 'WET':
        return date(year, 5, 1), date(year, 10, 31)
    return None, None


def is_date_in_season(observed_date, season, year):
    """
    Returns True if observed_date falls within the season/year's valid
    range (inclusive). observed_date may be a date object or an ISO
    'YYYY-MM-DD' string. Unrecognized season codes return True (does
    not block) so this never masks an unrelated validation error.
    """
    if isinstance(observed_date, str):
        try:
            observed_date = date.fromisoformat(observed_date)
        except ValueError:
            return False

    start, end = get_season_date_range(season, year)
    if start is None or end is None:
        return True

    return start <= observed_date <= end