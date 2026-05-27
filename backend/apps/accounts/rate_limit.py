# apps/accounts/rate_limit.py
"""
Rate limiting for login attempts to prevent brute force attacks.
Uses Django cache to track failed login attempts per user/IP.
"""
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta


class LoginRateLimiter:
    """Rate limiter for login attempts."""
    
    FAILED_ATTEMPTS_KEY = "login_failed_{identifier}"
    LOCKED_KEY = "login_locked_{identifier}"
    MAX_ATTEMPTS = 5
    LOCKOUT_DURATION = 300  # 5 minutes in seconds
    
    @classmethod
    def get_cache_key_attempts(cls, identifier):
        """Get the cache key for tracking failed attempts."""
        return cls.FAILED_ATTEMPTS_KEY.format(identifier=identifier)
    
    @classmethod
    def get_cache_key_locked(cls, identifier):
        """Get the cache key for tracking lockout status."""
        return cls.LOCKED_KEY.format(identifier=identifier)
    
    @classmethod
    def is_locked(cls, identifier):
        """Check if identifier (email/phone) is locked."""
        return cache.get(cls.get_cache_key_locked(identifier), False)
    
    @classmethod
    def get_remaining_time(cls, identifier):
        """Get remaining lockout time in seconds."""
        locked_until = cache.get(cls.get_cache_key_locked(identifier))
        if locked_until:
            remaining = locked_until - timezone.now().timestamp()
            return max(0, int(remaining))
        return 0
    
    @classmethod
    def record_failed_attempt(cls, identifier):
        """Record a failed login attempt and lock if threshold reached."""
        key_attempts = cls.get_cache_key_attempts(identifier)
        key_locked = cls.get_cache_key_locked(identifier)
        
        # Get current attempt count
        attempts = cache.get(key_attempts, 0) + 1
        
        # Store the new attempt count (expires after lockout period)
        cache.set(key_attempts, attempts, cls.LOCKOUT_DURATION)
        
        # Lock if max attempts reached
        if attempts >= cls.MAX_ATTEMPTS:
            locked_until = timezone.now().timestamp() + cls.LOCKOUT_DURATION
            cache.set(key_locked, locked_until, cls.LOCKOUT_DURATION)
            return True  # Locked
        
        return False  # Not locked yet
    
    @classmethod
    def reset_failed_attempts(cls, identifier):
        """Reset failed attempts on successful login."""
        key_attempts = cls.get_cache_key_attempts(identifier)
        key_locked = cls.get_cache_key_locked(identifier)
        cache.delete(key_attempts)
        cache.delete(key_locked)
