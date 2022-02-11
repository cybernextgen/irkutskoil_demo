import ldap
from django_auth_ldap.config import LDAPSearch, GroupOfNamesType

AUTH_LDAP_SERVER_URI = "ldap://localhost:1389"

AUTH_LDAP_BIND_DN = "cn=admin,dc=example,dc=org"
AUTH_LDAP_BIND_PASSWORD = "adminpassword"

AUTH_LDAP_USER_SEARCH = LDAPSearch(
    "ou=ispd_users,dc=example,dc=org", ldap.SCOPE_SUBTREE, "(uid=%(user)s)"
)
# Or:
# AUTH_LDAP_USER_DN_TEMPLATE = 'uid=%(user)s,ou=ispd_users,dc=example,dc=org'

# Set up the basic group parameters.
AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
    "ou=ispd_groups,dc=example,dc=org",
    ldap.SCOPE_SUBTREE,
    "(objectClass=groupOfNames)",
)
AUTH_LDAP_GROUP_TYPE = GroupOfNamesType(name_attr="cn")

# Simple group restrictions
# AUTH_LDAP_REQUIRE_GROUP = "cn=enabled,ou=ispd_groups,dc=example,dc=org"
# AUTH_LDAP_DENY_GROUP = "cn=disabled,ou=ispd_groups,dc=example,dc=org"

# Populate the Django user from the LDAP directory.
AUTH_LDAP_USER_ATTR_MAP = {
    "first_name": "givenName",
    "last_name": "sn",
    "email": "mail",
}

AUTH_LDAP_USER_FLAGS_BY_GROUP = {
    "is_active": "cn=is_active,ou=ispd_groups,dc=example,dc=org",
    "is_staff": "cn=is_staff,ou=ispd_groups,dc=example,dc=org",
    "is_superuser": "cn=is_superuser,ou=ispd_groups,dc=example,dc=org",
}

# This is the default, but I like to be explicit.
AUTH_LDAP_ALWAYS_UPDATE_USER = True

# Use LDAP group membership to calculate group permissions.
AUTH_LDAP_FIND_GROUP_PERMS = True

AUTH_LDAP_MIRROR_GROUPS = True
AUTH_LDAP_CACHE_GROUPS = False

AUTH_LDAP_MIRROR_GROUPS_EXCEPT = ['enabled', 'disabled', 'is_active', 'is_staff', 'is_superuser']

AUTH_LDAP_CACHE_TIMEOUT = 3600

AUTHENTICATION_BACKENDS = (
    "math_server.auth_backend.CustomLDAPBackend",
    "django.contrib.auth.backends.ModelBackend",
)
