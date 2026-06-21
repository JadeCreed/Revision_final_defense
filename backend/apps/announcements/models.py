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
    action_title = models.CharField(
        max_length=140,
        blank=True,
        default='',
        help_text='Optional button text for an action users should take.'
    )
    action_url = models.CharField(
        max_length=250,
        blank=True,
        default='',
        help_text='Optional internal path or URL for the action button.'
    )

    announced_date = models.DateField(
    null=True,
    blank=True,
    help_text='Display date shown to users. Defaults to creation date if empty.')
    
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
        # Strip and remove empty strings in case of double commas
        return [b.strip() for b in self.target_barangays.split(',') if b.strip()]

    def is_visible_to(self, user):
        """
        Check if this announcement is visible to a specific user.
        Called by UserAnnouncementDetailView to verify access.

        Must stay in sync with get_visible_announcements() in views.py.

        Handles all 3 roles:
          FARMER — single barangay stored in user.barangay
          BRGY   — single barangay stored in user.barangay
          AT     — multiple barangays stored in at_profile.barangays
        """
        if not self.is_active:
            return False

        if self.target_role != 'ALL' and self.target_role != user.role:
            return False

        # Case-insensitive normalization
        target_brgys = [b.lower().strip() for b in self.get_target_barangays()]

        if not target_brgys:
            return True

        if user.role == 'AT':
            try:
                user_barangays = [b.lower().strip() for b in user.at_profile.barangays.values_list('name', flat=True)]
            except Exception:
                user_barangays = []
        else:
            single_barangay = getattr(user, 'barangay', None) or ''
            user_barangays  = [single_barangay.lower().strip()] if single_barangay else []

        return any(brgy in target_brgys for brgy in user_barangays)

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
        user_name = getattr(self.user, 'first_name', 'User')
        announcement_title = getattr(self.announcement, 'title', 'Announcement')
        return f"{user_name} read '{announcement_title}'"