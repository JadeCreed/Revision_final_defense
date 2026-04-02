from django.db import models
from django.conf import settings

class Announcement(models.Model):

    TARGET_ROLE_CHOICES = (
        ('ALL',    'All Users'),
        ('FARMER', 'Farmers Only'),
        ('AT',     'Agricultural Technicians Only'),
        ('BRGY',   'Barangay Presidents Only'),
    )

    title      = models.CharField(max_length=200)
    content    = models.TextField()

    # WHO posted it — always an ADMIN user
    # FK to accounts.User — this is the connection to accounts app
    posted_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,       # ← uses AUTH_USER_MODEL not direct import
        on_delete=models.SET_NULL,      # ← if admin deleted, announcement stays
        null=True,
        related_name='announcements_posted'
    )

    # WHO can see it
    target_role = models.CharField(
        max_length=10,
        choices=TARGET_ROLE_CHOICES,
        default='ALL'
    )

    # WHICH barangays — empty means ALL barangays
    # Stored as comma-separated: "Abang,Aliliw,Ayuti"
    # or blank = all barangays
    target_barangays = models.TextField(
        blank=True,
        default='',
        help_text='Comma-separated barangay names. Empty = all barangays.'
    )

    # WHEN
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # STATUS
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']  # newest first

    def __str__(self):
        return f"[{self.target_role}] {self.title}"

    def get_target_barangays(self):
        """Returns list of target barangays, or empty list if all."""
        if not self.target_barangays:
            return []
        return [b.strip() for b in self.target_barangays.split(',')]

    def is_visible_to(self, user):
        """
        Check if this announcement is visible to a specific user.
        Used for filtering — keeps logic in one place.
        """
        # Must be active
        if not self.is_active:
            return False

        # Check role match
        if self.target_role != 'ALL' and self.target_role != user.role:
            return False

        # Check barangay match (if announcement targets specific barangays)
        target_brgys = self.get_target_barangays()
        if target_brgys:
            user_barangay = getattr(user, 'barangay', None)
            if user_barangay not in target_brgys:
                return False

        return True


class AnnouncementRead(models.Model):
    """
    Tracks which users have read which announcements.
    Used to show unread counts and mark read/unread.
    FK to accounts.User — second connection to accounts app.
    """
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcement_reads'
    )
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name='reads'
    )
    read_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'announcement')  # one read record per user per announcement
        ordering = ['-read_at']

    def __str__(self):
        return f"{self.user.first_name} read '{self.announcement.title}'"