from django_auth_ldap.backend import LDAPBackend


class CustomLDAPBackend(LDAPBackend):
    """ A custom LDAP authentication backend """

    def authenticate(self, request, username=None, password=None, **kwargs):
        user = LDAPBackend().authenticate(self, username, password)
        return user
